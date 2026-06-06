import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { assertAdmin, getAdminEmailFromToken } from "../../../../../lib/admin";
import { prisma } from "../../../../../lib/prisma";
import { serializeRegistration } from "../../../../../lib/registrations";
import { operationsEmitter } from "../../../../../lib/events";

export const dynamic = "force-dynamic";

function hashOtp(otp: string) {
  return createHash("sha256").update(otp).digest("hex");
}

function delegateDetails(registration: any) {
  return {
    id: registration.publicId,
    publicId: registration.publicId,
    name: registration.name,
    email: registration.email,
    committee: registration.allottedCommittee || registration.committee1 || null,
    portfolio: registration.allottedPortfolio || registration.portfolio1 || null,
    paymentStatus: registration.paymentStatus,
    registrationStatus: registration.registrationStatus,
    allotmentStatus: registration.allotmentStatus
  };
}

export async function POST(request: Request) {
  try {
    // 1. Validate the requesting admin/session
    try {
      assertAdmin();
    } catch {
      return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    }

    const { delegateId, otp } = await request.json();
    const cleanDelegateId = String(delegateId || "").trim();
    const cleanOtp = String(otp || "").trim();

    if (!cleanDelegateId || !cleanOtp) {
      return NextResponse.json({ error: "Delegate ID and OTP are required." }, { status: 400 });
    }

    // 2. Find the latest unused OTP for that delegate
    const latestOtp = await prisma.checkInOtp.findFirst({
      where: {
        delegateId: cleanDelegateId,
        used: false
      },
      orderBy: { createdAt: "desc" }
    });

    // Requirement 13: If OTP is wrong/not found, show error
    if (!latestOtp) {
      return NextResponse.json({ error: "Invalid OTP. Please try again." }, { status: 400 });
    }

    // Hash and verify OTP code
    const inputHash = hashOtp(cleanOtp);
    if (latestOtp.otpHash !== inputHash) {
      return NextResponse.json({ error: "Invalid OTP. Please try again." }, { status: 400 });
    }

    // Requirement 14: If OTP is expired, show expired error
    if (latestOtp.expiresAt < new Date()) {
      return NextResponse.json({ error: "OTP expired. Please request a new OTP." }, { status: 400 });
    }

    // 3. Mark OTP as used
    await prisma.checkInOtp.update({
      where: { id: latestOtp.id },
      data: { used: true }
    });

    // 4. Mark delegate as checked in and store who completed it
    const checkedInBy = getAdminEmailFromToken() || "Admin";

    const updatedDelegate = await prisma.registration.update({
      where: { publicId: cleanDelegateId },
      data: {
        checkedIn: true,
        checkedInAt: new Date(),
        checkedInBy
      }
    });

    // Requirement 18: Log who completed the check-in
    console.log(`[CHECK-IN OTP VERIFIED] Delegate ${cleanDelegateId} checked in successfully by admin: ${checkedInBy}`);

    operationsEmitter.emit("update", {
      type: "delegate:checked-in",
      data: {
        publicId: cleanDelegateId,
        checkedInAt: updatedDelegate.checkedInAt?.toISOString() || null,
        checkedInBy,
        registration: serializeRegistration(updatedDelegate)
      }
    });

    return NextResponse.json({
      success: true,
      message: "Delegate checked in.",
      delegate: delegateDetails(updatedDelegate),
      checkedInAt: updatedDelegate.checkedInAt?.toISOString() || null,
      registration: serializeRegistration(updatedDelegate)
    });
  } catch (error) {
    console.error("Verify OTP failed:", error);
    return NextResponse.json({ error: "Could not verify OTP." }, { status: 500 });
  }
}
