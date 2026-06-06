import { NextResponse } from "next/server";
import { assertAdmin } from "../../../../lib/admin";
import { sendAdminTestEmail } from "../../../../lib/mail";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    assertAdmin();
    const to = process.env.EMAIL_TEST_MODE === "true"
      ? process.env.TEST_EMAIL_TO
      : process.env.TEST_EMAIL_TO || process.env.FROM_EMAIL;

    if (!to) {
      return NextResponse.json({ error: "Set TEST_EMAIL_TO before sending a test email." }, { status: 400 });
    }

    const result = await sendAdminTestEmail(to);
    return NextResponse.json({ emailStatus: result.status });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Could not send test email." }, { status: 500 });
  }
}

