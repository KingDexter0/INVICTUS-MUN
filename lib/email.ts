import { Resend } from "resend";

type EmailStatus = {
  status: "sent" | "failed" | "skipped";
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
  return Boolean(process.env.RESEND_API_KEY && process.env.FROM_EMAIL);
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

async function sendEmail(to: string, subject: string, html: string): Promise<EmailStatus> {
  if (!configured()) {
    console.warn("Email skipped: Resend environment variables are not configured.");
    return { status: "skipped" };
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: process.env.FROM_EMAIL as string,
      to,
      subject,
      html
    });

    if (error) {
      console.error("Email failed", { to, subject, message: error.message });
      return { status: "failed" };
    }

    return { status: "sent" };
  } catch (error) {
    console.error("Email failed", { to, subject, message: error instanceof Error ? error.message : "Unknown error" });
    return { status: "failed" };
  }
}

export async function sendRegistrationEmail(input: RegistrationEmailInput) {
  return sendEmail(input.to, `Invictus MUN: ${input.heading}`, baseTemplate(input));
}

export async function sendResourceEmail(input: ResourceEmailInput) {
  const dashboardUrl = `${siteUrl()}${input.dashboardPath || "/dashboard"}`;
  return sendEmail(
    input.to,
    `Invictus MUN resource uploaded: ${input.title}`,
    `
      <div style="margin:0;padding:0;background:#ffffff;font-family:Arial,sans-serif;color:#181424">
        <div style="max-width:620px;margin:0 auto;padding:28px">
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
    `
  );
}
