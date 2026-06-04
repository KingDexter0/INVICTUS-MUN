import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { serializeRegistration } from "../../../../lib/registrations";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id")?.trim();
    const email = searchParams.get("email")?.trim();
    const phone = searchParams.get("phone")?.trim();

    if (!id && !email && !phone) {
      return NextResponse.json({ error: "Enter a registration ID, email, or phone number." }, { status: 400 });
    }

    const registration = await prisma.registration.findFirst({
      where: {
        OR: [
          ...(id ? [{ publicId: id }] : []),
          ...(email ? [{ email: { equals: email, mode: "insensitive" as const } }] : []),
          ...(phone ? [{ phone }] : [])
        ]
      },
      include: { notes: { orderBy: { createdAt: "desc" } } },
      orderBy: { createdAt: "desc" }
    });

    if (!registration) {
      return NextResponse.json({ error: "No registration matched that lookup." }, { status: 404 });
    }

    return NextResponse.json({ registration: serializeRegistration(registration) });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not check registration status right now." }, { status: 500 });
  }
}
