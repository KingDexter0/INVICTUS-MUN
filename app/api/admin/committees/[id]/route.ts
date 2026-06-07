import { NextResponse } from "next/server";
import { assertAdmin } from "../../../../../lib/admin";
import { deleteCloudinaryFile, uploadCommitteePoster } from "../../../../../lib/cloudinary";
import { prisma } from "../../../../../lib/prisma";
import { safeText } from "../../../../../lib/security";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    assertAdmin();
    const existing = await prisma.committee.findUnique({
      where: { id: params.id }
    });
    if (!existing) {
      return NextResponse.json({ error: "Committee not found." }, { status: 404 });
    }

    const formData = await request.formData();
    const name = safeText(formData.get("name") || existing.name, 120);
    const code = safeText(formData.get("code") || existing.code, 50);
    const difficulty = safeText(formData.get("difficulty") || existing.difficulty, 50);
    const description = safeText(formData.get("description") || existing.description, 1000);
    const eligibility = safeText(formData.get("eligibility") || existing.eligibility, 250);
    const portfolioType = safeText(formData.get("portfolioType") || existing.portfolioType, 250);
    const guideStatus = safeText(formData.get("guideStatus") || existing.guideStatus, 50);
    const guideLink = formData.get("guideLink") !== null ? safeText(formData.get("guideLink"), 500) : existing.guideLink;
    const registrationLink = formData.get("registrationLink") !== null ? safeText(formData.get("registrationLink"), 500) : existing.registrationLink;
    const sortOrder = formData.get("sortOrder") !== null ? Number(formData.get("sortOrder")) : existing.sortOrder;
    const isPublished = formData.get("isPublished") !== null ? (formData.get("isPublished") === "true" || formData.get("isPublished") === "on") : existing.isPublished;
    const poster = formData.get("poster");

    const upload = poster instanceof File && poster.size > 0 ? await uploadCommitteePoster(poster) : null;
    if (upload && existing.posterImagePublicId) {
      void deleteCloudinaryFile(existing.posterImagePublicId);
    }

    const updated = await prisma.committee.update({
      where: { id: params.id },
      data: {
        name,
        code,
        difficulty,
        description,
        eligibility,
        portfolioType,
        guideStatus,
        guideLink: guideLink || null,
        registrationLink: registrationLink || null,
        sortOrder,
        isPublished,
        ...(upload ? { posterImageUrl: upload.secure_url, posterImagePublicId: upload.public_id } : {})
      }
    });

    return NextResponse.json({ committee: updated });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Could not update committee." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    assertAdmin();
    const existing = await prisma.committee.findUnique({
      where: { id: params.id }
    });
    if (!existing) {
      return NextResponse.json({ error: "Committee not found." }, { status: 404 });
    }

    await prisma.committee.delete({
      where: { id: params.id }
    });

    if (existing.posterImagePublicId) {
      void deleteCloudinaryFile(existing.posterImagePublicId);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Could not delete committee." }, { status: 500 });
  }
}
