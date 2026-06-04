import { NextResponse } from "next/server";
import { assertCheckInAccess } from "../../../../../../lib/checkin";
import { prisma } from "../../../../../../lib/prisma";
import { serializeRegistration } from "../../../../../../lib/registrations";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    assertCheckInAccess();

    const registration = await prisma.registration.findUnique({
      where: { publicId: params.id }
    });

    if (!registration) {
      return NextResponse.json({ error: "Pass not found." }, { status: 404 });
    }

    if (registration.allotmentStatus !== "Allotted") {
      return NextResponse.json({ error: "This pass is not valid for check-in because allotment has not been released." }, { status: 400 });
    }

    if (registration.checkedIn) {
      return NextResponse.json(
        {
          error: "Delegate is already checked in.",
          registration: serializeRegistration(registration)
        },
        { status: 409 }
      );
    }

    const updated = await prisma.registration.update({
      where: { publicId: params.id },
      data: {
        checkedIn: true,
        checkedInAt: new Date()
      }
    });

    return NextResponse.json({ registration: serializeRegistration(updated) });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Check-in access required. Enter the check-in passcode to continue." }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Could not check in delegate." }, { status: 500 });
  }
}
