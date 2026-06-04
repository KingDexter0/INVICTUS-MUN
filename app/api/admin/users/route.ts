import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { assertAdmin } from "../../../../lib/admin";
import { prisma } from "../../../../lib/prisma";

export const dynamic = "force-dynamic";

function serialize(user: { id: string; name: string; email: string; role: string; createdAt: Date; updatedAt: Date }) {
  return { ...user, createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString() };
}

export async function GET() {
  try {
    assertAdmin();
    const users = await prisma.adminUser.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true, role: true, createdAt: true, updatedAt: true }
    });
    return NextResponse.json({ users: users.map(serialize) });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    console.error(error);
    return NextResponse.json({ error: "Could not load admin users." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    assertAdmin();
    const body = await request.json();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const role = String(body.role || "Admin").trim();
    if (name.length < 2) return NextResponse.json({ error: "Admin name is required." }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Valid admin email is required." }, { status: 400 });
    if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    const user = await prisma.adminUser.create({
      data: { name, email, role, passwordHash: await hash(password, 12) },
      select: { id: true, name: true, email: true, role: true, createdAt: true, updatedAt: true }
    });
    return NextResponse.json({ user: serialize(user) });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    if ((error as { code?: string }).code === "P2002") return NextResponse.json({ error: "An admin with this email already exists." }, { status: 409 });
    console.error(error);
    return NextResponse.json({ error: "Could not create admin user." }, { status: 500 });
  }
}

