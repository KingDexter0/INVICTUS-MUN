import { NextResponse } from "next/server";
import { createCheckInToken, setCheckInCookie } from "../../../../lib/checkin";
import { prisma } from "../../../../lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { passcode } = await request.json();

    if (!passcode) {
      return NextResponse.json({ error: "Enter the check-in passcode or OTP." }, { status: 400 });
    }

    // 1. Check if it's the static passcode (if configured)
    const expectedPasscode = process.env.CHECKIN_PASSCODE;
    const isStaticPasscodeValid = expectedPasscode && passcode === expectedPasscode;

    // 2. Check if it's a valid database OTP
    let isOtpValid = false;
    if (!isStaticPasscodeValid) {
      const { createHash } = await import("node:crypto");
      const hashedPasscode = createHash("sha256").update(passcode).digest("hex");

      const activeOtp = await prisma.checkInOtp.findFirst({
        where: {
          delegateId: "STAFF_SESSION",
          otpHash: hashedPasscode,
          expiresAt: { gt: new Date() },
          used: false
        }
      });

      if (activeOtp) {
        isOtpValid = true;
        // Invalidate/delete the used OTP code
        await prisma.checkInOtp.update({
          where: { id: activeOtp.id },
          data: { used: true }
        }).catch(() => null);
      }
    }

    if (!isStaticPasscodeValid && !isOtpValid) {
      return NextResponse.json({ error: "Invalid or expired check-in passcode/OTP." }, { status: 401 });
    }

    setCheckInCookie(createCheckInToken());
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Check-in session error:", error);
    return NextResponse.json({ error: "Could not start check-in session." }, { status: 500 });
  }
}

