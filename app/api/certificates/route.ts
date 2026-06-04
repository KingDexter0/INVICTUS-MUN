import { NextResponse } from "next/server";
import { assertAdmin } from "../../../lib/admin";
import { prisma } from "../../../lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    assertAdmin();
    const certificates = await prisma.certificate.findMany({ include: { registration: true }, orderBy: { issuedAt: "desc" } });
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
    const registration = await prisma.registration.findUnique({ where: { publicId: String(publicId || "").trim() } });
    if (!registration) return NextResponse.json({ error: "Registration not found." }, { status: 404 });
    const certificate = await prisma.certificate.create({
      data: {
        registrationId: registration.id,
        title: String(title || "Certificate of Participation").trim(),
        certificateNo: `CERT-${registration.publicId}-${Date.now().toString(36).toUpperCase()}`
      }
    });
    return NextResponse.json({ certificate });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    console.error(error);
    return NextResponse.json({ error: "Could not issue certificate." }, { status: 500 });
  }
}

