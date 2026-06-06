import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const individualCount = await prisma.individualRegistration.count();
    const delegationCount = await prisma.delegationRegistration.count();
    const delegateCount = await prisma.delegationDelegate.count();
    let legacyCount = 0;
    try {
      legacyCount = await prisma.registration.count();
    } catch (err) {
      // Legacy table might not exist or fail
    }

    return NextResponse.json({
      success: true,
      counts: {
        individual: individualCount,
        delegation: delegationCount,
        delegationDelegate: delegateCount,
        legacyRegistration: legacyCount
      }
    });
  } catch (error) {
    console.error("Debug counts retrieval failed:", error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
