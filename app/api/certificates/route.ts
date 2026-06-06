import { NextResponse } from "next/server";
import { assertAdmin } from "../../../lib/admin";
import { prisma } from "../../../lib/prisma";
import { operationsEmitter } from "../../../lib/events";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    assertAdmin();

    // Fetch from both new certificate tables and normalize into a uniform shape
    const [individualCerts, delegateCerts] = await Promise.all([
      prisma.individualCertificate.findMany({
        include: { registration: true },
        orderBy: { issuedAt: "desc" }
      }),
      prisma.delegateCertificate.findMany({
        include: { delegate: { include: { delegation: true } } },
        orderBy: { issuedAt: "desc" }
      })
    ]);

    const certificates = [
      ...individualCerts.map((c) => ({
        id: c.id,
        certificateNo: c.certificateNo,
        title: c.title,
        issuedAt: c.issuedAt,
        sourceType: "individual",
        registration: {
          publicId: c.registration.publicId,
          name: c.registration.name,
          email: c.registration.email,
          allottedCommittee: c.registration.allottedCommittee,
          allottedPortfolio: c.registration.allottedPortfolio
        }
      })),
      ...delegateCerts.map((c) => ({
        id: c.id,
        certificateNo: c.certificateNo,
        title: c.title,
        issuedAt: c.issuedAt,
        sourceType: "delegate",
        registration: {
          publicId: c.delegate.publicId,
          name: c.delegate.name,
          email: c.delegate.email || "",
          allottedCommittee: c.delegate.allottedCommittee,
          allottedPortfolio: c.delegate.allottedPortfolio
        }
      }))
    ].sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());

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
    const cleanPublicId = String(publicId || "").trim();
    const certificateTitle = String(title || "Certificate of Participation").trim();

    // Try IndividualRegistration first
    const individual = await prisma.individualRegistration.findUnique({
      where: { publicId: cleanPublicId }
    });

    if (individual) {
      if (!individual.checkedIn) {
        return NextResponse.json({ error: "Certificate can only be released after delegate check-in." }, { status: 403 });
      }
      if (certificateTitle === "Certificate of Participation") {
        if (individual.registrationStatus !== "Approved") {
          return NextResponse.json({ error: "Delegate registration is not approved." }, { status: 400 });
        }
        if (individual.paymentStatus !== "Verified") {
          return NextResponse.json({ error: "Delegate payment has not been verified." }, { status: 400 });
        }
        if (individual.allotmentStatus !== "Allotted") {
          return NextResponse.json({ error: "Delegate allotment has not been released." }, { status: 400 });
        }
      }

      const certificateNo = `CERT-${individual.publicId}-${Date.now().toString(36).toUpperCase()}`;
      const certificate = await prisma.individualCertificate.create({
        data: { registrationId: individual.id, title: certificateTitle, certificateNo }
      });
      await prisma.individualRegistration.update({
        where: { id: individual.id },
        data: { certificateReleased: true, certificateReleasedAt: new Date(), certificateUrl: `/certificates/${certificateNo}` }
      });
      operationsEmitter.emit("update", {
        type: "certificate:updated",
        data: { publicId: cleanPublicId, certificateReleased: true, certificateUrl: `/certificates/${certificateNo}` }
      });
      return NextResponse.json({ certificate });
    }

    // Try DelegationDelegate
    const delegate = await prisma.delegationDelegate.findUnique({
      where: { publicId: cleanPublicId },
      include: { delegation: true }
    });

    if (delegate) {
      if (!delegate.checkedIn) {
        return NextResponse.json({ error: "Certificate can only be released after delegate check-in." }, { status: 403 });
      }
      if (certificateTitle === "Certificate of Participation") {
        if (delegate.delegation.registrationStatus !== "Approved") {
          return NextResponse.json({ error: "Delegation registration is not approved." }, { status: 400 });
        }
        if (delegate.delegation.paymentStatus !== "Verified") {
          return NextResponse.json({ error: "Delegation payment has not been verified." }, { status: 400 });
        }
        if (delegate.allotmentStatus !== "Allotted") {
          return NextResponse.json({ error: "Delegate allotment has not been released." }, { status: 400 });
        }
      }

      const certificateNo = `CERT-${delegate.publicId}-${Date.now().toString(36).toUpperCase()}`;
      const certificate = await prisma.delegateCertificate.create({
        data: { delegateId: delegate.id, title: certificateTitle, certificateNo }
      });
      await prisma.delegationDelegate.update({
        where: { id: delegate.id },
        data: { certificateReleased: true, certificateReleasedAt: new Date(), certificateUrl: `/certificates/${certificateNo}` }
      });
      operationsEmitter.emit("update", {
        type: "certificate:updated",
        data: { publicId: cleanPublicId, certificateReleased: true, certificateUrl: `/certificates/${certificateNo}` }
      });
      return NextResponse.json({ certificate });
    }

    return NextResponse.json({ error: "Registration not found." }, { status: 404 });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    console.error(error);
    return NextResponse.json({ error: "Could not issue certificate." }, { status: 500 });
  }
}
