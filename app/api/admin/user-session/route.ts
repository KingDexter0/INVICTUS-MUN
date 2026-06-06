import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { createAdminToken, setAdminCookie } from "../../../../lib/admin";
import { prisma } from "../../../../lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    const admin = await prisma.adminUser.findUnique({
      where: { email: String(email || "").trim().toLowerCase() }
    });
    if (!admin || !(await compare(String(password || ""), admin.passwordHash))) {
      return NextResponse.json({ error: "Invalid admin email or password." }, { status: 401 });
    }
    setAdminCookie(createAdminToken(admin.email));
    return NextResponse.json({ ok: true, admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not start admin session." }, { status: 500 });
  }
}

