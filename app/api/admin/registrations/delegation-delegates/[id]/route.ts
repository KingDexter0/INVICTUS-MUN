import { NextResponse } from "next/server";
import { assertAdmin } from "../../../../../../lib/admin";
import { prisma } from "../../../../../../lib/prisma";
import { serializeDelegationDelegate } from "../../../../../../lib/registrations";
import { operationsEmitter } from "../../../../../../lib/events";

export const dynamic = "force-dynamic";

const allotmentStatuses = ["Not allotted", "Pending", "Allotted"];

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    assertAdmin();
    const body = await request.json();
    const patch: Record<string, any> = {};

    if (body.allotmentStatus && !allotmentStatuses.includes(String(body.allotmentStatus))) {
      return NextResponse.json({ error: "Choose a valid allotment status." }, { status: 400 });
    }
    if (body.allotmentStatus === "Allotted" && (!String(body.allottedCommittee || "").trim() || !String(body.allottedPortfolio || "").trim())) {
      return NextResponse.json({ error: "Add both allotted committee and portfolio before releasing allotment." }, { status: 400 });
    }

    for (const key of [
      "allotmentStatus",
      "allottedCommittee",
      "allottedPortfolio",
      "name",
      "email",
      "phone",
      "committee1",
      "portfolio1"
    ]) {
      if (key in body) patch[key] = body[key] === "" ? null : body[key];
    }

    const delegate = await prisma.delegationDelegate.update({
      where: { publicId: params.id },
      data: {
        ...patch,
        notes: body.note
          ? {
              create: {
                note: String(body.note)
              }
            }
          : undefined
      },
      include: { notes: { orderBy: { createdAt: "desc" } }, delegation: true }
    });

    // Notify other admins about the change
    operationsEmitter.emit("update", {
      type: "delegate:updated",
      data: {
        publicId: params.id,
        updatedFields: patch,
        registration: serializeDelegationDelegate(delegate)
      }
    });

    return NextResponse.json({ delegate: serializeDelegationDelegate(delegate) });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    }
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "This delegate no longer exists." }, { status: 404 });
    }
    console.error(error);
    return NextResponse.json({ error: "Could not update delegate." }, { status: 500 });
  }
}
