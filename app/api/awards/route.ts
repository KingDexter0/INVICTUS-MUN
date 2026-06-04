import { NextResponse } from "next/server";
import { assertAdmin } from "../../../lib/admin";
import { prisma } from "../../../lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    assertAdmin();
    const awards = await prisma.award.findMany({ include: { registration: true }, orderBy: { createdAt: "desc" } });
    return NextResponse.json({ awards });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    console.error(error);
    return NextResponse.json({ error: "Could not load awards." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    assertAdmin();
    const body = await request.json();
    const registration = await prisma.registration.findUnique({ where: { publicId: String(body.publicId || "").trim() } });
    if (!registration) return NextResponse.json({ error: "Registration not found." }, { status: 404 });
    const award = await prisma.award.create({
      data: {
        registrationId: registration.id,
        title: String(body.title || "").trim(),
        category: String(body.category || "Committee Award").trim(),
        committee: String(body.committee || registration.allottedCommittee || "").trim() || null,
        position: String(body.position || "").trim() || null
      }
    });
    return NextResponse.json({ award });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    console.error(error);
    return NextResponse.json({ error: "Could not save award." }, { status: 500 });
  }
}

