import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { assertCheckInAccess } from "../../../../../../lib/checkin";
import { prisma } from "../../../../../../lib/prisma";
import { serializeIndividualRegistration, serializeDelegationDelegate, serializeRegistration } from "../../../../../../lib/registrations";
import { getAdminEmailFromToken } from "../../../../../../lib/admin";
import { sendCheckInOtpEmail } from "../../../../../../lib/mail";
import { operationsEmitter } from "../../../../../../lib/events";
import { resolveRegistrationByToken, NormalizedRegistration } from "../../../../../../lib/registration-resolver";

export const dynamic = "force-dynamic";

function hashOtp(otp: string) {
  return createHash("sha256").update(otp).digest("hex");
}

function delegateDetails(registration: NormalizedRegistration) {
  return {
    id: registration.publicId,
    publicId: registration.publicId,
    name: registration.fullName,
    email: registration.email,
    committee: registration.committee,
    portfolio: registration.portfolio,
    paymentStatus: registration.paymentStatus,
    registrationStatus: registration.registrationStatus,
    allotmentStatus: registration.allotmentStatus
  };
}

function getSerialized(record: any, targetType: "individual" | "delegationDelegate" | "legacy") {
  if (targetType === "individual") {
    return serializeIndividualRegistration(record);
  } else if (targetType === "delegationDelegate") {
    return serializeDelegationDelegate(record);
  } else {
    return serializeRegistration(record);
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    assertCheckInAccess();

    const registration = await resolveRegistrationByToken(params.id);

    if (!registration) {
      return NextResponse.json(
        { success: false, status: "INVALID", message: "Invalid QR code", error: "Invalid QR code" },
        { status: 404 }
      );
    }

    const isDelegation = registration.targetType === "delegationDelegate" || (registration.targetType === "legacy" && registration.delegationName);
    if (registration.allotmentStatus !== "Allotted" && !(isDelegation && registration.registrationStatus === "Approved")) {
      const message = "This pass is not valid for check-in because allotment has not been released or registration is not approved.";
      return NextResponse.json(
        {
          success: false,
          status: "INVALID",
          message,
          error: message,
          delegate: delegateDetails(registration),
          registration: registration
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
          registration: registration
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

      // Cooldown check (30 seconds) using publicId as the identifier
      const recentOtp = await prisma.checkInOtp.findFirst({
        where: {
          delegateId: registration.publicId,
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
          delegateId: registration.publicId,
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
      console.log(`[CHECK-IN OTP REQUEST] Delegate ${registration.publicId} initiated by admin: ${checkedInBy}`);

      // Send OTP to all admins
      await Promise.all(
        adminEmails.map((email) =>
          sendCheckInOtpEmail(
            email,
            registration.fullName,
            registration.publicId,
            registration.committee || "Not assigned",
            registration.school || "Independent delegate",
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
          delegateId: registration.publicId,
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

      let updatedRecord: any;
      const updateData = {
        checkedIn: true,
        checkedInAt: new Date(),
        checkedInBy
      };

      if (registration.targetType === "individual") {
        updatedRecord = await prisma.individualRegistration.update({
          where: { id: registration.id },
          data: updateData
        });
      } else if (registration.targetType === "delegationDelegate") {
        updatedRecord = await prisma.delegationDelegate.update({
          where: { id: registration.id },
          data: updateData
        });
      } else {
        updatedRecord = await prisma.registration.update({
          where: { id: registration.id },
          data: updateData
        });
      }

      console.log(`[CHECK-IN OTP VERIFIED] Delegate ${registration.publicId} checked in successfully by admin: ${checkedInBy}`);

      const serialized = getSerialized(updatedRecord, registration.targetType);

      operationsEmitter.emit("update", {
        type: "delegate:checked-in",
        data: {
          publicId: registration.publicId,
          checkedInAt: updateData.checkedInAt.toISOString(),
          checkedInBy,
          registration: serialized
        }
      });

      return NextResponse.json({
        success: true,
        status: "CHECKED_IN",
        message: "Delegate checked in.",
        delegate: {
          ...delegateDetails(registration),
          checkedIn: true,
          checkedInAt: updateData.checkedInAt.toISOString()
        },
        checkedInAt: updateData.checkedInAt.toISOString(),
        registration: serialized
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
