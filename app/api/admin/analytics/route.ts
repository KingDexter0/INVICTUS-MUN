import { NextResponse } from "next/server";
import { assertAdmin } from "../../../../lib/admin";
import { prisma } from "../../../../lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    assertAdmin();
    const [
      individualCount,
      delegateCount,
      individualVerified,
      delegationVerified,
      individualCheckedIn,
      delegateCheckedIn,
      resources,
      certificates,
      awards,
      events
    ] = await Promise.all([
      prisma.individualRegistration.count(),
      prisma.delegationDelegate.count(),
      prisma.individualRegistration.count({ where: { paymentStatus: "Verified" } }),
      prisma.delegationRegistration.count({ where: { paymentStatus: "Verified" } }),
      prisma.individualRegistration.count({ where: { checkedIn: true } }),
      prisma.delegationDelegate.count({ where: { checkedIn: true } }),
      prisma.resource.count(),
      // Count across both cert tables
      Promise.all([prisma.individualCertificate.count(), prisma.delegateCertificate.count()]).then(([a, b]) => a + b),
      // Count across both award tables
      Promise.all([prisma.individualAward.count(), prisma.delegateAward.count()]).then(([a, b]) => a + b),
      prisma.analyticsEvent.groupBy({ by: ["eventType"], _count: { eventType: true } })
    ]);

    return NextResponse.json({
      registrations: individualCount + delegateCount,
      individualRegistrations: individualCount,
      delegationDelegates: delegateCount,
      verifiedPayments: individualVerified + delegationVerified,
      checkedIn: individualCheckedIn + delegateCheckedIn,
      resources,
      certificates,
      awards,
      events
    });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    console.error(error);
    return NextResponse.json({ error: "Could not load analytics." }, { status: 500 });
  }
}
