import { Resend } from "resend";

type EmailStatus = {
  status: "sent" | "sent-test" | "failed" | "skipped";
};

type RegistrationEmailInput = {
  to: string;
  name: string;
  publicId: string;
  heading: string;
  action: string;
  dashboardPath?: string;
  details?: Array<[string, string | null | undefined]>;
};

type ResourceEmailInput = {
  to: string;
  name: string;
  title: string;
  category: string;
  accessLevel: string;
  dashboardPath?: string;
};

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:4173";
}

function configured() {
  if (isTestMode()) return Boolean(process.env.RESEND_API_KEY && process.env.TEST_EMAIL_TO);
  return Boolean(process.env.RESEND_API_KEY && process.env.FROM_EMAIL);
}

function isTestMode() {
  return process.env.EMAIL_TEST_MODE === "true";
}

function fromEmail() {
  if (isTestMode()) return process.env.FROM_EMAIL || "Invictus MUN <onboarding@resend.dev>";
  return process.env.FROM_EMAIL as string;
}

function testModeNotice(to: string, trigger: string) {
  if (!isTestMode()) return "";
  return `
    <div style="margin:0 0 18px;padding:12px;border:1px solid #e9d8a6;border-radius:12px;background:#fff8e6;color:#6f4f00">
      <strong>Resend test mode</strong>
      <p style="margin:8px 0 0">Original intended recipient: ${to}</p>
      <p style="margin:6px 0 0">Trigger: ${trigger}</p>
    </div>
  `;
}

function baseTemplate({ heading, name, publicId, action, dashboardPath = "/dashboard", details = [] }: RegistrationEmailInput) {
  const dashboardUrl = `${siteUrl()}${dashboardPath}`;
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

async function sendEmail(to: string, subject: string, html: string, trigger = subject, bypassTestMode = false): Promise<EmailStatus> {
  if (!configured()) {
    console.warn("Email skipped: Resend environment variables are not configured.");
    return { status: "skipped" };
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const actualTo = (isTestMode() && !bypassTestMode) ? process.env.TEST_EMAIL_TO as string : to;
    const finalHtml = (isTestMode() && !bypassTestMode) ? html.replace(testModeNotice("", trigger), testModeNotice(to, trigger)) : html;
    const { error } = await resend.emails.send({
      from: fromEmail(),
      to: actualTo,
      subject,
      html: finalHtml
    });

    if (error) {
      console.error("Email failed", { to: actualTo, intendedTo: to, subject, message: error.message });
      return { status: "failed" };
    }

    return { status: isTestMode() ? "sent-test" : "sent" };
  } catch (error) {
    console.error("Email failed", { to, subject, message: error instanceof Error ? error.message : "Unknown error" });
    return { status: "failed" };
  }
}

export async function sendRegistrationEmail(input: RegistrationEmailInput) {
  return sendEmail(input.to, `Invictus MUN: ${input.heading}`, baseTemplate(input), input.heading);
}

export async function sendResourceEmail(input: ResourceEmailInput) {
  const dashboardUrl = `${siteUrl()}${input.dashboardPath || "/dashboard"}`;
  return sendEmail(
    input.to,
    `Invictus MUN resource uploaded: ${input.title}`,
    `
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
    "Resource uploaded"
  );
}

export async function sendAdminTestEmail(to: string) {
  return sendEmail(
    to,
    "Invictus MUN test email",
    `
      <div style="margin:0;padding:0;background:#ffffff;font-family:Arial,sans-serif;color:#181424">
        <div style="max-width:620px;margin:0 auto;padding:28px">
          ${testModeNotice("", "Admin test email")}
          <div style="border-left:5px solid #6d43c8;padding-left:16px;margin-bottom:24px">
            <p style="margin:0;color:#6d43c8;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">Invictus MUN</p>
            <h1 style="margin:8px 0 0;font-size:28px;line-height:1.2">Email test successful</h1>
          </div>
          <p style="font-size:16px;line-height:1.7">This confirms Resend is connected to the Invictus MUN admin portal.</p>
        </div>
      </div>
    `,
    "Admin test email"
  );
}

export async function sendOtpEmail(to: string, otp: string) {
  return sendEmail(
    to,
    "Invictus MUN: Check-In OTP",
    `
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
    "Check-In OTP",
    true
  );
}

export async function sendCheckInOtpEmail(
  to: string,
  delegateName: string,
  delegateId: string,
  committee: string,
  institution: string,
  otp: string
) {
  return sendEmail(
    to,
    "Invictus MUN: Delegate Check-In OTP",
    `
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
    "Delegate Check-In OTP",
    true
  );
}


