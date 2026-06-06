import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { assertAdmin } from "../../../../../lib/admin";
import { prisma } from "../../../../../lib/prisma";
import { serializeIndividualRegistration } from "../../../../../lib/registrations";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    assertAdmin();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const paymentStatus = searchParams.get("paymentStatus")?.trim();
    const registrationStatus = searchParams.get("registrationStatus")?.trim();

    const where: Prisma.IndividualRegistrationWhereInput = {
      ...(paymentStatus ? { paymentStatus } : {}),
      ...(registrationStatus ? { registrationStatus } : {}),
      ...(search
        ? {
            OR: [
              { publicId: { contains: search, mode: "insensitive" } },
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } },
              { institution: { contains: search, mode: "insensitive" } },
              { committee1: { contains: search, mode: "insensitive" } },
              { utr: { contains: search, mode: "insensitive" } }
            ]
          }
        : {})
    };

    const registrations = await prisma.individualRegistration.findMany({
      where,
      include: { notes: { orderBy: { createdAt: "desc" } } },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ registrations: registrations.map(serializeIndividualRegistration) });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Could not fetch individual registrations." }, { status: 500 });
  }
}
