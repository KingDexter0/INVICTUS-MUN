import { NextResponse } from "next/server";
import { assertAdmin, getAdminEmailFromToken } from "../../../../../../../lib/admin";
import { prisma } from "../../../../../../../lib/prisma";
import { serializeIndividualRegistration } from "../../../../../../../lib/registrations";
import { operationsEmitter } from "../../../../../../../lib/events";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    assertAdmin();
    const adminEmail = getAdminEmailFromToken() || "Admin";

    const registration = await prisma.individualRegistration.findUnique({
      where: { publicId: params.id }
    });

    if (!registration) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }

    if (registration.checkedIn) {
      return NextResponse.json({ error: "Already checked in" }, { status: 400 });
    }

    const updated = await prisma.individualRegistration.update({
      where: { id: registration.id },
      data: {
        checkedIn: true,
        checkedInAt: new Date(),
        checkedInBy: adminEmail
      }
    });

    operationsEmitter.emit("update", {
      type: "delegate:checked-in",
      data: {
        publicId: params.id,
        checkedInAt: updated.checkedInAt?.toISOString() || null,
        checkedInBy: adminEmail,
        registration: serializeIndividualRegistration(updated)
      }
    });

    return NextResponse.json({
      success: true,
      registration: serializeIndividualRegistration(updated)
    });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Could not check in delegate." }, { status: 500 });
  }
}
