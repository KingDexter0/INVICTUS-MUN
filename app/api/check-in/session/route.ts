import { NextResponse } from "next/server";
import { createCheckInToken, setCheckInCookie } from "../../../../lib/checkin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { passcode } = await request.json();
    const expected = process.env.CHECKIN_PASSCODE;

    if (!expected) {
      return NextResponse.json({ error: "Check-in passcode is not configured." }, { status: 503 });
    }

    if (!passcode || passcode !== expected) {
      return NextResponse.json({ error: "Invalid check-in passcode." }, { status: 401 });
    }

    setCheckInCookie(createCheckInToken());
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not start check-in session." }, { status: 500 });
  }
}
