import { NextResponse } from "next/server";
import { createEbToken, setEbCookie } from "../../../../lib/eb";
import { prisma } from "../../../../lib/prisma";

export const dynamic = "force-dynamic";

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

export async function POST(request: Request) {
  try {
    const { email, phone } = await request.json();
    const profile = await prisma.eBProfile.findFirst({
      where: { email: { equals: String(email || "").trim(), mode: "insensitive" } }
    });
    if (!profile || normalizePhone(profile.phone || "") !== normalizePhone(String(phone || ""))) {
      return NextResponse.json({ error: "Invalid EB email or phone." }, { status: 401 });
    }
    setEbCookie(createEbToken(profile.id));
    return NextResponse.json({ ok: true, profileId: profile.id });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not start EB session." }, { status: 500 });
  }
}
