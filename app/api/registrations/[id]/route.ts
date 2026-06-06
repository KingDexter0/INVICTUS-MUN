import { NextResponse } from "next/server";
import { assertAdmin } from "../../../../lib/admin";
import { sendRegistrationEmail } from "../../../../lib/email";
import { prisma } from "../../../../lib/prisma";
import { serializeRegistration } from "../../../../lib/registrations";
import { operationsEmitter } from "../../../../lib/events";

export const dynamic = "force-dynamic";

const paymentStatuses = ["Pending", "Under Review", "Verified", "Rejected"];
const registrationStatuses = ["Pending", "Approved", "Rejected", "Action Needed"];
const allotmentStatuses = ["Pending", "Allotted"];

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    assertAdmin();
    const body = await request.json();
    const patch: Record<string, string | null> = {};

    if (body.paymentStatus && !paymentStatuses.includes(String(body.paymentStatus))) {
      return NextResponse.json({ error: "Choose a valid payment status." }, { status: 400 });
    }
    if (body.registrationStatus && !registrationStatuses.includes(String(body.registrationStatus))) {
      return NextResponse.json({ error: "Choose a valid registration status." }, { status: 400 });
    }
    if (body.allotmentStatus && !allotmentStatuses.includes(String(body.allotmentStatus))) {
      return NextResponse.json({ error: "Choose a valid allotment status." }, { status: 400 });
    }
    if (body.allotmentStatus === "Allotted" && (!String(body.allottedCommittee || "").trim() || !String(body.allottedPortfolio || "").trim())) {
      return NextResponse.json({ error: "Add both allotted committee and portfolio before releasing allotment." }, { status: 400 });
    }

    for (const key of [
      "paymentStatus",
      "registrationStatus",
      "allotmentStatus",
      "allottedCommittee",
      "allottedPortfolio"
    ]) {
      if (key in body) patch[key] = body[key] || null;
    }

    const registration = await prisma.registration.update({
      where: { publicId: params.id },
      data: {
        ...patch,
        notes: body.note
          ? {
              create: {
                note: String(body.note)
              }
            }
          : undefined
      },
      include: { notes: { orderBy: { createdAt: "desc" } } }
    });

    let emailStatus: "sent" | "sent-test" | "failed" | "skipped" | undefined;
    if (body.paymentStatus === "Verified" && !body.registrationStatus && !body.allotmentStatus) {
      emailStatus = (await sendRegistrationEmail({
        to: registration.email,
        name: registration.name,
        publicId: registration.publicId,
        heading: "Payment verified",
        action: "Your payment has been verified by the Invictus MUN organizing team.",
        dashboardPath: `/dashboard?id=${encodeURIComponent(registration.publicId)}`,
        details: [
          ["Payment status", registration.paymentStatus],
          ["Registration status", registration.registrationStatus]
        ]
      })).status;
    } else if (body.paymentStatus === "Rejected") {
      emailStatus = (await sendRegistrationEmail({
        to: registration.email,
        name: registration.name,
        publicId: registration.publicId,
        heading: "Payment needs attention",
        action: "Your payment could not be verified. Please contact the organizing team with your transaction screenshot.",
        dashboardPath: `/dashboard?id=${encodeURIComponent(registration.publicId)}`,
        details: [
          ["Payment status", registration.paymentStatus],
          ["Registration status", registration.registrationStatus]
        ]
      })).status;
    } else if (body.allotmentStatus === "Allotted") {
      emailStatus = (await sendRegistrationEmail({
        to: registration.email,
        name: registration.name,
        publicId: registration.publicId,
        heading: "Allotment released",
        action: "Your Invictus MUN committee and portfolio allotment has been released.",
        dashboardPath: `/dashboard?id=${encodeURIComponent(registration.publicId)}`,
        details: [
          ["Committee", registration.allottedCommittee],
          ["Portfolio", registration.allottedPortfolio],
          ["Allotment status", registration.allotmentStatus]
        ]
      })).status;
    } else if (body.registrationStatus === "Approved") {
      emailStatus = (await sendRegistrationEmail({
        to: registration.email,
        name: registration.name,
        publicId: registration.publicId,
        heading: "Registration approved",
        action: "Your Invictus MUN registration has been approved.",
        dashboardPath: `/dashboard?id=${encodeURIComponent(registration.publicId)}`,
        details: [
          ["Payment status", registration.paymentStatus],
          ["Registration status", registration.registrationStatus]
        ]
      })).status;
    }

    operationsEmitter.emit("update", {
      type: "delegate:updated",
      data: {
        publicId: params.id,
        updatedFields: patch,
        registration: serializeRegistration(registration)
      }
    });

    return NextResponse.json({ registration: serializeRegistration(registration), emailStatus });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    }
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "This registration no longer exists." }, { status: 404 });
    }
    console.error(error);
    return NextResponse.json({ error: "Could not update registration." }, { status: 500 });
  }
}
