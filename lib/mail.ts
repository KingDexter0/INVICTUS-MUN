import nodemailer from "nodemailer";
import { randomUUID } from "crypto";
import { prisma } from "./prisma";
import { getDelegateDashboardUrl, getCertificateUrl, getBaseUrl } from "./url";

function isTestMode() {
  return process.env.EMAIL_TEST_MODE === "true";
}

function testModeNotice(to: string, trigger: string) {
  if (!isTestMode()) return "";
  return `
    <div style="margin:0 0 18px;padding:12px;border:1px solid #e9d8a6;border-radius:12px;background:#fff8e6;color:#6f4f00">
      <strong>SMTP test mode</strong>
      <p style="margin:8px 0 0">Original intended recipient: ${to}</p>
      <p style="margin:6px 0 0">Trigger: ${trigger}</p>
    </div>
  `;
}

// Reusable template for registrations
function baseTemplate({ heading, name, publicId, action, dashboardPath = "/dashboard", details = [] }: {
  heading: string;
  name: string;
  publicId: string;
  action: string;
  dashboardPath?: string;
  details?: Array<[string, string | null | undefined]>;
}) {
  const dashboardUrl = `${getBaseUrl()}${dashboardPath}`;
  const rows = details
    .filter(([, value]) => Boolean(value))
    .map(([label, value]) => `<p style="margin:6px 0;color:#565061"><strong>${label}:</strong> ${value}</p>`)
    .join("");

  return `
    <div style="margin:0;padding:0;background:#ffffff;font-family:Arial,sans-serif;color:#181424">
      <div style="max-width:620px;margin:0 auto;padding:28px">
        ${testModeNotice("", heading)}
        <div style="border-left:5px solid #6d43c8;padding-left:16px;margin-bottom:24px">
          <p style="margin:0;color:#6d43c8;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">Invictus MUN</p>
          <h1 style="margin:8px 0 0;font-size:28px;line-height:1.2">${heading}</h1>
        </div>
        <p style="font-size:16px;line-height:1.7">Dear ${name},</p>
        <p style="font-size:16px;line-height:1.7">${action}</p>
        <div style="margin:20px 0;padding:16px;border:1px solid #e9e5f0;border-radius:14px;background:#fbf9ff">
          <p style="margin:6px 0;color:#565061"><strong>Delegate ID:</strong> ${publicId}</p>
          ${rows}
        </div>
        <a href="${dashboardUrl}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#6d43c8;color:#fff;text-decoration:none;font-weight:700">Open Delegate Dashboard</a>
        <p style="margin-top:24px;color:#706b7e;font-size:13px;line-height:1.6">This is an automated update from Invictus MUN.</p>
      </div>
    </div>
  `;
}

export type EmailStatus = {
  status: "sent" | "sent-test" | "failed" | "skipped";
  messageId?: string;
};

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is missing`);
  return value;
}

export function isSmtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export function createTransporter() {
  const host = requireEnv("SMTP_HOST");
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === "true";
  const user = requireEnv("SMTP_USER");
  const pass = requireEnv("SMTP_PASS");

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
}

export async function verifySmtpConnection() {
  const transporter = createTransporter();
  await transporter.verify();
  return true;
}

async function logEmail({
  type,
  recipient,
  targetType,
  targetId,
  status,
  error,
  messageId,
}: {
  type: string;
  recipient: string;
  targetType?: string | null;
  targetId?: string | null;
  status: "SENT" | "FAILED" | "SKIPPED";
  error?: string | null;
  messageId?: string | null;
}) {
  try {
    await prisma.emailLog.create({
      data: {
        type,
        recipient,
        targetType: targetType || null,
        targetId: targetId || null,
        status,
        error: error || null,
        messageId: messageId || null,
      },
    });
  } catch (err) {
    console.error("Failed to write to EmailLog:", err);
  }
}

// 1. Centralized sendEmail function
export async function sendEmail({
  to,
  subject,
  html,
  text,
  replyTo,
  type = "generic",
  targetType,
  targetId,
  bypassTestMode = false,
}: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  type?: string;
  targetType?: string | null;
  targetId?: string | null;
  bypassTestMode?: boolean;
}): Promise<EmailStatus> {
  const recipientStr = Array.isArray(to) ? to.join(", ") : to;
  if (!isSmtpConfigured()) {
    console.warn("SMTP email skipped: host, user, or pass are not configured.");
    await logEmail({
      type,
      recipient: recipientStr,
      targetType,
      targetId,
      status: "SKIPPED",
      error: "SMTP environment configuration missing",
    });
    return { status: "skipped" } as EmailStatus;
  }

  console.log(`[SMTP] Preparing to send email of type "${type}" to: ${recipientStr}, Subject: ${subject}`);
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!from) {
    const errMsg = "SMTP_FROM or SMTP_USER environment variable is missing";
    await logEmail({
      type,
      recipient: recipientStr,
      targetType,
      targetId,
      status: "FAILED",
      error: errMsg,
    });
    throw new Error(errMsg);
  }

  const actualTo = (isTestMode() && !bypassTestMode) ? (process.env.TEST_EMAIL_TO as string) : recipientStr;
  const finalHtml = (isTestMode() && !bypassTestMode) ? html.replace(testModeNotice("", subject), testModeNotice(recipientStr, subject)) : html;

  try {
    const transporter = createTransporter();
    const info = await transporter.sendMail({
      from,
      to: actualTo,
      subject,
      html: finalHtml,
      text,
      replyTo,
    });
    console.log(`[SMTP] Send succeeded. MessageID: ${info.messageId}`);
    await logEmail({
      type,
      recipient: recipientStr,
      targetType,
      targetId,
      status: "SENT",
      messageId: info.messageId,
    });
    return { status: (isTestMode() ? "sent-test" : "sent"), messageId: info.messageId } as EmailStatus;
  } catch (error) {
    const errMsg = (error as Error).message || String(error);
    console.error(`[SMTP] Send failed to: ${actualTo}`, error);
    await logEmail({
      type,
      recipient: recipientStr,
      targetType,
      targetId,
      status: "FAILED",
      error: errMsg,
    });
    throw error;
  }
}

// 2. sendOtpEmail (Admin check-in OTP verification compatibility)
export async function sendOtpEmail(to: string, otp: string) {
  return sendEmail({
    to,
    subject: "Invictus MUN: Check-In OTP",
    html: `
      <div style="margin:0;padding:0;background:#ffffff;font-family:Arial,sans-serif;color:#181424">
        <div style="max-width:620px;margin:0 auto;padding:28px">
          <div style="border-left:5px solid #6d43c8;padding-left:16px;margin-bottom:24px">
            <p style="margin:0;color:#6d43c8;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">Invictus MUN</p>
            <h1 style="margin:8px 0 0;font-size:28px;line-height:1.2">Check-In Verification OTP</h1>
          </div>
          <p style="font-size:16px;line-height:1.7">A request was made to unlock delegate check-in access.</p>
          <div style="margin:20px 0;padding:24px;border:1px solid #e9e5f0;border-radius:14px;background:#fbf9ff;text-align:center">
            <p style="margin:0;color:#706b7e;font-size:14px;text-transform:uppercase;letter-spacing:.05em">Your OTP is</p>
            <h2 style="margin:10px 0 0;font-size:36px;color:#6d43c8;letter-spacing:4px;font-weight:bold">${otp}</h2>
            <p style="margin:15px 0 0;color:#e63946;font-size:13px">This code expires in 10 minutes.</p>
          </div>
          <p style="margin-top:24px;color:#706b7e;font-size:13px;line-height:1.6">If you did not initiate this request, you can safely ignore this email.</p>
        </div>
      </div>
    `,
    type: "admin_otp"
  });
}

// 3. sendRegistrationConfirmationEmail
export async function sendRegistrationConfirmationEmail({
  to,
  name,
  publicId,
  heading,
  action,
  details = [],
}: {
  to: string;
  name: string;
  publicId: string;
  heading: string;
  action: string;
  details?: Array<[string, string | null | undefined]>;
}) {
  return sendEmail({
    to,
    subject: `Invictus MUN: ${heading}`,
    html: baseTemplate({ heading, name, publicId, action, details }),
    type: "registration_confirmation",
    targetId: publicId
  });
}

// 4. sendCertificateEmail
export async function sendCertificateEmail({
  to,
  name,
  certificateNo,
  certificateUrl,
  targetType,
  targetId,
}: {
  to: string;
  name: string;
  certificateNo: string;
  certificateUrl: string;
  targetType?: string;
  targetId?: string;
}) {
  return sendEmail({
    to,
    subject: "Invictus MUN: Your Certificate of Participation",
    html: `
      <div style="margin:0;padding:0;background:#ffffff;font-family:Arial,sans-serif;color:#181424">
        <div style="max-width:620px;margin:0 auto;padding:28px">
          <div style="border-left:5px solid #6d43c8;padding-left:16px;margin-bottom:24px">
            <p style="margin:0;color:#6d43c8;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">Invictus MUN</p>
            <h1 style="margin:8px 0 0;font-size:28px;line-height:1.2">Your Certificate is Ready</h1>
          </div>
          <p style="font-size:16px;line-height:1.7">Dear ${name},</p>
          <p style="font-size:16px;line-height:1.7">Congratulations on successfully participating in Invictus MUN 2026! Your Certificate of Participation has been issued.</p>
          <div style="margin:20px 0;padding:16px;border:1px solid #e9e5f0;border-radius:14px;background:#fbf9ff">
            <p style="margin:6px 0;color:#565061"><strong>Certificate No:</strong> ${certificateNo}</p>
          </div>
          <a href="${certificateUrl}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#6d43c8;color:#fff;text-decoration:none;font-weight:700">Download Certificate</a>
          <p style="margin-top:24px;color:#706b7e;font-size:13px;line-height:1.6">Best regards,<br>The Invictus MUN Organizing Committee</p>
        </div>
      </div>
    `,
    type: "certificate",
    targetType,
    targetId
  });
}

// 5. sendRegistrationEmail
export async function sendRegistrationEmail(input: {
  to: string;
  name: string;
  publicId: string;
  heading: string;
  action: string;
  dashboardPath?: string;
  details?: Array<[string, string | null | undefined]>;
  targetType?: string;
  targetId?: string;
}) {
  return sendEmail({
    to: input.to,
    subject: `Invictus MUN: ${input.heading}`,
    html: baseTemplate(input),
    type: "registration_confirmation",
    targetType: input.targetType,
    targetId: input.targetId || input.publicId
  });
}

// 6. sendResourceEmail
export async function sendResourceEmail(input: {
  to: string;
  name: string;
  title: string;
  category: string;
  accessLevel: string;
  dashboardPath?: string;
}) {
  const dashboardUrl = `${getBaseUrl()}${input.dashboardPath || "/dashboard"}`;
  return sendEmail({
    to: input.to,
    subject: `Invictus MUN resource uploaded: ${input.title}`,
    html: `
      <div style="margin:0;padding:0;background:#ffffff;font-family:Arial,sans-serif;color:#181424">
        <div style="max-width:620px;margin:0 auto;padding:28px">
          ${testModeNotice("", "Resource uploaded")}
          <div style="border-left:5px solid #6d43c8;padding-left:16px;margin-bottom:24px">
            <p style="margin:0;color:#6d43c8;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">Invictus MUN</p>
            <h1 style="margin:8px 0 0;font-size:28px;line-height:1.2">New resource uploaded</h1>
          </div>
          <p style="font-size:16px;line-height:1.7">Dear ${input.name},</p>
          <p style="font-size:16px;line-height:1.7">A new resource has been uploaded: <strong>${input.title}</strong>.</p>
          <div style="margin:20px 0;padding:16px;border:1px solid #e9e5f0;border-radius:14px;background:#fbf9ff">
            <p style="margin:6px 0;color:#565061"><strong>Category:</strong> ${input.category}</p>
            <p style="margin:6px 0;color:#565061"><strong>Access level:</strong> ${input.accessLevel}</p>
          </div>
          <a href="${dashboardUrl}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#6d43c8;color:#fff;text-decoration:none;font-weight:700">Open Delegate Dashboard</a>
          <p style="margin-top:24px;color:#706b7e;font-size:13px;line-height:1.6">This is an automated update from Invictus MUN.</p>
        </div>
      </div>
    `,
    type: "resource"
  });
}

// 7. sendAdminTestEmail
export async function sendAdminTestEmail(to: string) {
  return sendEmail({
    to,
    subject: "Invictus MUN test email",
    html: `
      <div style="margin:0;padding:0;background:#ffffff;font-family:Arial,sans-serif;color:#181424">
        <div style="max-width:620px;margin:0 auto;padding:28px">
          ${testModeNotice("", "Admin test email")}
          <div style="border-left:5px solid #6d43c8;padding-left:16px;margin-bottom:24px">
            <p style="margin:0;color:#6d43c8;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">Invictus MUN</p>
            <h1 style="margin:8px 0 0;font-size:28px;line-height:1.2">Email test successful</h1>
          </div>
          <p style="font-size:16px;line-height:1.7">This confirms Nodemailer/SMTP is connected to the Invictus MUN admin portal.</p>
        </div>
      </div>
    `,
    type: "smtp_test"
  });
}

// 8. sendCheckInOtpEmail
export async function sendCheckInOtpEmail(
  to: string,
  delegateName: string,
  delegateId: string,
  committee: string,
  institution: string,
  otp: string
) {
  return sendEmail({
    to,
    subject: "Invictus MUN: Delegate Check-In OTP",
    html: `
      <div style="margin:0;padding:0;background:#ffffff;font-family:Arial,sans-serif;color:#181424">
        <div style="max-width:620px;margin:0 auto;padding:28px">
          <div style="border-left:5px solid #6d43c8;padding-left:16px;margin-bottom:24px">
            <p style="margin:0;color:#6d43c8;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">Invictus MUN</p>
            <h1 style="margin:8px 0 0;font-size:28px;line-height:1.2">Delegate Check-In OTP</h1>
          </div>
          <p style="font-size:16px;line-height:1.7">A check-in OTP was requested for:</p>
          <div style="margin:20px 0;padding:20px;border:1px solid #e9e5f0;border-radius:14px;background:#fbf9ff">
            <p style="margin:6px 0;color:#565061"><strong>Delegate:</strong> ${delegateName}</p>
            <p style="margin:6px 0;color:#565061"><strong>Registration ID:</strong> ${delegateId}</p>
            <p style="margin:6px 0;color:#565061"><strong>Committee:</strong> ${committee || "Not allotted/available"}</p>
            <p style="margin:6px 0;color:#565061"><strong>Institution:</strong> ${institution || "Independent delegate"}</p>
          </div>
          <div style="margin:20px 0;padding:24px;border:1px solid #e9e5f0;border-radius:14px;background:#fbf9ff;text-align:center">
            <p style="margin:0;color:#706b7e;font-size:14px;text-transform:uppercase;letter-spacing:.05em">OTP Code</p>
            <h2 style="margin:10px 0 0;font-size:36px;color:#6d43c8;letter-spacing:4px;font-weight:bold">${otp}</h2>
            <p style="margin:15px 0 0;color:#e63946;font-size:13px">This OTP is valid for 5 minutes.</p>
          </div>
          <p style="margin-top:24px;color:#706b7e;font-size:13px;line-height:1.6">If you did not request this check-in, please ignore this email.</p>
        </div>
      </div>
    `,
    type: "checkin_otp",
    targetType: "delegate",
    targetId: delegateId
  });
}

// 9. sendAllotmentAndPaymentEmail
export async function sendAllotmentAndPaymentEmail({
  to,
  name,
  publicId,
  trackingToken,
  committee,
  portfolio,
  targetType = "individual"
}: {
  to: string;
  name: string;
  publicId: string;
  trackingToken: string;
  committee: string;
  portfolio: string;
  targetType?: string;
}) {
  const dashboardUrl = getDelegateDashboardUrl(trackingToken);
  return sendEmail({
    to,
    subject: "Invictus MUN: Portfolio Allotment & Dashboard Access",
    html: `
      <div style="margin:0;padding:0;background:#ffffff;font-family:Arial,sans-serif;color:#181424">
        <div style="max-width:620px;margin:0 auto;padding:28px">
          ${testModeNotice("", "Allotment & Payment Confirmation")}
          <div style="border-left:5px solid #6d43c8;padding-left:16px;margin-bottom:24px">
            <p style="margin:0;color:#6d43c8;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">Invictus MUN</p>
            <h1 style="margin:8px 0 0;font-size:28px;line-height:1.2">Your Portfolio is Allotted!</h1>
          </div>
          <p style="font-size:16px;line-height:1.7">Dear ${name},</p>
          <p style="font-size:16px;line-height:1.7">We are pleased to inform you that your portfolio/allotment has been assigned, and your registration payment is verified. You can now access your personalized delegate dashboard.</p>
          <div style="margin:20px 0;padding:16px;border:1px solid #e9e5f0;border-radius:14px;background:#fbf9ff">
            <p style="margin:6px 0;color:#565061"><strong>Delegate ID:</strong> ${publicId}</p>
            <p style="margin:6px 0;color:#565061"><strong>Committee:</strong> ${committee}</p>
            <p style="margin:6px 0;color:#565061"><strong>Portfolio/Allotment:</strong> ${portfolio}</p>
          </div>
          <div style="margin:24px 0">
            <a href="${dashboardUrl}" style="display:inline-block;padding:14px 24px;border-radius:999px;background:#6d43c8;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;text-align:center">Open Delegate Dashboard</a>
          </div>
          <p style="margin-top:24px;color:#706b7e;font-size:13px;line-height:1.6">This is an automated update from Invictus MUN.</p>
        </div>
      </div>
    `,
    type: "allotment",
    targetType,
    targetId: publicId
  });
}

// 10. sendWelcomeEmail
export async function sendWelcomeEmail({
  to,
  name,
  publicId,
  trackingToken,
  targetType = "individual"
}: {
  to: string;
  name: string;
  publicId: string;
  trackingToken: string;
  targetType?: string;
}) {
  const dashboardUrl = getDelegateDashboardUrl(trackingToken);
  return sendEmail({
    to,
    subject: "Welcome to Invictus MUN 2026!",
    html: `
      <div style="margin:0;padding:0;background:#ffffff;font-family:Arial,sans-serif;color:#181424">
        <div style="max-width:620px;margin:0 auto;padding:28px">
          ${testModeNotice("", "Welcome Email")}
          <div style="border-left:5px solid #6d43c8;padding-left:16px;margin-bottom:24px">
            <p style="margin:0;color:#6d43c8;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">Invictus MUN</p>
            <h1 style="margin:8px 0 0;font-size:28px;line-height:1.2">Welcome to the Conference!</h1>
          </div>
          <p style="font-size:16px;line-height:1.7">Dear ${name},</p>
          <p style="font-size:16px;line-height:1.7">We are thrilled to welcome you to Invictus MUN 2026. Your registration is confirmed, and you can now log in to check for updates and announcements on your delegate dashboard.</p>
          <div style="margin:20px 0;padding:16px;border:1px solid #e9e5f0;border-radius:14px;background:#fbf9ff">
            <p style="margin:6px 0;color:#565061"><strong>Delegate ID:</strong> ${publicId}</p>
          </div>
          <div style="margin:24px 0">
            <a href="${dashboardUrl}" style="display:inline-block;padding:14px 24px;border-radius:999px;background:#6d43c8;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;text-align:center">Open Delegate Dashboard</a>
          </div>
          <p style="margin-top:24px;color:#706b7e;font-size:13px;line-height:1.6">Best regards,<br>The Invictus MUN Secretariat</p>
        </div>
      </div>
    `,
    type: "welcome",
    targetType,
    targetId: publicId
  });
}

// 11. maybeSendAllotmentPaymentEmail
export async function maybeSendAllotmentPaymentEmail({
  targetType,
  targetId,
  forceResend = false,
}: {
  targetType: "individual" | "delegate";
  targetId: string;
  forceResend?: boolean;
}): Promise<EmailStatus & { skippedReason?: string }> {
  if (targetType === "individual") {
    const reg = await prisma.individualRegistration.findUnique({
      where: { id: targetId },
    });
    if (!reg) return { status: "skipped", skippedReason: "Registration not found" };

    const hasAllotment = Boolean(
      (reg.allottedCommittee && reg.allottedCommittee.trim()) ||
      (reg.allottedPortfolio && reg.allottedPortfolio.trim())
    );
    const isPaid = reg.paymentStatus === "Verified";

    if (!hasAllotment || !isPaid) {
      return {
        status: "skipped",
        skippedReason: `Criteria not met. hasAllotment=${hasAllotment}, isPaid=${isPaid}`,
      };
    }

    if (reg.allotmentEmailSent && !forceResend) {
      return { status: "skipped", skippedReason: "Email already sent previously" };
    }

    // Generate token if it doesn't exist
    let trackingToken = reg.trackingToken;
    if (!trackingToken) {
      trackingToken = randomUUID();
      await prisma.individualRegistration.update({
        where: { id: targetId },
        data: { trackingToken },
      });
    }

    const res = await sendAllotmentAndPaymentEmail({
      to: reg.email,
      name: reg.name,
      publicId: reg.publicId,
      trackingToken,
      committee: reg.allottedCommittee || "N/A",
      portfolio: reg.allottedPortfolio || "N/A",
      targetType: "individual"
    });

    if (res.status === "sent" || res.status === "sent-test") {
      await prisma.individualRegistration.update({
        where: { id: targetId },
        data: {
          allotmentEmailSent: true,
          allotmentEmailSentAt: new Date(),
        },
      });
    }
    return res;
  } else {
    // DelegationDelegate
    const del = await prisma.delegationDelegate.findUnique({
      where: { id: targetId },
      include: { delegation: true },
    });
    if (!del) return { status: "skipped", skippedReason: "Delegate not found" };

    const hasAllotment = Boolean(
      (del.allottedCommittee && del.allottedCommittee.trim()) ||
      (del.allottedPortfolio && del.allottedPortfolio.trim())
    );
    const isPaid = del.delegation.paymentStatus === "Verified";

    if (!hasAllotment || !isPaid) {
      return {
        status: "skipped",
        skippedReason: `Criteria not met. hasAllotment=${hasAllotment}, isPaid=${isPaid}`,
      };
    }

    if (del.allotmentEmailSent && !forceResend) {
      return { status: "skipped", skippedReason: "Email already sent previously" };
    }

    if (!del.email) {
      return { status: "skipped", skippedReason: "Delegate email address is missing" };
    }

    // Generate token if it doesn't exist
    let trackingToken = del.trackingToken;
    if (!trackingToken) {
      trackingToken = randomUUID();
      await prisma.delegationDelegate.update({
        where: { id: targetId },
        data: { trackingToken },
      });
    }

    const res = await sendAllotmentAndPaymentEmail({
      to: del.email,
      name: del.name,
      publicId: del.publicId,
      trackingToken,
      committee: del.allottedCommittee || "N/A",
      portfolio: del.allottedPortfolio || "N/A",
      targetType: "delegate"
    });

    if (res.status === "sent" || res.status === "sent-test") {
      await prisma.delegationDelegate.update({
        where: { id: targetId },
        data: {
          allotmentEmailSent: true,
          allotmentEmailSentAt: new Date(),
        },
      });
    }
    return res;
  }
}
