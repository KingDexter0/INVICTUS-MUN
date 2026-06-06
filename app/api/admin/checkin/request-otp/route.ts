import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { assertAdmin, getAdminEmailFromToken } from "../../../../../lib/admin";
import { prisma } from "../../../../../lib/prisma";
import { sendCheckInOtpEmail } from "../../../../../lib/email";

export const dynamic = "force-dynamic";

function hashOtp(otp: string) {
  return createHash("sha256").update(otp).digest("hex");
}

export async function POST(request: Request) {
  try {
    // 1. Validate the requesting admin/session
    try {
      assertAdmin();
    } catch {
      return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    }

    const { delegateId } = await request.json();
    const cleanDelegateId = String(delegateId || "").trim();

    if (!cleanDelegateId) {
      return NextResponse.json({ error: "Delegate ID is required." }, { status: 400 });
    }

    // 2. Find the delegate
    const delegate = await prisma.registration.findUnique({
      where: { publicId: cleanDelegateId }
    });

    if (!delegate) {
      return NextResponse.json({ error: "Delegate registration not found." }, { status: 404 });
    }

    // Requirement 19: If already checked in, block check-in
    if (delegate.checkedIn) {
      return NextResponse.json({ error: "Already checked in" }, { status: 400 });
    }

    // 3. Find all added admin emails
    const admins = await prisma.adminUser.findMany({
      select: { email: true }
    });
    const adminEmails = admins.map((admin) => admin.email).filter(Boolean);

    // Requirement 20: If no admins are added, block check-in
    if (adminEmails.length === 0) {
      return NextResponse.json(
        { error: "No admin emails found. Please add an admin email before using OTP check-in." },
        { status: 400 }
      );
    }

    // Requirement 15/16: Rate limit / Cooldown of 30 seconds to prevent spam
    const recentOtp = await prisma.checkInOtp.findFirst({
      where: {
        delegateId: cleanDelegateId,
        used: false,
        createdAt: { gt: new Date(Date.now() - 30 * 1000) }
      }
    });

    if (recentOtp) {
      return NextResponse.json(
        { error: "Please wait 30 seconds before requesting a new OTP." },
        { status: 429 }
      );
    }

    // 4. Generate secure 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = hashOtp(otp);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry

    // 5. Store OTP securely on the backend
    await prisma.checkInOtp.create({
      data: {
        delegateId: cleanDelegateId,
        otpHash,
        expiresAt,
        used: false
      }
    });

    // Requirement 17: Log who initiated the check-in OTP request
    const adminEmail = getAdminEmailFromToken() || "Unknown Admin";
    console.log(`[CHECK-IN OTP REQUEST] Delegate ${cleanDelegateId} initiated by admin: ${adminEmail}`);

    // 6. Send OTP email to all admin emails
    await Promise.all(
      adminEmails.map((email) =>
        sendCheckInOtpEmail(
          email,
          delegate.name,
          delegate.publicId,
          delegate.allottedCommittee || delegate.committee1 || "Not assigned",
          delegate.institution || "Independent delegate",
          otp
        )
      )
    );

    return NextResponse.json({
      success: true,
      message: "OTP has been sent to all admins"
    });
  } catch (error) {
    console.error("Request OTP failed:", error);
    return NextResponse.json({ error: "Could not request OTP." }, { status: 500 });
  }
}
