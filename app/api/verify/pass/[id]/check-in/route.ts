import { NextResponse } from "next/server";
import type { Registration } from "@prisma/client";
import { assertCheckInAccess } from "../../../../../../lib/checkin";
import { prisma } from "../../../../../../lib/prisma";
import { serializeRegistration } from "../../../../../../lib/registrations";

export const dynamic = "force-dynamic";

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

export async function POST(_request: Request, { params }: { params: { id: string } }) {
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
          message: "Delegate is already checked in.",
          error: "Delegate is already checked in.",
          delegate: delegateDetails(registration),
          checkedInAt: registration.checkedInAt?.toISOString() || null,
          registration: serializeRegistration(registration)
        }
      );
    }

    const updated = await prisma.registration.update({
      where: { publicId: params.id },
      data: {
        checkedIn: true,
        checkedInAt: new Date()
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
