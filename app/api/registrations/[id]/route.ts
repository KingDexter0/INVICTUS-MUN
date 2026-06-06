import { NextResponse } from "next/server";
import { assertAdmin } from "../../../../lib/admin";
import { sendRegistrationEmail } from "../../../../lib/email";
import { prisma } from "../../../../lib/prisma";
import {
  serializeIndividualRegistration,
  serializeDelegationRegistration
} from "../../../../lib/registrations";
import { operationsEmitter } from "../../../../lib/events";

export const dynamic = "force-dynamic";

const paymentStatuses = ["Pending", "Under Review", "Verified", "Rejected"];
const registrationStatuses = ["Pending", "Approved", "Rejected", "Action Needed"];
const allotmentStatuses = ["Not allotted", "Pending", "Allotted"];

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

    // 1. Try to find and update in IndividualRegistration
    const individual = await prisma.individualRegistration.findUnique({
      where: { publicId: params.id }
    });

    if (individual) {
      const updated = await prisma.individualRegistration.update({
        where: { id: individual.id },
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
          to: updated.email,
          name: updated.name,
          publicId: updated.publicId,
          heading: "Payment verified",
          action: "Your payment has been verified by the Invictus MUN organizing team.",
          dashboardPath: `/dashboard?id=${encodeURIComponent(updated.publicId)}`,
          details: [
            ["Payment status", updated.paymentStatus],
            ["Registration status", updated.registrationStatus]
          ]
        })).status;
      } else if (body.paymentStatus === "Rejected") {
        emailStatus = (await sendRegistrationEmail({
          to: updated.email,
          name: updated.name,
          publicId: updated.publicId,
          heading: "Payment needs attention",
          action: "Your payment could not be verified. Please contact the organizing team.",
          dashboardPath: `/dashboard?id=${encodeURIComponent(updated.publicId)}`,
          details: [
            ["Payment status", updated.paymentStatus],
            ["Registration status", updated.registrationStatus]
          ]
        })).status;
      } else if (body.allotmentStatus === "Allotted") {
        emailStatus = (await sendRegistrationEmail({
          to: updated.email,
          name: updated.name,
          publicId: updated.publicId,
          heading: "Allotment released",
          action: "Your Invictus MUN committee and portfolio allotment has been released.",
          dashboardPath: `/dashboard?id=${encodeURIComponent(updated.publicId)}`,
          details: [
            ["Committee", updated.allottedCommittee],
            ["Portfolio", updated.allottedPortfolio],
            ["Allotment status", updated.allotmentStatus]
          ]
        })).status;
      } else if (body.registrationStatus === "Approved") {
        emailStatus = (await sendRegistrationEmail({
          to: updated.email,
          name: updated.name,
          publicId: updated.publicId,
          heading: "Registration approved",
          action: "Your Invictus MUN registration has been approved.",
          dashboardPath: `/dashboard?id=${encodeURIComponent(updated.publicId)}`,
          details: [
            ["Payment status", updated.paymentStatus],
            ["Registration status", updated.registrationStatus]
          ]
        })).status;
      }

      const serialized = {
        ...serializeIndividualRegistration(updated),
        registrationType: "individual"
      };

      operationsEmitter.emit("update", {
        type: "delegate:updated",
        data: {
          publicId: params.id,
          updatedFields: patch,
          registration: serialized
        }
      });

      return NextResponse.json({ registration: serialized, emailStatus });
    }

    // 2. Try to find and update in DelegationRegistration
    const delegation = await prisma.delegationRegistration.findUnique({
      where: { publicId: params.id }
    });

    if (delegation) {
      const updated = await prisma.delegationRegistration.update({
        where: { id: delegation.id },
        data: {
          paymentStatus: patch.paymentStatus || undefined,
          registrationStatus: patch.registrationStatus || undefined,
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
      if (body.paymentStatus === "Verified" && !body.registrationStatus) {
        emailStatus = (await sendRegistrationEmail({
          to: updated.coTeacherEmail,
          name: updated.coTeacherName,
          publicId: updated.publicId,
          heading: "Payment verified",
          action: "Your delegation's payment has been verified by the Invictus MUN organizing team.",
          dashboardPath: `/dashboard?id=${encodeURIComponent(updated.publicId)}`,
          details: [
            ["Delegation Name", updated.delegationName],
            ["Payment status", updated.paymentStatus],
            ["Registration status", updated.registrationStatus]
          ]
        })).status;
      } else if (body.paymentStatus === "Rejected") {
        emailStatus = (await sendRegistrationEmail({
          to: updated.coTeacherEmail,
          name: updated.coTeacherName,
          publicId: updated.publicId,
          heading: "Payment needs attention",
          action: "Your delegation's payment could not be verified. Please contact the organizing team.",
          dashboardPath: `/dashboard?id=${encodeURIComponent(updated.publicId)}`,
          details: [
            ["Delegation Name", updated.delegationName],
            ["Payment status", updated.paymentStatus],
            ["Registration status", updated.registrationStatus]
          ]
        })).status;
      } else if (body.registrationStatus === "Approved") {
        emailStatus = (await sendRegistrationEmail({
          to: updated.coTeacherEmail,
          name: updated.coTeacherName,
          publicId: updated.publicId,
          heading: "Registration approved",
          action: "Your delegation's registration has been approved.",
          dashboardPath: `/dashboard?id=${encodeURIComponent(updated.publicId)}`,
          details: [
            ["Delegation Name", updated.delegationName],
            ["Payment status", updated.paymentStatus],
            ["Registration status", updated.registrationStatus]
          ]
        })).status;
      }

      const serialized = {
        ...serializeDelegationRegistration(updated),
        name: updated.delegationName,
        email: updated.coTeacherEmail,
        phone: updated.coTeacherPhone,
        type: "Group Delegation",
        committee1: "Group Delegation",
        registrationType: "delegation"
      };

      operationsEmitter.emit("update", {
        type: "delegate:updated",
        data: {
          publicId: params.id,
          updatedFields: patch,
          registration: serialized
        }
      });

      return NextResponse.json({ registration: serialized, emailStatus });
    }

    return NextResponse.json({ error: "Registration not found" }, { status: 404 });

  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Could not update registration." }, { status: 500 });
  }
}
