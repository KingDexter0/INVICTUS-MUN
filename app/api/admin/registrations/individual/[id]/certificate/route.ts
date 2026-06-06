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

    const registration = await prisma.individualRegistration.findUnique({
      where: { publicId: params.id }
    });

    if (!registration) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }

    if (!registration.checkedIn) {
      return NextResponse.json({ error: "Certificate can only be released after delegate check-in." }, { status: 403 });
    }

    const certificate = await prisma.individualCertificate.create({
      data: {
        registrationId: registration.id,
        title: certificateTitle,
        certificateNo: `CERT-${registration.publicId}-${Date.now().toString(36).toUpperCase()}`
      }
    });

    const certificateUrl = getCertificateUrl(certificate.certificateNo, request);

    await prisma.individualRegistration.update({
      where: { id: registration.id },
      data: {
        certificateReleased: true,
        certificateReleasedAt: new Date(),
        certificateUrl
      }
    });

    // Send certificate email (non-blocking — never fail the certificate release on email error)
    try {
      await sendCertificateEmail({
        to: registration.email,
        name: registration.name,
        certificateNo: certificate.certificateNo,
        certificateUrl,
        targetType: "individual",
        targetId: registration.publicId
      });
    } catch (emailErr) {
      console.error("[Certificate] Failed to send certificate email:", emailErr);
    }

    operationsEmitter.emit("update", {
      type: "certificate:updated",
      data: {
        publicId: registration.publicId,
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
