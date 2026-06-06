import { NextResponse } from "next/server";
import { assertAdmin } from "../../../../../../lib/admin";
import { sendRegistrationEmail, maybeSendAllotmentPaymentEmail } from "../../../../../../lib/mail";
import { prisma } from "../../../../../../lib/prisma";
import { serializeDelegationRegistration } from "../../../../../../lib/registrations";
import { operationsEmitter } from "../../../../../../lib/events";

export const dynamic = "force-dynamic";

const paymentStatuses = ["Pending", "Under Review", "Verified", "Rejected"];
const registrationStatuses = ["Pending", "Approved", "Rejected", "Action Needed"];

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    assertAdmin();
    const delegation = await prisma.delegationRegistration.findUnique({
      where: { publicId: params.id },
      include: {
        notes: { orderBy: { createdAt: "desc" } },
        delegates: true,
        paymentTransactions: true
      }
    });

    if (!delegation) {
      return NextResponse.json({ error: "Delegation registration not found" }, { status: 404 });
    }

    return NextResponse.json({ delegation: serializeDelegationRegistration(delegation) });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Could not fetch delegation registration." }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    assertAdmin();
    const body = await request.json();
    const patch: Record<string, any> = {};

    if (body.paymentStatus && !paymentStatuses.includes(String(body.paymentStatus))) {
      return NextResponse.json({ error: "Choose a valid payment status." }, { status: 400 });
    }
    if (body.registrationStatus && !registrationStatuses.includes(String(body.registrationStatus))) {
      return NextResponse.json({ error: "Choose a valid registration status." }, { status: 400 });
    }

    for (const key of [
      "paymentStatus",
      "registrationStatus",
      "delegationName",
      "institution",
      "coTeacherName",
      "coTeacherEmail",
      "coTeacherPhone",
      "city",
      "totalDelegates"
    ]) {
      if (key in body) patch[key] = body[key] === "" ? null : body[key];
    }

    const delegation = await prisma.delegationRegistration.update({
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
      include: { notes: { orderBy: { createdAt: "desc" } }, delegates: true }
    });

    let emailStatus: "sent" | "sent-test" | "failed" | "skipped" | undefined;

    // If payment is verified, automatically check and send emails to delegates in this delegation
    if (body.paymentStatus === "Verified") {
      try {
        const delegateList = delegation.delegates || [];
        for (const delegate of delegateList) {
          await maybeSendAllotmentPaymentEmail({
            targetType: "delegate",
            targetId: delegate.id,
            forceResend: false
          });
        }
      } catch (err) {
        console.error("Auto trigger allotment email check for delegates failed on delegation update", err);
      }
    }

    if (body.paymentStatus === "Verified" && !body.registrationStatus) {
      emailStatus = (await sendRegistrationEmail({
        to: delegation.coTeacherEmail,
        name: delegation.coTeacherName,
        publicId: delegation.publicId,
        heading: "Payment verified",
        action: "Your delegation's payment has been verified by the Invictus MUN organizing team.",
        dashboardPath: `/dashboard?id=${encodeURIComponent(delegation.publicId)}`,
        details: [
          ["Delegation Name", delegation.delegationName],
          ["Payment status", delegation.paymentStatus],
          ["Registration status", delegation.registrationStatus]
        ]
      })).status;
    } else if (body.paymentStatus === "Rejected") {
      emailStatus = (await sendRegistrationEmail({
        to: delegation.coTeacherEmail,
        name: delegation.coTeacherName,
        publicId: delegation.publicId,
        heading: "Payment needs attention",
        action: "Your delegation's payment could not be verified. Please contact the organizing team.",
        dashboardPath: `/dashboard?id=${encodeURIComponent(delegation.publicId)}`,
        details: [
          ["Delegation Name", delegation.delegationName],
          ["Payment status", delegation.paymentStatus],
          ["Registration status", delegation.registrationStatus]
        ]
      })).status;
    } else if (body.registrationStatus === "Approved") {
      emailStatus = (await sendRegistrationEmail({
        to: delegation.coTeacherEmail,
        name: delegation.coTeacherName,
        publicId: delegation.publicId,
        heading: "Registration approved",
        action: "Your delegation's registration has been approved.",
        dashboardPath: `/dashboard?id=${encodeURIComponent(delegation.publicId)}`,
        details: [
          ["Delegation Name", delegation.delegationName],
          ["Payment status", delegation.paymentStatus],
          ["Registration status", delegation.registrationStatus]
        ]
      })).status;
    }

    // Emit event for real-time sync
    operationsEmitter.emit("update", {
      type: "delegate:updated",
      data: {
        publicId: params.id,
        updatedFields: patch,
        registration: serializeDelegationRegistration(delegation)
      }
    });

    return NextResponse.json({ delegation: serializeDelegationRegistration(delegation), emailStatus });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    }
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "This delegation registration no longer exists." }, { status: 404 });
    }
    console.error(error);
    return NextResponse.json({ error: "Could not update delegation registration." }, { status: 500 });
  }
}

