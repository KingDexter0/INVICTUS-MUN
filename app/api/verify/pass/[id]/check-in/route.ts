import { NextResponse } from "next/server";
import type { Registration } from "@prisma/client";
import { createHash } from "node:crypto";
import { assertCheckInAccess } from "../../../../../../lib/checkin";
import { prisma } from "../../../../../../lib/prisma";
import { serializeRegistration } from "../../../../../../lib/registrations";
import { getAdminEmailFromToken } from "../../../../../../lib/admin";
import { sendCheckInOtpEmail } from "../../../../../../lib/email";
import { operationsEmitter } from "../../../../../../lib/events";

export const dynamic = "force-dynamic";

function hashOtp(otp: string) {
  return createHash("sha256").update(otp).digest("hex");
}

function delegateDetails(registration: Registration) {
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

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    assertCheckInAccess();

    const registration = await prisma.registration.findUnique({
      where: { publicId: params.id }
    });

    if (!registration) {
      return NextResponse.json(
        { success: false, status: "INVALID", message: "Invalid QR code", error: "Invalid QR code" },
        { status: 404 }
      );
    }

    if (registration.allotmentStatus !== "Allotted") {
      const message = "This pass is not valid for check-in because allotment has not been released.";
      return NextResponse.json(
        {
          success: false,
          status: "INVALID",
          message,
          error: message,
          delegate: delegateDetails(registration),
          registration: serializeRegistration(registration)
        },
        { status: 400 }
      );
    }

    if (registration.checkedIn) {
      return NextResponse.json(
        {
          success: false,
          status: "ALREADY_CHECKED_IN",
          message: "Already checked in",
          error: "Already checked in",
          delegate: delegateDetails(registration),
          checkedInAt: registration.checkedInAt?.toISOString() || null,
          registration: serializeRegistration(registration)
        },
        { status: 400 }
      );
    }

    // Read body
    const body = await request.json().catch(() => null);
    const otp = body?.otp ? String(body.otp).trim() : null;

    if (!otp) {
      // --- OTP Request Flow ---
      // Fetch all added admin emails
      const admins = await prisma.adminUser.findMany({
        select: { email: true }
      });
      const adminEmails = admins.map((admin) => admin.email).filter(Boolean);

      if (adminEmails.length === 0) {
        return NextResponse.json(
          { success: false, error: "No admin emails found. Please add an admin email before using OTP check-in." },
          { status: 400 }
        );
      }

      // Cooldown check (30 seconds)
      const recentOtp = await prisma.checkInOtp.findFirst({
        where: {
          delegateId: params.id,
          used: false,
          createdAt: { gt: new Date(Date.now() - 30 * 1000) }
        }
      });

      if (recentOtp) {
        return NextResponse.json(
          { success: false, error: "Please wait 30 seconds before requesting a new OTP." },
          { status: 429 }
        );
      }

      // Generate secure 6-digit numeric OTP
      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry

      await prisma.checkInOtp.create({
        data: {
          delegateId: params.id,
          otpHash: hashOtp(generatedOtp),
          expiresAt,
          used: false
        }
      });

      // Log who initiated the request
      let checkedInBy = "Staff";
      try {
        const adminEmail = getAdminEmailFromToken();
        if (adminEmail) {
          checkedInBy = adminEmail;
        }
      } catch {}
      console.log(`[CHECK-IN OTP REQUEST] Delegate ${params.id} initiated by admin: ${checkedInBy}`);

      // Send OTP to all admins
      await Promise.all(
        adminEmails.map((email) =>
          sendCheckInOtpEmail(
            email,
            registration.name,
            registration.publicId,
            registration.allottedCommittee || registration.committee1 || "Not assigned",
            registration.institution || "Independent delegate",
            generatedOtp
          )
        )
      );

      return NextResponse.json({
        success: true,
        status: "OTP_SENT",
        message: "OTP has been sent to all admins",
        delegate: delegateDetails(registration)
      });
    } else {
      // --- OTP Verification Flow ---
      const latestOtp = await prisma.checkInOtp.findFirst({
        where: {
          delegateId: params.id,
          used: false
        },
        orderBy: { createdAt: "desc" }
      });

      if (!latestOtp) {
        return NextResponse.json({ success: false, error: "Invalid OTP. Please try again." }, { status: 400 });
      }

      const inputHash = hashOtp(otp);
      if (latestOtp.otpHash !== inputHash) {
        return NextResponse.json({ success: false, error: "Invalid OTP. Please try again." }, { status: 400 });
      }

      if (latestOtp.expiresAt < new Date()) {
        return NextResponse.json({ success: false, error: "OTP expired. Please request a new OTP." }, { status: 400 });
      }

      // Mark OTP as used
      await prisma.checkInOtp.update({
        where: { id: latestOtp.id },
        data: { used: true }
      });

      let checkedInBy = "Staff";
      try {
        const adminEmail = getAdminEmailFromToken();
        if (adminEmail) {
          checkedInBy = adminEmail;
        }
      } catch {}

      const updated = await prisma.registration.update({
        where: { publicId: params.id },
        data: {
          checkedIn: true,
          checkedInAt: new Date(),
          checkedInBy
        }
      });

      console.log(`[CHECK-IN OTP VERIFIED] Delegate ${params.id} checked in successfully by admin: ${checkedInBy}`);

      operationsEmitter.emit("update", {
        type: "delegate:checked-in",
        data: {
          publicId: params.id,
          checkedInAt: updated.checkedInAt?.toISOString() || null,
          checkedInBy,
          registration: serializeRegistration(updated)
        }
      });

      return NextResponse.json({
        success: true,
        status: "CHECKED_IN",
        message: "Delegate checked in.",
        delegate: delegateDetails(updated),
        checkedInAt: updated.checkedInAt?.toISOString() || null,
        registration: serializeRegistration(updated)
      });
    }
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json(
        {
          success: false,
          status: "UNAUTHORIZED",
          message: "Check-in access required. Enter the check-in passcode to continue.",
          error: "Check-in access required. Enter the check-in passcode to continue."
        },
        { status: 401 }
      );
    }
    console.error(error);
    return NextResponse.json(
      { success: false, status: "ERROR", message: "Could not check in delegate.", error: "Could not check in delegate." },
      { status: 500 }
    );
  }
}
