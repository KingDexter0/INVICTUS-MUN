import { NextResponse } from "next/server";
import { assertAdmin } from "../../../lib/admin";
import { prisma } from "../../../lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const announcements = await prisma.announcement.findMany({
    orderBy: { createdAt: "desc" },
    take: 20
  });

  return NextResponse.json({
    announcements: announcements.map((announcement) => ({
      ...announcement,
      createdAt: announcement.createdAt.toISOString()
    }))
  });
}

export async function POST(request: Request) {
  try {
    assertAdmin();
    const body = await request.json();
    const title = String(body.title || "").trim();
    const audience = String(body.audience || "All registered delegates").trim();
    const message = String(body.message || "").trim();

    if (title.length < 3) {
      return NextResponse.json({ error: "Announcement title must be at least 3 characters." }, { status: 400 });
    }
    if (message.length < 5) {
      return NextResponse.json({ error: "Announcement message must be at least 5 characters." }, { status: 400 });
    }

    const announcement = await prisma.announcement.create({
      data: {
        title,
        audience,
        message
      }
    });

    return NextResponse.json({ announcement: { ...announcement, createdAt: announcement.createdAt.toISOString() } });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Could not save announcement." }, { status: 500 });
  }
}
