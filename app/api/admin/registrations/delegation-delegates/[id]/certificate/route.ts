import { NextResponse } from "next/server";
import { assertAdmin } from "../../../../../../../lib/admin";
import { prisma } from "../../../../../../../lib/prisma";
import { operationsEmitter } from "../../../../../../../lib/events";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    assertAdmin();
    const { title } = await request.json().catch(() => ({}));
    const certificateTitle = String(title || "Certificate of Participation").trim();

    const delegate = await prisma.delegationDelegate.findUnique({
      where: { publicId: params.id }
    });

    if (!delegate) {
      return NextResponse.json({ error: "Delegate not found" }, { status: 404 });
    }

    if (!delegate.checkedIn) {
      return NextResponse.json({ error: "Certificate can only be released after delegate check-in." }, { status: 403 });
    }

    const certificate = await prisma.delegateCertificate.create({
      data: {
        delegateId: delegate.id,
        title: certificateTitle,
        certificateNo: `CERT-${delegate.publicId}-${Date.now().toString(36).toUpperCase()}`
      }
    });

    await prisma.delegationDelegate.update({
      where: { id: delegate.id },
      data: {
        certificateReleased: true,
        certificateReleasedAt: new Date(),
        certificateUrl: `/certificates/${certificate.certificateNo}`
      }
    });

    operationsEmitter.emit("update", {
      type: "certificate:updated",
      data: {
        publicId: delegate.publicId,
        certificateReleased: true,
        certificateUrl: `/certificates/${certificate.certificateNo}`
      }
    });

    return NextResponse.json({ success: true, certificate });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Could not issue certificate." }, { status: 500 });
  }
}
