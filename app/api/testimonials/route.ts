import { NextResponse } from "next/server";
import { assertAdmin } from "../../../lib/admin";
import { prisma } from "../../../lib/prisma";
import { requireOptionalImageUrl, safeText, sanitizeOptionalImageUrl } from "../../../lib/security";

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
  return {
    ...testimonial,
    photoUrl: sanitizeOptionalImageUrl(testimonial.photoUrl),
    createdAt: testimonial.createdAt.toISOString(),
    updatedAt: testimonial.updatedAt.toISOString()
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeUnpublished = searchParams.get("all") === "true";
    if (includeUnpublished) assertAdmin();

    const testimonials = await prisma.testimonial.findMany({
      where: includeUnpublished ? {} : { isPublished: true },
      orderBy: { createdAt: "desc" }
    });
    return NextResponse.json({ testimonials: testimonials.map(serializeTestimonial) });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Could not load testimonials." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    assertAdmin();
    const body = await request.json();
    const name = safeText(body.name, 120);
    const institution = safeText(body.institution, 160);
    const quote = safeText(body.quote, 1200);
    const edition = safeText(body.edition, 80);
    const photoUrl = requireOptionalImageUrl(body.photoUrl, "Testimonial photo URL");

    if (name.length < 2) return NextResponse.json({ error: "Testimonial name is required." }, { status: 400 });
    if (institution.length < 2) return NextResponse.json({ error: "Institution is required." }, { status: 400 });
    if (quote.length < 8) return NextResponse.json({ error: "Quote must be at least 8 characters." }, { status: 400 });

    const testimonial = await prisma.testimonial.create({
      data: {
        name,
        institution,
        quote,
        edition: edition || null,
        photoUrl,
        isPublished: body.isPublished !== false
      }
    });

    return NextResponse.json({ testimonial: serializeTestimonial(testimonial) });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes("photo URL")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: "Could not save testimonial." }, { status: 500 });
  }
}
