import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/services/email-smtp";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      applicantName,
      applicantEmail,
      applicationId,
      applicationType,
      status,
      rejectionReason,
      submissionDate,
    } = body;

    if (
      !applicantName ||
      !applicantEmail ||
      !applicationId ||
      !applicationType ||
      !status
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const success = await sendEmail({
      applicantName,
      applicantEmail,
      applicationId,
      applicationType,
      status,
      rejectionReason,
      submissionDate,
    });

    if (!success) {
      return NextResponse.json(
        { error: "Failed to send email" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Email sent successfully",
    });
  } catch (error) {
    console.error("Error in send-email API route:", error);

    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
