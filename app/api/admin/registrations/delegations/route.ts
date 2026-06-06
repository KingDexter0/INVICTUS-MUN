import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { assertAdmin } from "../../../../../lib/admin";
import { prisma } from "../../../../../lib/prisma";
import { serializeDelegationRegistration } from "../../../../../lib/registrations";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    assertAdmin();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const paymentStatus = searchParams.get("paymentStatus")?.trim();
    const registrationStatus = searchParams.get("registrationStatus")?.trim();

    const where: Prisma.DelegationRegistrationWhereInput = {
      ...(paymentStatus ? { paymentStatus } : {}),
      ...(registrationStatus ? { registrationStatus } : {}),
      ...(search
        ? {
            OR: [
              { publicId: { contains: search, mode: "insensitive" } },
              { delegationName: { contains: search, mode: "insensitive" } },
              { coTeacherEmail: { contains: search, mode: "insensitive" } },
              { coTeacherName: { contains: search, mode: "insensitive" } },
              { coTeacherPhone: { contains: search, mode: "insensitive" } },
              { institution: { contains: search, mode: "insensitive" } }
            ]
          }
        : {})
    };

    const delegations = await prisma.delegationRegistration.findMany({
      where,
      include: {
        notes: { orderBy: { createdAt: "desc" } },
        delegates: true
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ delegations: delegations.map(serializeDelegationRegistration) });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Could not fetch delegation registrations." }, { status: 500 });
  }
}
