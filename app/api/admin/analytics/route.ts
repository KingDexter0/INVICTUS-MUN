import { NextResponse } from "next/server";
import { assertAdmin } from "../../../../lib/admin";
import { prisma } from "../../../../lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    assertAdmin();
    const [registrations, verifiedPayments, checkedIn, resources, certificates, awards, events] = await Promise.all([
      prisma.registration.count(),
      prisma.registration.count({ where: { paymentStatus: "Verified" } }),
      prisma.registration.count({ where: { checkedIn: true } }),
      prisma.resource.count(),
      prisma.certificate.count(),
      prisma.award.count(),
      prisma.analyticsEvent.groupBy({ by: ["eventType"], _count: { eventType: true } })
    ]);
    return NextResponse.json({ registrations, verifiedPayments, checkedIn, resources, certificates, awards, events });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    console.error(error);
    return NextResponse.json({ error: "Could not load analytics." }, { status: 500 });
  }
}

