import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { assertAdmin, getAdminEmailFromToken } from "../../../../../lib/admin";
import { prisma } from "../../../../../lib/prisma";
import { serializeIndividualRegistration, serializeDelegationDelegate } from "../../../../../lib/registrations";
import { operationsEmitter } from "../../../../../lib/events";

export const dynamic = "force-dynamic";

function hashOtp(otp: string) {
  return createHash("sha256").update(otp).digest("hex");
}

function delegateDetails(reg: any) {
  return {
    id: reg.publicId,
    publicId: reg.publicId,
    name: reg.name,
    email: reg.email,
    committee: reg.allottedCommittee || reg.committee1 || null,
    portfolio: reg.allottedPortfolio || reg.portfolio1 || null,
    paymentStatus: reg.paymentStatus,
    registrationStatus: reg.registrationStatus,
    allotmentStatus: reg.allotmentStatus
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

    // 4. Mark delegate as checked in in the correct table
    const checkedInBy = getAdminEmailFromToken() || "Admin";
    const updateData = { checkedIn: true, checkedInAt: new Date(), checkedInBy };

    let updatedDelegate: any = null;
    let serialized: any = null;

    const individual = await prisma.individualRegistration.findUnique({
      where: { publicId: cleanDelegateId }
    });

    if (individual) {
      updatedDelegate = await prisma.individualRegistration.update({
        where: { publicId: cleanDelegateId },
        data: updateData
      });
      serialized = serializeIndividualRegistration(updatedDelegate);
    } else {
      const del = await prisma.delegationDelegate.findUnique({
        where: { publicId: cleanDelegateId }
      });
      if (del) {
        const updated = await prisma.delegationDelegate.update({
          where: { publicId: cleanDelegateId },
          data: updateData
        });
        serialized = serializeDelegationDelegate(updated);
        updatedDelegate = updated;
      }
    }

    if (!updatedDelegate) {
      return NextResponse.json({ error: "Delegate not found." }, { status: 404 });
    }

    // Requirement 18: Log who completed the check-in
    console.log(`[CHECK-IN OTP VERIFIED] Delegate ${cleanDelegateId} checked in successfully by admin: ${checkedInBy}`);

    operationsEmitter.emit("update", {
      type: "delegate:checked-in",
      data: {
        publicId: cleanDelegateId,
        checkedInAt: updateData.checkedInAt.toISOString(),
        checkedInBy,
        registration: serialized
      }
    });

    return NextResponse.json({
      success: true,
      message: "Delegate checked in.",
      delegate: delegateDetails(updatedDelegate),
      checkedInAt: updateData.checkedInAt.toISOString(),
      registration: serialized
    });
  } catch (error) {
    console.error("Verify OTP failed:", error);
    return NextResponse.json({ error: "Could not verify OTP." }, { status: 500 });
  }
}
