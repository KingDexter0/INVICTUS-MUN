import { NextResponse } from "next/server";
import { assertAdmin, getAdminEmailFromToken } from "../../../../../../../lib/admin";
import { prisma } from "../../../../../../../lib/prisma";
import { serializeDelegationDelegate } from "../../../../../../../lib/registrations";
import { operationsEmitter } from "../../../../../../../lib/events";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    assertAdmin();
    const adminEmail = getAdminEmailFromToken() || "Admin";

    const delegate = await prisma.delegationDelegate.findUnique({
      where: { publicId: params.id }
    });

    if (!delegate) {
      return NextResponse.json({ error: "Delegate not found" }, { status: 404 });
    }

    if (delegate.checkedIn) {
      return NextResponse.json({ error: "Already checked in" }, { status: 400 });
    }

    const updated = await prisma.delegationDelegate.update({
      where: { id: delegate.id },
      data: {
        checkedIn: true,
        checkedInAt: new Date(),
        checkedInBy: adminEmail
      }
    });

    // Update parent checkedInCount
    await prisma.delegationRegistration.update({
      where: { id: delegate.delegationId },
      data: {
        checkedInCount: {
          increment: 1
        }
      }
    }).catch(console.error);

    operationsEmitter.emit("update", {
      type: "delegate:checked-in",
      data: {
        publicId: params.id,
        checkedInAt: updated.checkedInAt?.toISOString() || null,
        checkedInBy: adminEmail,
        registration: serializeDelegationDelegate(updated)
      }
    });

    return NextResponse.json({
      success: true,
      delegate: serializeDelegationDelegate(updated)
    });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Could not check in delegate." }, { status: 500 });
  }
}
