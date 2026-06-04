import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const count = await prisma.adminUser.count();
  return NextResponse.json({ needsSetup: count === 0 });
}

export async function POST(request: Request) {
  try {
    const count = await prisma.adminUser.count();
    if (count > 0) {
      return NextResponse.json({ error: "Admin setup is already complete." }, { status: 409 });
    }

    const expected = process.env.ADMIN_SETUP_TOKEN;
    if (!expected) {
      return NextResponse.json({ error: "Admin setup token is not configured." }, { status: 503 });
    }

    const body = await request.json();
    if (String(body.setupToken || "") !== expected) {
      return NextResponse.json({ error: "Invalid setup token." }, { status: 401 });
    }

    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (name.length < 2) return NextResponse.json({ error: "Admin name is required." }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Valid admin email is required." }, { status: 400 });
    if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });

    const user = await prisma.adminUser.create({
      data: {
        name,
        email,
        role: "Super Admin",
        passwordHash: await hash(password, 12)
      },
      select: { id: true, name: true, email: true, role: true }
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not create first admin user." }, { status: 500 });
  }
}

