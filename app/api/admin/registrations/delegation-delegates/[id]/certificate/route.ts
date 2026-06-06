import { NextResponse } from "next/server";
import { assertAdmin } from "../../../../../../../lib/admin";
import { prisma } from "../../../../../../../lib/prisma";
import { operationsEmitter } from "../../../../../../../lib/events";
import { sendCertificateEmail } from "../../../../../../../lib/mail";
import { getCertificateUrl } from "../../../../../../../lib/url";

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

    const certificateUrl = getCertificateUrl(certificate.certificateNo, request);

    await prisma.delegationDelegate.update({
      where: { id: delegate.id },
      data: {
        certificateReleased: true,
        certificateReleasedAt: new Date(),
        certificateUrl
      }
    });

    // Send certificate email (non-blocking — never fail the certificate release on email error)
    if (delegate.email) {
      try {
        await sendCertificateEmail({
          to: delegate.email,
          name: delegate.name,
          certificateNo: certificate.certificateNo,
          certificateUrl,
          targetType: "delegate",
          targetId: delegate.publicId
        });
      } catch (emailErr) {
        console.error("[Certificate] Failed to send certificate email to delegate:", emailErr);
      }
    }

    operationsEmitter.emit("update", {
      type: "certificate:updated",
      data: {
        publicId: delegate.publicId,
        certificateReleased: true,
        certificateUrl
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
