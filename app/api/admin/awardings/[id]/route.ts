import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/utils/auth-server";
import { logEvent } from "@/lib/services/log-events";
import { sendEmailNotification } from "@/lib/services/email-notification";
import { getAwardeeName } from "@/lib/services/grant-application";
import { getCurrentTimePH } from "@/lib/utils/date-formatting";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  let adminInfo: { email: string; role: string } | null = null;
  try {
    try {
      adminInfo = await requireAdmin();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unauthorized";
      const status = message.includes("Forbidden") ? 403 : 401;
      return NextResponse.json({ error: message }, { status });
    }

    const supabaseAdmin = getSupabaseAdminClient();
    const { id } = await context.params;
    const body = await request.json();
    const { status } = body as { status?: string };

    if (status !== "GRANTED") {
      return NextResponse.json(
        { error: "Invalid status update. Only GRANTED is allowed." },
        { status: 400 },
      );
    }

    const { data: existingApplication, error: fetchError } =
      await supabaseAdmin
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
        .eq("id", id)
        .single();

    if (fetchError || !existingApplication) {
      console.error("Application not found for awarding update:", fetchError);
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 },
      );
    }

    if (
      existingApplication.status !== "APPROVED" &&
      existingApplication.status !== "PENDING_GRANT"
    ) {
      return NextResponse.json(
        {
          error: `Cannot grant an application with status "${existingApplication.status}". Only APPROVED applications can be granted.`,
        },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from("Application")
      .update({
        status: "PENDING_GRANT",
        updatedAt: getCurrentTimePH(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating awarding status:", error);
      return NextResponse.json(
        { error: "Failed to update awarding status" },
        { status: 500 },
      );
    }

    let adminProfile: {
      id: string;
      name: string | null;
      email: string | null;
      role: string | null;
      profilePicture: string | null;
    } | null = null;
    if (adminInfo?.email) {
      const { data: adminUser } = await supabaseAdmin
        .from("User")
        .select("id, name, email, role, profilePicture")
        .eq("email", adminInfo.email)
        .maybeSingle();
      adminProfile = adminUser ?? null;
    }

    await logEvent({
      eventType: "ADMIN_AWARD_PENDING_GRANT",
      message: `Offered grant for application ${id} — awaiting user confirmation`,
      actorId: adminProfile?.id ?? null,
      actorRole: adminProfile?.role ?? adminInfo?.role ?? "ADMIN",
      actorName: adminProfile?.name ?? adminInfo?.email ?? "Admin",
      actorUsername: adminProfile?.email ?? adminInfo?.email ?? null,
      actorAvatarUrl: adminProfile?.profilePicture ?? null,
      metadata: { applicationId: id },
    });

    const userData = Array.isArray(existingApplication.User)
      ? existingApplication.User[0]
      : existingApplication.User;
    const userEmail = userData?.email;

    if (userEmail) {
      const applicantName = getAwardeeName(existingApplication);

      await sendEmailNotification({
        applicantName,
        applicantEmail: userEmail,
        applicationId: id,
        applicationType: existingApplication.applicationType || "NEW",
        status: "PENDING_GRANT",
        submissionDate: existingApplication.createdAt,
      }).catch((err) => {
        console.error("Failed to send pending grant notification email:", err);
      });
    }

    return NextResponse.json({ application: data });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
