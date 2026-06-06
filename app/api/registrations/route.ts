import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { assertAdmin } from "../../../lib/admin";
import { sendRegistrationEmail } from "../../../lib/email";
import { prisma } from "../../../lib/prisma";
import {
  amountForType,
  publicIdFromCount,
  serializeRegistration
} from "../../../lib/registrations";

export const dynamic = "force-dynamic";

function text(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function numberOrNull(formData: FormData, key: string) {
  const value = text(formData, key);
  if (!value) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

function validateRegistration(formData: FormData) {
  const errors: string[] = [];
  const email = text(formData, "email");
  const phone = text(formData, "phone");
  const muns = text(formData, "muns");
  const awards = text(formData, "awards");

  if (text(formData, "name").length < 2) errors.push("Enter the delegate's full name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Enter a valid email address.");
  if (!/^[0-9+\-\s()]{7,20}$/.test(phone)) errors.push("Enter a valid phone number.");
  if (!text(formData, "type")) errors.push("Choose a registration type.");
  if (!text(formData, "committee1")) errors.push("Choose the first committee preference.");
  if (muns && Number(muns) < 0) errors.push("MUNs attended cannot be negative.");
  if (awards && Number(awards) < 0) errors.push("Awards won cannot be negative.");

  return errors;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const errors = validateRegistration(formData);

    if (errors.length) {
      return NextResponse.json(
        { error: "Please fix the highlighted registration details.", details: errors },
        { status: 400 }
      );
    }

    const type = text(formData, "type") || "Individual Delegate";
    const count = await prisma.registration.count();

    const registration = await prisma.registration.create({
      data: {
        publicId: publicIdFromCount(count),
        name: text(formData, "name"),
        email: text(formData, "email"),
        phone: text(formData, "phone"),
        institution: text(formData, "institution") || null,
        type,
        committee1: text(formData, "committee1"),
        committee2: text(formData, "committee2") || null,
        portfolio1: text(formData, "portfolio1") || null,
        muns: numberOrNull(formData, "muns"),
        awards: numberOrNull(formData, "awards"),
        experience: text(formData, "experience") || null,
        utr: text(formData, "utr") || null,
        amount: amountForType(type, text(formData, "accommodation")),
        paymentProofUrl: null,
        paymentProofPublicId: null,
        accommodation: text(formData, "accommodation") || null,
        transport: text(formData, "transport") || null,
        arrivalCity: text(formData, "arrivalCity") || null,
        requirements: text(formData, "requirements") || null,
        paymentStatus: "Pending"
      }
    });

    void sendRegistrationEmail({
      to: registration.email,
      name: registration.name,
      publicId: registration.publicId,
      heading: "Registration submitted",
      action: "Your Invictus MUN registration has been submitted successfully. Please open your dashboard to complete payment securely through Razorpay.",
      dashboardPath: `/dashboard?id=${encodeURIComponent(registration.publicId)}`,
      details: [
        ["Registration type", registration.type],
        ["Committee preference", registration.committee1],
        ["Payment status", registration.paymentStatus],
        ["Registration status", registration.registrationStatus]
      ]
    });

    return NextResponse.json({ registration: serializeRegistration(registration), id: registration.publicId });
  } catch (error) {
    console.error(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "A registration ID conflict occurred. Please submit the form again." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Registration could not be saved right now. Please try again in a minute." },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    assertAdmin();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const paymentStatus = searchParams.get("paymentStatus")?.trim();
    const registrationStatus = searchParams.get("registrationStatus")?.trim();

    const where: Prisma.RegistrationWhereInput = {
      ...(paymentStatus ? { paymentStatus } : {}),
      ...(registrationStatus ? { registrationStatus } : {}),
      ...(search
        ? {
            OR: [
              { publicId: { contains: search, mode: "insensitive" } },
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } },
              { institution: { contains: search, mode: "insensitive" } },
              { committee1: { contains: search, mode: "insensitive" } },
              { utr: { contains: search, mode: "insensitive" } }
            ]
          }
        : {})
    };

    const registrations = await prisma.registration.findMany({
      where,
      include: { notes: { orderBy: { createdAt: "desc" } } },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ registrations: registrations.map(serializeRegistration) });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Could not fetch registrations." }, { status: 500 });
  }
}
