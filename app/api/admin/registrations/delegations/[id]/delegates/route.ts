import { NextResponse } from "next/server";
import { assertAdmin } from "../../../../../../../lib/admin";
import { prisma } from "../../../../../../../lib/prisma";
import { serializeDelegationDelegate } from "../../../../../../../lib/registrations";
import { operationsEmitter } from "../../../../../../../lib/events";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    assertAdmin();
    const delegation = await prisma.delegationRegistration.findUnique({
      where: { publicId: params.id }
    });

    if (!delegation) {
      return NextResponse.json({ error: "Delegation not found" }, { status: 404 });
    }

    const delegates = await prisma.delegationDelegate.findMany({
      where: { delegationId: delegation.id },
      include: { notes: { orderBy: { createdAt: "desc" } } },
      orderBy: { createdAt: "asc" }
    });

    return NextResponse.json({ delegates: delegates.map(serializeDelegationDelegate) });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Could not fetch delegates." }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    assertAdmin();
    const delegation = await prisma.delegationRegistration.findUnique({
      where: { publicId: params.id },
      include: { delegates: true }
    });

    if (!delegation) {
      return NextResponse.json({ error: "Delegation not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, email, phone, committee1, portfolio1 } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }

    const count = delegation.delegates.length;
    const publicId = `${delegation.publicId}-d${count + 1}`;

    const delegate = await prisma.delegationDelegate.create({
      data: {
        publicId,
        delegationId: delegation.id,
        name,
        email: email || null,
        phone: phone || null,
        committee1: committee1 || null,
        portfolio1: portfolio1 || null
      }
    });

    // Notify other admin panels about the change in the delegation's delegate list
    operationsEmitter.emit("update", {
      type: "operations:refresh-needed",
      data: { reason: "delegate-added", delegationId: delegation.publicId }
    });

    return NextResponse.json({ delegate: serializeDelegationDelegate(delegate) });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Could not create delegate." }, { status: 500 });
  }
}
