import { getCurrentTimePH } from "@/lib/utils/date-formatting";
import { sendEmail } from "@/lib/services/email-smtp";

interface SendEmailNotificationParams {
  applicantName: string;
  applicantEmail: string;
  applicationId: string;
  applicationType: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "GRANTED";
  rejectionReason?: string;
  submissionDate?: string;
}

export async function sendEmailNotification(
  params: SendEmailNotificationParams
): Promise<boolean> {
  try {
    return await sendEmail({
      applicantName: params.applicantName,
      applicantEmail: params.applicantEmail,
      applicationId: params.applicationId,
      applicationType: params.applicationType,
      status: params.status,
      rejectionReason: params.rejectionReason || "",
      submissionDate: params.submissionDate || getCurrentTimePH(),
    });
  } catch (error) {
    console.error("Error sending email notification:", error);
    return false;
  }
}
