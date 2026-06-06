import { NextResponse } from "next/server";
import { assertAdmin } from "../../../../../../lib/admin";
import { prisma } from "../../../../../../lib/prisma";
import { operationsEmitter } from "../../../../../../lib/events";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    assertAdmin();

    // 1. Fetch all checked-in individuals and delegates
    const [checkedInIndividuals, checkedInDelegates] = await Promise.all([
      prisma.individualRegistration.findMany({
        where: { checkedIn: true, checkedInAt: { not: null } },
        select: {
          id: true, publicId: true, name: true,
          checkedIn: true, checkedInAt: true,
          paymentStatus: true, registrationStatus: true, allotmentStatus: true,
          allottedCommittee: true, allottedPortfolio: true
        }
      }),
      prisma.delegationDelegate.findMany({
        where: { checkedIn: true, checkedInAt: { not: null } },
        include: { delegation: { select: { paymentStatus: true, registrationStatus: true } } }
      })
    ]);

    const totalCheckedIn = checkedInIndividuals.length + checkedInDelegates.length;

    // 2. Filter eligible: approved + verified + allotted
    const eligibleIndividuals = checkedInIndividuals.filter((r) =>
      r.registrationStatus === "Approved" && r.paymentStatus === "Verified" && r.allotmentStatus === "Allotted"
    );
    const eligibleDelegates = checkedInDelegates.filter((d) =>
      d.delegation.registrationStatus === "Approved" && d.delegation.paymentStatus === "Verified" && d.allotmentStatus === "Allotted"
    );

    const ineligible = totalCheckedIn - eligibleIndividuals.length - eligibleDelegates.length;

    if (eligibleIndividuals.length === 0 && eligibleDelegates.length === 0) {
      return NextResponse.json({ totalCheckedIn, eligible: 0, created: 0, skippedExisting: 0, ineligible, errors: [] });
    }

    // 3. Find existing certificates to skip
    const [existingIndividualCerts, existingDelegateCerts] = await Promise.all([
      prisma.individualCertificate.findMany({
        where: { title: "Certificate of Participation", registrationId: { in: eligibleIndividuals.map((r) => r.id) } },
        select: { registrationId: true }
      }),
      prisma.delegateCertificate.findMany({
        where: { title: "Certificate of Participation", delegateId: { in: eligibleDelegates.map((d) => d.id) } },
        select: { delegateId: true }
      })
    ]);

    const existingIndividualIds = new Set(existingIndividualCerts.map((c) => c.registrationId));
    const existingDelegateIds = new Set(existingDelegateCerts.map((c) => c.delegateId));

    const individualsToCreate = eligibleIndividuals.filter((r) => !existingIndividualIds.has(r.id));
    const delegatesToCreate = eligibleDelegates.filter((d) => !existingDelegateIds.has(d.id));
    const skippedExisting = (eligibleIndividuals.length - individualsToCreate.length) + (eligibleDelegates.length - delegatesToCreate.length);

    const created: string[] = [];
    const errors: string[] = [];

    // 4. Create certificates for individual registrations
    for (const reg of individualsToCreate) {
      try {
        const randHex = Math.random().toString(36).substring(2, 7).toUpperCase();
        const certificateNo = `CERT-${reg.publicId}-${Date.now().toString(36).toUpperCase()}-${randHex}`;
        await prisma.individualCertificate.create({
          data: { registrationId: reg.id, title: "Certificate of Participation", certificateNo }
        });
        await prisma.individualRegistration.update({
          where: { id: reg.id },
          data: { certificateReleased: true, certificateReleasedAt: new Date(), certificateUrl: `/certificates/${certificateNo}` }
        });
        created.push(reg.publicId);
      } catch (error) {
        errors.push(`Individual ${reg.publicId}: ${(error as Error).message}`);
      }
    }

    // 5. Create certificates for delegation delegates
    for (const del of delegatesToCreate) {
      try {
        const randHex = Math.random().toString(36).substring(2, 7).toUpperCase();
        const certificateNo = `CERT-${del.publicId}-${Date.now().toString(36).toUpperCase()}-${randHex}`;
        await prisma.delegateCertificate.create({
          data: { delegateId: del.id, title: "Certificate of Participation", certificateNo }
        });
        await prisma.delegationDelegate.update({
          where: { id: del.id },
          data: { certificateReleased: true, certificateReleasedAt: new Date(), certificateUrl: `/certificates/${certificateNo}` }
        });
        created.push(del.publicId);
      } catch (error) {
        errors.push(`Delegate ${del.publicId}: ${(error as Error).message}`);
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
      eligible: eligibleIndividuals.length + eligibleDelegates.length,
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
