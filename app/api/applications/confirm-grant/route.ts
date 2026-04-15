import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { executeGrant } from "@/lib/services/grant-application";
import { logEvent } from "@/lib/services/log-events";
import { getCurrentTimePH } from "@/lib/utils/date-formatting";

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user || !user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: dbUser, error: userError } = await supabase
      .from("User")
      .select("id, name, email, role, profilePicture")
      .eq("email", user.email)
      .single();

    if (userError || !dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const { applicationId, action } = body as {
      applicationId?: string;
      action?: string;
    };

    if (!applicationId || !action || !["accept", "decline"].includes(action)) {
      return NextResponse.json(
        {
          error:
            'Invalid request. Provide applicationId and action ("accept" or "decline").',
        },
        { status: 400 },
      );
    }

    const supabaseAdmin = getSupabaseAdminClient();

    const { data: app, error: appError } = await supabaseAdmin
      .from("Application")
      .select("id, userId, status")
      .eq("id", applicationId)
      .single();

    if (appError || !app) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 },
      );
    }

    if (app.userId !== dbUser.id) {
      return NextResponse.json(
        { error: "You do not own this application" },
        { status: 403 },
      );
    }

    if (app.status !== "PENDING_GRANT") {
      return NextResponse.json(
        {
          error: `Application is not awaiting your confirmation (current status: ${app.status}).`,
        },
        { status: 400 },
      );
    }

    if (action === "accept") {
      const result = await executeGrant(applicationId, {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        role: dbUser.role,
        profilePicture: dbUser.profilePicture,
      });

      if (!result.success) {
        return NextResponse.json(
          { error: result.error ?? "Failed to execute grant" },
          { status: 500 },
        );
      }

      await logEvent({
        eventType: "USER_GRANT_CONFIRMED",
        message: `User confirmed grant for application ${applicationId}`,
        actorId: dbUser.id,
        actorRole: dbUser.role ?? "USER",
        actorName: dbUser.name ?? user.email,
        actorUsername: dbUser.email ?? user.email,
        actorAvatarUrl: dbUser.profilePicture ?? null,
        metadata: { applicationId },
      });

      return NextResponse.json({
        success: true,
        status: "GRANTED",
        message: "Scholarship grant confirmed successfully.",
      });
    }

    // action === "decline"
    const { error: declineError } = await supabaseAdmin
      .from("Application")
      .update({ status: "APPROVED", updatedAt: getCurrentTimePH() })
      .eq("id", applicationId);

    if (declineError) {
      console.error("Failed to decline grant:", declineError);
      return NextResponse.json(
        { error: "Failed to decline grant" },
        { status: 500 },
      );
    }

    await logEvent({
      eventType: "USER_GRANT_DECLINED",
      message: `User declined grant for application ${applicationId}`,
      actorId: dbUser.id,
      actorRole: dbUser.role ?? "USER",
      actorName: dbUser.name ?? user.email,
      actorUsername: dbUser.email ?? user.email,
      actorAvatarUrl: dbUser.profilePicture ?? null,
      metadata: { applicationId },
    });

    return NextResponse.json({
      success: true,
      status: "APPROVED",
      message: "Scholarship grant declined. Application returned to Approved.",
    });
  } catch (error) {
    console.error("Unexpected error in confirm-grant:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
