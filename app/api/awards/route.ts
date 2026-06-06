import { NextResponse } from "next/server";
import { assertAdmin } from "../../../lib/admin";
import { prisma } from "../../../lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    assertAdmin();

    const [individualAwards, delegateAwards] = await Promise.all([
      prisma.individualAward.findMany({
        include: { registration: true },
        orderBy: { createdAt: "desc" }
      }),
      prisma.delegateAward.findMany({
        include: { delegate: { include: { delegation: true } } },
        orderBy: { createdAt: "desc" }
      })
    ]);

    const awards = [
      ...individualAwards.map((a) => ({
        id: a.id,
        title: a.title,
        category: a.category,
        committee: a.committee,
        position: a.position,
        createdAt: a.createdAt,
        sourceType: "individual",
        registration: {
          publicId: a.registration.publicId,
          name: a.registration.name,
          email: a.registration.email
        }
      })),
      ...delegateAwards.map((a) => ({
        id: a.id,
        title: a.title,
        category: a.category,
        committee: a.committee,
        position: a.position,
        createdAt: a.createdAt,
        sourceType: "delegate",
        registration: {
          publicId: a.delegate.publicId,
          name: a.delegate.name,
          email: a.delegate.email || ""
        }
      }))
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ awards });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    console.error(error);
    return NextResponse.json({ error: "Could not load awards." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    assertAdmin();
    const body = await request.json();
    const cleanPublicId = String(body.publicId || "").trim();
    const title = String(body.title || "").trim();
    const category = String(body.category || "Committee Award").trim();
    const position = String(body.position || "").trim() || null;

    // Try IndividualRegistration first
    const individual = await prisma.individualRegistration.findUnique({
      where: { publicId: cleanPublicId }
    });

    if (individual) {
      const committee = String(body.committee || individual.allottedCommittee || "").trim() || null;
      const award = await prisma.individualAward.create({
        data: {
          registrationId: individual.id,
          title,
          category,
          committee,
          position
        }
      });
      return NextResponse.json({ award });
    }

    // Try DelegationDelegate next
    const delegate = await prisma.delegationDelegate.findUnique({
      where: { publicId: cleanPublicId }
    });

    if (delegate) {
      const committee = String(body.committee || delegate.allottedCommittee || "").trim() || null;
      const award = await prisma.delegateAward.create({
        data: {
          delegateId: delegate.id,
          title,
          category,
          committee,
          position
        }
      });
      return NextResponse.json({ award });
    }

    return NextResponse.json({ error: "Registration not found." }, { status: 404 });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    console.error(error);
    return NextResponse.json({ error: "Could not save award." }, { status: 500 });
  }
}
