import { NextResponse } from "next/server";
import { assertAdmin } from "../../../../lib/admin";
import { uploadCommitteePoster } from "../../../../lib/cloudinary";
import { prisma } from "../../../../lib/prisma";
import { safeText } from "../../../../lib/security";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const committees = await prisma.committee.findMany({
      orderBy: { sortOrder: "asc" }
    });
    return NextResponse.json({ committees });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not load committees." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    assertAdmin();
    const formData = await request.formData();
    const name = safeText(formData.get("name"), 120);
    const code = safeText(formData.get("code"), 50);
    const difficulty = safeText(formData.get("difficulty"), 50);
    const description = safeText(formData.get("description"), 1000);
    const eligibility = safeText(formData.get("eligibility"), 250);
    const portfolioType = safeText(formData.get("portfolioType"), 250);
    const guideStatus = safeText(formData.get("guideStatus"), 50);
    const guideLink = safeText(formData.get("guideLink"), 500);
    const registrationLink = safeText(formData.get("registrationLink"), 500);
    const sortOrder = Number(formData.get("sortOrder") || 0);
    const isPublished = formData.get("isPublished") === "true" || formData.get("isPublished") === "on";
    const poster = formData.get("poster");

    if (!name) return NextResponse.json({ error: "Committee name is required." }, { status: 400 });
    if (!code) return NextResponse.json({ error: "Committee code is required." }, { status: 400 });
    if (!difficulty) return NextResponse.json({ error: "Difficulty level is required." }, { status: 400 });
    if (!description) return NextResponse.json({ error: "Description is required." }, { status: 400 });
    if (!eligibility) return NextResponse.json({ error: "Eligibility is required." }, { status: 400 });
    if (!portfolioType) return NextResponse.json({ error: "Portfolio type is required." }, { status: 400 });
    if (!guideStatus) return NextResponse.json({ error: "Guide status is required." }, { status: 400 });

    const upload = poster instanceof File && poster.size > 0 ? await uploadCommitteePoster(poster) : null;

    const committee = await prisma.committee.create({
      data: {
        name,
        code,
        difficulty,
        posterImageUrl: upload?.secure_url || null,
        posterImagePublicId: upload?.public_id || null,
        description,
        eligibility,
        portfolioType,
        guideStatus,
        guideLink: guideLink || null,
        registrationLink: registrationLink || null,
        sortOrder,
        isPublished
      }
    });

    return NextResponse.json({ committee });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes("Cloudinary is not configured")) {
      return NextResponse.json({ error: "Cloudinary is not configured for poster uploads." }, { status: 503 });
    }
    console.error(error);
    return NextResponse.json({ error: "Could not save committee." }, { status: 500 });
  }
}
