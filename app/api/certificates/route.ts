import { NextResponse } from "next/server";
import { assertAdmin } from "../../../lib/admin";
import { prisma } from "../../../lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    assertAdmin();
    const certificates = await prisma.certificate.findMany({ include: { registration: true }, orderBy: { issuedAt: "desc" } });
    return NextResponse.json({ certificates });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    console.error(error);
    return NextResponse.json({ error: "Could not load certificates." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    assertAdmin();
    const { publicId, title } = await request.json();
    const registration = await prisma.registration.findUnique({ where: { publicId: String(publicId || "").trim() } });
    if (!registration) return NextResponse.json({ error: "Registration not found." }, { status: 404 });

    const certificateTitle = String(title || "Certificate of Participation").trim();

    // Enforce check-in validation for certificate release
    if (!registration.checkedIn) {
      return NextResponse.json(
        { error: "Certificate can only be released after delegate check-in." },
        { status: 403 }
      );
    }

    // Check-in and status verification for Certificate of Participation
    if (certificateTitle === "Certificate of Participation") {
      if (!registration.checkedInAt) {
        return NextResponse.json({ error: "Delegate has not checked in." }, { status: 400 });
      }
      if (registration.registrationStatus !== "Approved") {
        return NextResponse.json({ error: "Delegate registration is not approved." }, { status: 400 });
      }
      if (registration.paymentStatus !== "Verified") {
        return NextResponse.json({ error: "Delegate payment has not been verified." }, { status: 400 });
      }
      if (registration.allotmentStatus !== "Allotted") {
        return NextResponse.json({ error: "Delegate allotment has not been released." }, { status: 400 });
      }
    }

    const certificate = await prisma.certificate.create({
      data: {
        registrationId: registration.id,
        title: certificateTitle,
        certificateNo: `CERT-${registration.publicId}-${Date.now().toString(36).toUpperCase()}`
      }
    });

    // Update registration audit fields
    await prisma.registration.update({
      where: { id: registration.id },
      data: {
        certificateReleased: true,
        certificateReleasedAt: new Date(),
        certificateUrl: `/certificates/${certificate.certificateNo}`
      }
    });

    return NextResponse.json({ certificate });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    console.error(error);
    return NextResponse.json({ error: "Could not issue certificate." }, { status: 500 });
  }
}

