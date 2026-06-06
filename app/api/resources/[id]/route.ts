import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { assertAdmin } from "../../../../lib/admin";
import { prisma } from "../../../../lib/prisma";
import { operationsEmitter } from "../../../../lib/events";

export const dynamic = "force-dynamic";

function isVercelBlobUrl(url: string) {
  try {
    const hostname = new URL(url).hostname;
    return hostname.endsWith("vercel-storage.com") || hostname.endsWith("public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    assertAdmin();

    const resource = await prisma.resource.findUnique({
      where: { id: params.id }
    });

    if (!resource) {
      return NextResponse.json({ error: "Resource not found." }, { status: 404 });
    }

    // Delete database record first
    await prisma.resource.delete({
      where: { id: params.id }
    });

    // Delete from Vercel Blob storage
    if (isVercelBlobUrl(resource.fileUrl)) {
      await del(resource.fileUrl).catch((error: unknown) => {
        console.error("[blob] Could not delete resource from Vercel Blob:", error);
      });
    }

    operationsEmitter.emit("update", {
      type: "operations:refresh-needed",
      data: { reason: "resource-deleted" }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Could not delete resource." }, { status: 500 });
  }
}
