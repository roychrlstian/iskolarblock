import nodemailer from "nodemailer";
import { readFileSync } from "fs";
import { join } from "path";

type EmailStatus = "PENDING" | "APPROVED" | "REJECTED" | "GRANTED";

interface SendEmailParams {
  applicantName: string;
  applicantEmail: string;
  applicationId: string;
  applicationType: string;
  status: EmailStatus;
  rejectionReason?: string;
  submissionDate?: string;
}

const SUBJECT_MAP: Record<EmailStatus, string> = {
  PENDING: "Application Received — Under Review",
  APPROVED: "Application Approved!",
  REJECTED: "Application Status Update",
  GRANTED: "Scholarship Granted!",
};

const TEMPLATE_MAP: Record<EmailStatus, string> = {
  PENDING: "pending.html",
  APPROVED: "approved.html",
  REJECTED: "rejected.html",
  GRANTED: "granted.html",
};

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: (Number(process.env.SMTP_PORT) || 587) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function loadTemplate(status: EmailStatus): string {
  const fileName = TEMPLATE_MAP[status];
  const filePath = join(process.cwd(), "email-templates", fileName);
  return readFileSync(filePath, "utf-8");
}

function interpolate(html: string, params: SendEmailParams): string {
  return html
    .replace(/\{\{applicantName\}\}/g, params.applicantName)
    .replace(/\{\{applicationId\}\}/g, params.applicationId)
    .replace(/\{\{applicationType\}\}/g, params.applicationType)
    .replace(/\{\{status\}\}/g, params.status)
    .replace(/\{\{rejectionReason\}\}/g, params.rejectionReason || "")
    .replace(/\{\{submissionDate\}\}/g, params.submissionDate || "");
}

export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!from || !process.env.SMTP_HOST) {
    console.error("SMTP not configured — skipping email send");
    return false;
  }

  try {
    const rawHtml = loadTemplate(params.status);
    const html = interpolate(rawHtml, params);
    const transporter = getTransporter();

    await transporter.sendMail({
      from: `"IskolarBlock" <${from}>`,
      to: params.applicantEmail,
      subject: `IskolarBlock — ${SUBJECT_MAP[params.status]}`,
      html,
    });

    return true;
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
}
