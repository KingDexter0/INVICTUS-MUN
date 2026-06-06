import { NextResponse } from "next/server";
import { assertAdmin } from "../../../../../lib/admin";
import { prisma } from "../../../../../lib/prisma";
import { serializeDelegationDelegate } from "../../../../../lib/registrations";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    assertAdmin();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();

    const delegates = await prisma.delegationDelegate.findMany({
      where: search
        ? {
            OR: [
              { publicId: { contains: search, mode: "insensitive" } },
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } },
              { allottedCommittee: { contains: search, mode: "insensitive" } },
              { delegation: { delegationName: { contains: search, mode: "insensitive" } } }
            ]
          }
        : {},
      include: {
        notes: { orderBy: { createdAt: "desc" } },
        delegation: true
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({
      delegates: delegates.map(item => ({
        ...serializeDelegationDelegate(item),
        delegationName: item.delegation?.delegationName || "Unknown"
      }))
    });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Could not fetch delegation delegates." }, { status: 500 });
  }
}
