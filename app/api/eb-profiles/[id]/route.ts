import { NextResponse } from "next/server";
import { assertAdmin } from "../../../../lib/admin";
import { deleteCloudinaryFile, uploadEbPhoto } from "../../../../lib/cloudinary";
import { prisma } from "../../../../lib/prisma";

export const dynamic = "force-dynamic";

function serializeProfile(profile: {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  photoUrl: string | null;
  photoPublicId: string | null;
  committee: string;
  position: string;
  bio: string;
  instagram: string | null;
  linkedin: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return { ...profile, createdAt: profile.createdAt.toISOString(), updatedAt: profile.updatedAt.toISOString() };
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    assertAdmin();
    const existing = await prisma.eBProfile.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "EB profile not found." }, { status: 404 });

    const formData = await request.formData();
    const photo = formData.get("photo");
    const upload = photo instanceof File && photo.size > 0 ? await uploadEbPhoto(photo) : null;
    if (upload && existing.photoPublicId) {
      void deleteCloudinaryFile(existing.photoPublicId);
    }

    const profile = await prisma.eBProfile.update({
      where: { id: params.id },
      data: {
        fullName: String(formData.get("fullName") || existing.fullName).trim(),
        email: String(formData.get("email") || "").trim() || null,
        phone: String(formData.get("phone") || "").trim() || null,
        committee: String(formData.get("committee") || existing.committee).trim(),
        position: String(formData.get("position") || existing.position).trim(),
        bio: String(formData.get("bio") || existing.bio).trim(),
        instagram: String(formData.get("instagram") || "").trim() || null,
        linkedin: String(formData.get("linkedin") || "").trim() || null,
        ...(upload ? { photoUrl: upload.secure_url, photoPublicId: upload.public_id } : {})
      }
    });
    return NextResponse.json({ profile: serializeProfile(profile) });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Could not update EB profile." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    assertAdmin();
    const existing = await prisma.eBProfile.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "EB profile not found." }, { status: 404 });
    await prisma.eBProfile.delete({ where: { id: params.id } });
    if (existing.photoPublicId) void deleteCloudinaryFile(existing.photoPublicId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Could not delete EB profile." }, { status: 500 });
  }
}

