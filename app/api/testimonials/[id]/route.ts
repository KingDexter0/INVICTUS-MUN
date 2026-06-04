import { NextResponse } from "next/server";
import { assertAdmin } from "../../../../lib/admin";
import { prisma } from "../../../../lib/prisma";

export const dynamic = "force-dynamic";

function serializeTestimonial(testimonial: {
  id: string;
  name: string;
  institution: string;
  quote: string;
  edition: string | null;
  photoUrl: string | null;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return { ...testimonial, createdAt: testimonial.createdAt.toISOString(), updatedAt: testimonial.updatedAt.toISOString() };
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    assertAdmin();
    const body = await request.json();
    const testimonial = await prisma.testimonial.update({
      where: { id: params.id },
      data: {
        ...(body.name !== undefined ? { name: String(body.name).trim() } : {}),
        ...(body.institution !== undefined ? { institution: String(body.institution).trim() } : {}),
        ...(body.quote !== undefined ? { quote: String(body.quote).trim() } : {}),
        ...(body.edition !== undefined ? { edition: String(body.edition || "").trim() || null } : {}),
        ...(body.photoUrl !== undefined ? { photoUrl: String(body.photoUrl || "").trim() || null } : {}),
        ...(body.isPublished !== undefined ? { isPublished: Boolean(body.isPublished) } : {})
      }
    });
    return NextResponse.json({ testimonial: serializeTestimonial(testimonial) });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Could not update testimonial." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    assertAdmin();
    await prisma.testimonial.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Could not delete testimonial." }, { status: 500 });
  }
}

