import { NextResponse } from "next/server";
import { assertAdmin } from "../../../../lib/admin";
import { prisma } from "../../../../lib/prisma";
import { operationsEmitter } from "../../../../lib/events";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    assertAdmin();

    const announcement = await prisma.announcement.findUnique({
      where: { id: params.id }
    });

    if (!announcement) {
      return NextResponse.json({ error: "Announcement not found." }, { status: 404 });
    }

    await prisma.announcement.delete({
      where: { id: params.id }
    });

    operationsEmitter.emit("update", {
      type: "operations:refresh-needed",
      data: { reason: "announcement-deleted" }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Could not delete announcement." }, { status: 500 });
  }
}
