import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { sendOtpEmail } from "../../../../lib/email";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    // Save to DB
    await prisma.checkInOtp.create({
      data: {
        otp,
        expiresAt
      }
    });

    // Fetch all admins
    const admins = await prisma.adminUser.findMany({
      select: { email: true }
    });

    const adminEmails = admins.map((admin) => admin.email).filter(Boolean);

    if (adminEmails.length === 0) {
      return NextResponse.json({ error: "No admin users found to send OTP." }, { status: 400 });
    }

    // Send email to all admins
    await Promise.all(
      adminEmails.map((email) => sendOtpEmail(email, otp))
    );

    return NextResponse.json({ success: true, message: `OTP sent successfully to admin email(s).` });
  } catch (error) {
    console.error("Failed to generate or send OTP:", error);
    return NextResponse.json({ error: "Could not send OTP." }, { status: 500 });
  }
}
