import { NextResponse } from "next/server";
import { assertAdmin } from "../../../lib/admin";
import { uploadEbPhoto } from "../../../lib/cloudinary";
import { prisma } from "../../../lib/prisma";

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
    const fullName = String(formData.get("fullName") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const committee = String(formData.get("committee") || "").trim();
    const position = String(formData.get("position") || "").trim();
    const bio = String(formData.get("bio") || "").trim();
    const instagram = String(formData.get("instagram") || "").trim();
    const linkedin = String(formData.get("linkedin") || "").trim();
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
        instagram: instagram || null,
        linkedin: linkedin || null
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
    console.error(error);
    return NextResponse.json({ error: "Could not save EB profile." }, { status: 500 });
  }
}

