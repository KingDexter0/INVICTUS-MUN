import { NextResponse } from "next/server";
import { createDelegateToken, clearDelegateCookie, setDelegateCookie } from "../../../../lib/delegate";
import { prisma } from "../../../../lib/prisma";

export const dynamic = "force-dynamic";

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function phoneMatches(storedPhone: string | null | undefined, inputPhone: string) {
  if (!storedPhone) return false;
  const stored = normalizePhone(storedPhone);
  const input = normalizePhone(inputPhone);
  return stored === input || stored.endsWith(input) || input.endsWith(stored);
}

export async function POST(request: Request) {
  try {
    const { email, phone } = await request.json();
    const cleanEmail = String(email || "").trim();
    const cleanPhone = String(phone || "").trim();

    if (!cleanEmail || !cleanPhone) {
      return NextResponse.json({ error: "Enter both your registered email and phone number." }, { status: 400 });
    }

    // Search IndividualRegistration first
    const individualCandidates = await prisma.individualRegistration.findMany({
      where: { email: { equals: cleanEmail, mode: "insensitive" } },
      orderBy: { createdAt: "desc" },
      take: 10
    });
    const individual = individualCandidates.find((c) => phoneMatches(c.phone, cleanPhone));

    if (individual) {
      // Store internal db id in session token (scoped with prefix to distinguish)
      setDelegateCookie(createDelegateToken(`individual:${individual.id}`));
      return NextResponse.json({ ok: true, id: individual.publicId, type: "individual" });
    }

    // Search DelegationDelegate
    const delegateCandidates = await prisma.delegationDelegate.findMany({
      where: { email: { equals: cleanEmail, mode: "insensitive" } },
      orderBy: { createdAt: "desc" },
      take: 10
    });
    const delegate = delegateCandidates.find((c) => phoneMatches(c.phone, cleanPhone));

    if (delegate) {
      setDelegateCookie(createDelegateToken(`delegate:${delegate.id}`));
      return NextResponse.json({ ok: true, id: delegate.publicId, type: "delegate" });
    }

    return NextResponse.json({ error: "No registration matched that email and phone number." }, { status: 401 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not start delegate session right now." }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  clearDelegateCookie(response);
  return response;
}
