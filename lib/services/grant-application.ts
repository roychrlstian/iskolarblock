import { randomUUID } from "crypto";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAwardingToBlockchain } from "@/lib/services/blockchain";
import { sendEmailNotification } from "@/lib/services/email-notification";
import { logEvent } from "@/lib/services/log-events";
import { getCurrentTimePH } from "@/lib/utils/date-formatting";

type AdminClient = ReturnType<typeof getSupabaseAdminClient>;

interface AdminProfile {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  profilePicture: string | null;
}

interface GrantResult {
  success: boolean;
  error?: string;
}

function extractPersonalInfo(details: unknown): Record<string, unknown> | null {
  if (!details || typeof details !== "object") return null;

  if ("personalInfo" in details) {
    const personalInfo = (details as Record<string, unknown>).personalInfo;
    if (personalInfo && typeof personalInfo === "object") {
      return personalInfo as Record<string, unknown>;
    }
  }

  return details as Record<string, unknown>;
}

function readStringField(
  source: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = source[key];
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return undefined;
}

export function getAwardeeName(application: {
  applicationDetails: unknown;
}): string {
  const personalInfo = extractPersonalInfo(application.applicationDetails);
  if (personalInfo) {
    const firstName = readStringField(personalInfo, "firstName");
    const middleName = readStringField(personalInfo, "middleName");
    const lastName = readStringField(personalInfo, "lastName");
    const parts = [firstName, middleName, lastName].filter(Boolean);
    if (parts.length) return parts.join(" ");
  }
  return "Scholarship Awardee";
}

export function determineScholarAmount(details: unknown): number {
  const personalInfo = extractPersonalInfo(details);
  const yearLevelRaw = personalInfo?.yearLevel;
  const yearLevel =
    typeof yearLevelRaw === "string" ? yearLevelRaw.toLowerCase() : "";
  const seniorHighTokens = [
    "g11",
    "grade 11",
    "grade11",
    "g12",
    "grade 12",
    "grade12",
    "senior high",
    "shs",
  ];
  return seniorHighTokens.some((t) => yearLevel.includes(t)) ? 500 : 1000;
}

async function adjustBudgetBalance({
  supabase,
  applicationPeriodId,
  previousStatus,
  newStatus,
  amount,
}: {
  supabase: AdminClient;
  applicationPeriodId: string | null;
  previousStatus: string;
  newStatus: string;
  amount: number;
}): Promise<{ success: boolean; error?: string }> {
  const previouslyGranted = previousStatus === "GRANTED";
  const newlyGranted = newStatus === "GRANTED";

  if (previouslyGranted === newlyGranted || !applicationPeriodId) {
    return { success: true };
  }

  const { data: period, error: periodError } = await supabase
    .from("ApplicationPeriod")
    .select("id, budgetId")
    .eq("id", applicationPeriodId)
    .single();

  if (periodError || !period || !period.budgetId) {
    if (periodError) {
      console.error(
        "Failed to fetch application period for budget update:",
        periodError,
      );
      return {
        success: false,
        error: "Unable to locate application period budget",
      };
    }
    return { success: true };
  }

  const { data: budget, error: budgetError } = await supabase
    .from("Budget")
    .select("id, remainingAmount")
    .eq("id", period.budgetId)
    .single();

  if (budgetError || !budget) {
    console.error("Failed to fetch budget for awarding update:", budgetError);
    return { success: false, error: "Budget record not found" };
  }

  const currentRemaining = budget.remainingAmount ?? 0;
  const delta = newlyGranted ? -amount : amount;
  const newRemaining = newlyGranted
    ? Math.max(0, currentRemaining + delta)
    : currentRemaining + delta;

  const { error: updateError } = await supabase
    .from("Budget")
    .update({ remainingAmount: newRemaining, updatedAt: getCurrentTimePH() })
    .eq("id", period.budgetId);

  if (updateError) {
    console.error("Failed to adjust budget balance:", updateError);
    return { success: false, error: "Budget update failed" };
  }

  return { success: true };
}

async function ensureAwardingRecord({
  supabase,
  applicationId,
  amount,
  name,
}: {
  supabase: AdminClient;
  applicationId: string;
  amount: number;
  name: string;
}): Promise<{ success: boolean; awardingId?: string }> {
  const { data: existing, error } = await supabase
    .from("Awarding")
    .select("id")
    .eq("applicationId", applicationId)
    .limit(1);

  if (error) {
    console.error("Failed to query awarding record:", error);
    return { success: false };
  }

  if (existing && existing.length > 0) {
    return { success: true, awardingId: existing[0].id };
  }

  const awardingId = randomUUID();
  const { error: insertError } = await supabase.from("Awarding").insert({
    id: awardingId,
    name,
    applicationId,
    amountReceived: amount,
    timestamp: getCurrentTimePH(),
  });

  if (insertError) {
    console.error("Failed to insert awarding record:", insertError);
    return { success: false };
  }

  return { success: true, awardingId };
}

async function logAwardingBlockchainRecord({
  supabase,
  awardingId,
  applicationId,
  userId,
  amount,
}: {
  supabase: AdminClient;
  awardingId: string;
  applicationId: string;
  userId: string | null;
  amount: number;
}): Promise<{ success: boolean }> {
  try {
    const blockchainTxHash = await logAwardingToBlockchain(
      awardingId,
      applicationId,
      amount,
    );

    const transactionHash =
      blockchainTxHash ??
      `local-${awardingId}-${applicationId}-${Date.now().toString(16)}`;

    if (!blockchainTxHash) {
      console.warn(
        "Blockchain transaction hash unavailable. Using locally generated reference instead.",
      );
    }

    const { error: insertError } = await supabase
      .from("BlockchainRecord")
      .insert({
        id: randomUUID(),
        recordType: "AWARDING",
        transactionHash,
        awardingId,
        applicationId,
        userId,
      });

    if (insertError) {
      console.error("Failed to insert blockchain record:", insertError);
      return { success: false };
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to log awarding blockchain record:", error);
    return { success: false };
  }
}

/**
 * Executes the full grant flow: budget adjustment, awarding record,
 * blockchain log, event log, and email notification.
 * Called when user confirms a PENDING_GRANT, or if direct-grant is ever needed.
 */
export async function executeGrant(
  applicationId: string,
  actorProfile?: AdminProfile | null,
): Promise<GrantResult> {
  const supabaseAdmin = getSupabaseAdminClient();

  const { data: app, error: fetchError } = await supabaseAdmin
    .from("Application")
    .select(
      `
      id,
      userId,
      status,
      applicationDetails,
      applicationPeriodId,
      applicationType,
      createdAt,
      User!Application_userId_fkey (
        id,
        name,
        email
      )
    `,
    )
    .eq("id", applicationId)
    .single();

  if (fetchError || !app) {
    return { success: false, error: "Application not found" };
  }

  const previousStatus = app.status ?? "PENDING";
  const scholarAmount = determineScholarAmount(app.applicationDetails);

  const { error: updateError } = await supabaseAdmin
    .from("Application")
    .update({ status: "GRANTED", updatedAt: getCurrentTimePH() })
    .eq("id", applicationId);

  if (updateError) {
    return { success: false, error: "Failed to update status to GRANTED" };
  }

  const budgetResult = await adjustBudgetBalance({
    supabase: supabaseAdmin,
    applicationPeriodId: app.applicationPeriodId,
    previousStatus,
    newStatus: "GRANTED",
    amount: scholarAmount,
  });

  if (!budgetResult.success) {
    await supabaseAdmin
      .from("Application")
      .update({ status: previousStatus, updatedAt: getCurrentTimePH() })
      .eq("id", applicationId);
    return {
      success: false,
      error: "Failed to update budget for granted scholarship",
    };
  }

  const awardeeName = getAwardeeName(app);
  const awardingResult = await ensureAwardingRecord({
    supabase: supabaseAdmin,
    applicationId,
    amount: scholarAmount,
    name: awardeeName,
  });

  if (!awardingResult.success || !awardingResult.awardingId) {
    return { success: false, error: "Failed to record awarding details" };
  }

  const blockchainResult = await logAwardingBlockchainRecord({
    supabase: supabaseAdmin,
    awardingId: awardingResult.awardingId,
    applicationId,
    userId: app.userId ?? null,
    amount: scholarAmount,
  });

  if (!blockchainResult.success) {
    return { success: false, error: "Failed to log awarding on blockchain" };
  }

  await logEvent({
    eventType: "ADMIN_AWARD_GRANTED",
    message: `Application ${applicationId} granted`,
    actorId: actorProfile?.id ?? null,
    actorRole: actorProfile?.role ?? "SYSTEM",
    actorName: actorProfile?.name ?? "System",
    actorUsername: actorProfile?.email ?? null,
    actorAvatarUrl: actorProfile?.profilePicture ?? null,
    metadata: { applicationId, amount: scholarAmount },
  });

  const userData = Array.isArray(app.User) ? app.User[0] : app.User;
  const userEmail = userData?.email;

  if (userEmail) {
    await sendEmailNotification({
      applicantName: awardeeName,
      applicantEmail: userEmail,
      applicationId,
      applicationType: app.applicationType || "NEW",
      status: "GRANTED",
      submissionDate: app.createdAt,
    }).catch((err) => {
      console.error("Failed to send granted notification email:", err);
    });
  }

  return { success: true };
}
