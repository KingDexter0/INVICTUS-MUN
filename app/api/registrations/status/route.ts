import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { serializeIndividualRegistration, serializeDelegationDelegate } from "../../../../lib/registrations";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id")?.trim();
    const email = searchParams.get("email")?.trim();
    const phone = searchParams.get("phone")?.trim();

    if (!id && !email && !phone) {
      return NextResponse.json({ error: "Enter a registration ID, tracking token, email, or phone number." }, { status: 400 });
    }

    // Try checking IndividualRegistration first
    const individual = await prisma.individualRegistration.findFirst({
      where: {
        OR: [
          ...(id ? [{ publicId: id }, { trackingToken: id }] : []),
          ...(email ? [{ email: { equals: email, mode: "insensitive" as const } }] : []),
          ...(phone ? [{ phone }] : [])
        ]
      },
      include: { notes: { orderBy: { createdAt: "desc" } } },
      orderBy: { createdAt: "desc" }
    });

    if (individual) {
      return NextResponse.json({
        type: "individual",
        registration: serializeIndividualRegistration(individual)
      });
    }

    // Next check DelegationDelegate
    const delegate = await prisma.delegationDelegate.findFirst({
      where: {
        OR: [
          ...(id ? [{ publicId: id }, { trackingToken: id }] : []),
          ...(email ? [{ email: { equals: email, mode: "insensitive" as const } }] : []),
          ...(phone ? [{ phone }] : [])
        ]
      },
      include: { notes: { orderBy: { createdAt: "desc" } } },
      orderBy: { createdAt: "desc" }
    });

    if (delegate) {
      return NextResponse.json({
        type: "delegate",
        registration: serializeDelegationDelegate(delegate)
      });
    }

    // Fallback: Check deprecated legacy Registration table if it exists
    const legacy = await prisma.registration.findFirst({
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

    if (legacy) {
      return NextResponse.json({
        type: "legacy",
        registration: legacy
      });
    }

    return NextResponse.json({ error: "No registration matched that lookup." }, { status: 404 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not check registration status right now." }, { status: 500 });
  }
}

