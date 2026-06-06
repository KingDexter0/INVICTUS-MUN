import { NextResponse } from "next/server";
import { assertAdmin } from "../../../../../../lib/admin";
import { prisma } from "../../../../../../lib/prisma";
import { operationsEmitter } from "../../../../../../lib/events";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    assertAdmin();

    // 1. Fetch all checked-in registrations
    const checkedInRegistrations = await prisma.registration.findMany({
      where: {
        checkedIn: true,
        checkedInAt: { not: null }
      },
      select: {
        id: true,
        publicId: true,
        name: true,
        email: true,
        phone: true,
        checkedIn: true,
        checkedInAt: true,
        paymentStatus: true,
        registrationStatus: true,
        allotmentStatus: true,
        allottedCommittee: true,
        allottedPortfolio: true,
        createdAt: true
      }
    });

    const totalCheckedIn = checkedInRegistrations.length;

    // 2. Filter eligible registrations based on constraints
    const eligibleRegistrations = checkedInRegistrations.filter((r) =>
      r.registrationStatus === "Approved" &&
      r.paymentStatus === "Verified" &&
      r.allotmentStatus === "Allotted"
    );

    const ineligible = totalCheckedIn - eligibleRegistrations.length;

    if (eligibleRegistrations.length === 0) {
      return NextResponse.json({
        totalCheckedIn,
        eligible: 0,
        created: 0,
        skippedExisting: 0,
        ineligible,
        errors: []
      });
    }

    // 3. Find registrations that already have a Participation certificate
    const existingCertificates = await prisma.certificate.findMany({
      where: {
        title: "Certificate of Participation",
        registrationId: { in: eligibleRegistrations.map((r) => r.id) }
      },
      select: {
        registrationId: true
      }
    });

    const existingRegIds = new Set(existingCertificates.map((c) => c.registrationId));

    // 4. Identify registrations that need certificate generation
    const toCreate = eligibleRegistrations.filter((r) => !existingRegIds.has(r.id));
    const skippedExisting = eligibleRegistrations.length - toCreate.length;

    const created: string[] = [];
    const errors: string[] = [];

    // 5. Create Certificate records for remaining eligible delegates
    for (const reg of toCreate) {
      try {
        const randHex = Math.random().toString(36).substring(2, 7).toUpperCase();
        const certificateNo = `CERT-${reg.publicId}-${Date.now().toString(36).toUpperCase()}-${randHex}`;

        await prisma.certificate.create({
          data: {
            registrationId: reg.id,
            title: "Certificate of Participation",
            certificateNo
          }
        });

        await prisma.registration.update({
          where: { id: reg.id },
          data: {
            certificateReleased: true,
            certificateReleasedAt: new Date(),
            certificateUrl: `/certificates/${certificateNo}`
          }
        });

        created.push(reg.publicId);
      } catch (error) {
        console.error(`Failed to generate certificate for ${reg.publicId}:`, error);
        errors.push(`Registration ${reg.publicId}: ${(error as Error).message}`);
      }
    }

    if (created.length > 0) {
      operationsEmitter.emit("update", {
        type: "operations:refresh-needed",
        data: { reason: "bulk-certificates-generated" }
      });
    }

    return NextResponse.json({
      totalCheckedIn,
      eligible: eligibleRegistrations.length,
      created: created.length,
      skippedExisting,
      ineligible,
      errors
    });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Could not generate certificates." }, { status: 500 });
  }
}
