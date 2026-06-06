import { NextResponse } from "next/server";
import { assertAdmin, getAdminEmailFromToken } from "../../../../../lib/admin";
import { sendAdminTestEmail, verifySmtpConnection } from "../../../../../lib/mail";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertAdmin();
    
    // 1. Verify SMTP connection
    try {
      await verifySmtpConnection();
    } catch (err) {
      console.error("SMTP verification failed during test:", err);
      return NextResponse.json({
        success: false,
        error: "SMTP authentication failed or SMTP config missing: " + (err as Error).message
      }, { status: 400 });
    }

    // 2. Parse target recipient
    const body = await request.json().catch(() => ({}));
    let recipient = body.to || "";
    
    if (!recipient) {
      try {
        recipient = getAdminEmailFromToken() || "";
      } catch {}
    }
    
    if (!recipient) {
      recipient = process.env.TEST_EMAIL_TO || process.env.SMTP_USER || "";
    }

    if (!recipient) {
      return NextResponse.json({
        success: false,
        error: "No recipient email provided, and no fallback recipient could be found."
      }, { status: 400 });
    }

    // 3. Send the test email
    await sendAdminTestEmail(recipient);

    return NextResponse.json({
      success: true,
      message: `SMTP test email sent successfully to ${recipient}`
    });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ success: false, error: "Admin access required." }, { status: 401 });
    }
    console.error("Test SMTP route error:", error);
    return NextResponse.json({
      success: false,
      error: "SMTP execution failed: " + (error as Error).message
    }, { status: 500 });
  }
}
