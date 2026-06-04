import { NextResponse } from "next/server";
import { assertAdmin } from "../../../lib/admin";
import { uploadEbPhoto } from "../../../lib/cloudinary";
import { prisma } from "../../../lib/prisma";
import { requireOptionalSocialUrl, safeText, sanitizeOptionalImageUrl, sanitizeOptionalSocialUrl } from "../../../lib/security";

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
  return {
    ...profile,
    photoUrl: sanitizeOptionalImageUrl(profile.photoUrl),
    instagram: sanitizeOptionalSocialUrl(profile.instagram, ["instagram.com"]),
    linkedin: sanitizeOptionalSocialUrl(profile.linkedin, ["linkedin.com"]),
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString()
  };
}

export async function GET() {
  try {
    const profiles = await prisma.eBProfile.findMany({
      orderBy: [{ committee: "asc" }, { position: "asc" }, { fullName: "asc" }]
    });
    return NextResponse.json({ profiles: profiles.map(serializeProfile) });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not load EB profiles." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    assertAdmin();
    const formData = await request.formData();
    const fullName = safeText(formData.get("fullName"), 120);
    const email = safeText(formData.get("email"), 160);
    const phone = safeText(formData.get("phone"), 30);
    const committee = safeText(formData.get("committee"), 120);
    const position = safeText(formData.get("position"), 120);
    const bio = safeText(formData.get("bio"), 1000);
    const instagram = requireOptionalSocialUrl(formData.get("instagram"), ["instagram.com"], "Instagram");
    const linkedin = requireOptionalSocialUrl(formData.get("linkedin"), ["linkedin.com"], "LinkedIn");
    const photo = formData.get("photo");

    if (fullName.length < 2) return NextResponse.json({ error: "EB full name is required." }, { status: 400 });
    if (!committee) return NextResponse.json({ error: "Committee is required." }, { status: 400 });
    if (!position) return NextResponse.json({ error: "Position is required." }, { status: 400 });
    if (bio.length < 5) return NextResponse.json({ error: "Bio must be at least 5 characters." }, { status: 400 });

    const upload = photo instanceof File && photo.size > 0 ? await uploadEbPhoto(photo) : null;
    const profile = await prisma.eBProfile.create({
      data: {
        fullName,
        email: email || null,
        phone: phone || null,
        photoUrl: upload?.secure_url || null,
        photoPublicId: upload?.public_id || null,
        committee,
        position,
        bio,
        instagram,
        linkedin
      }
    });

    return NextResponse.json({ profile: serializeProfile(profile) });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes("Cloudinary is not configured")) {
      return NextResponse.json({ error: "Cloudinary is not configured for EB photo uploads." }, { status: 503 });
    }
    if (error instanceof Error && (error.message.includes("Instagram") || error.message.includes("LinkedIn"))) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: "Could not save EB profile." }, { status: 500 });
  }
}
