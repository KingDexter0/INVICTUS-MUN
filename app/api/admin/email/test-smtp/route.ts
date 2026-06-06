import { NextResponse } from "next/server";
import { assertAdmin, getAdminEmailFromToken } from "../../../../../lib/admin";
import { sendEmail } from "../../../../../lib/mail";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // Require admin authentication
    assertAdmin();

    const body = await request.json().catch(() => ({}));
    let toEmail = body?.email;

    if (!toEmail) {
      try {
        toEmail = getAdminEmailFromToken();
      } catch {}
    }

    // Fallbacks
    if (!toEmail) {
      toEmail = process.env.TEST_EMAIL_TO || process.env.SMTP_USER;
    }

    if (!toEmail) {
      return NextResponse.json({ error: "No recipient email address available. Provide an email or set TEST_EMAIL_TO." }, { status: 400 });
    }

    console.log(`[SMTP TEST] Requesting SMTP test mail to: ${toEmail}`);

    await sendEmail({
      to: toEmail,
      subject: "Invictus MUN: SMTP Email Connection Test",
      html: `
        <div style="margin:0;padding:0;background:#ffffff;font-family:Arial,sans-serif;color:#181424">
          <div style="max-width:620px;margin:0 auto;padding:28px;border:1px solid #e9e5f0;border-radius:16px;">
            <div style="border-left:5px solid #6d43c8;padding-left:16px;margin-bottom:24px">
              <p style="margin:0;color:#6d43c8;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">Invictus MUN</p>
              <h1 style="margin:8px 0 0;font-size:28px;line-height:1.2">SMTP Connection Success</h1>
            </div>
            <p style="font-size:16px;line-height:1.7">Hello,</p>
            <p style="font-size:16px;line-height:1.7">This test email confirms that SMTP + Nodemailer integration is configured correctly and successfully connected to the Invictus MUN portal.</p>
            <p style="margin-top:28px;color:#706b7e;font-size:13px;line-height:1.6;border-top:1px solid #eee;padding-top:16px">This is an automated test update from Invictus MUN.</p>
          </div>
        </div>
      `,
    });

    return NextResponse.json({ success: true, message: `Test email sent to ${toEmail}` });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    }
    console.error("[SMTP TEST ERROR]", error);
    return NextResponse.json({ error: (error as Error).message || "Could not send test email." }, { status: 500 });
  }
}
