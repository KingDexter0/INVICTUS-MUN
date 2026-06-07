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

    console.log(`[CHECK-IN VERIFIED] Delegate ${registration.publicId} checked in successfully by admin: ${checkedInBy}`);

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
