import { NextResponse } from "next/server";
import { assertAdmin } from "../../../../../../lib/admin";
import { prisma } from "../../../../../../lib/prisma";
import { isSmtpConfigured, sendWelcomeAllotmentEmail, getSmtpProvider } from "../../../../../../lib/mail";
import { getBaseUrl } from "../../../../../../lib/url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_BATCH_SIZE = 25;

function validateAppUrl() {
  try {
    const baseUrl = getBaseUrl();
    if (baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1")) {
      return { ok: false, error: `APP_URL points to localhost: "${baseUrl}".` };
    }
    if (!baseUrl.startsWith("https://")) {
      return { ok: false, error: `APP_URL must start with https://. Got: "${baseUrl}"` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: "APP_URL is not set." };
  }
}

export async function POST(request: Request) {
  try {
    assertAdmin();

    const body = await request.json().catch(() => ({}));
    if (!body?.confirm) {
      return NextResponse.json({ error: "Requires confirm=true." }, { status: 400 });
    }

    const urlCheck = validateAppUrl();
    if (!urlCheck.ok) {
      return NextResponse.json({ error: urlCheck.error }, { status: 503 });
    }
    if (!isSmtpConfigured()) {
      return NextResponse.json({ error: "SMTP is not configured." }, { status: 503 });
    }

    const batchSize = Math.min(Math.max(Number(body.batchSize) || DEFAULT_BATCH_SIZE, 1), 25);

    // Find records that previously failed (not sent, email log shows FAILED)
    const failedLogs = await prisma.emailLog.findMany({
      where: { type: "WELCOME_ALLOTMENT", status: "FAILED" },
      orderBy: { createdAt: "desc" },
      distinct: ["targetId", "targetType"]
    });

    // Build sets of failed publicIds per type
    const failedIndividualIds = new Set(
      failedLogs.filter((l) => l.targetType === "individual").map((l) => l.targetId).filter(Boolean) as string[]
    );
    const failedDelegateIds = new Set(
      failedLogs.filter((l) => l.targetType === "delegationDelegate").map((l) => l.targetId).filter(Boolean) as string[]
    );

    // Also include unsent (allotmentEmailSent=false) that have email/token/committee
    const [individuals, delegates] = await Promise.all([
      prisma.individualRegistration.findMany({
        where: {
          OR: [
            { allotmentEmailSent: false },
            { publicId: { in: Array.from(failedIndividualIds) } }
          ],
          email: { not: "" }
        },
        select: {
          id: true, publicId: true, name: true, email: true, trackingToken: true,
          allottedCommittee: true, allottedPortfolio: true, committee1: true, portfolio1: true,
          paymentStatus: true
        },
        orderBy: { createdAt: "asc" }
      }),
      prisma.delegationDelegate.findMany({
        where: {
          OR: [
            { allotmentEmailSent: false },
            { publicId: { in: Array.from(failedDelegateIds) } }
          ],
          email: { not: null }
        },
        select: {
          id: true, publicId: true, name: true, email: true, trackingToken: true,
          allottedCommittee: true, allottedPortfolio: true, committee1: true, portfolio1: true,
          delegation: { select: { delegationName: true, paymentStatus: true } }
        },
        orderBy: { createdAt: "asc" }
      })
    ]);

    const eligibleIndividuals = individuals.filter(
      (r) => r.email && r.trackingToken && (r.allottedCommittee || r.committee1)
    );
    const eligibleDelegates = delegates.filter(
      (d) => d.email && d.trackingToken && (d.allottedCommittee || d.committee1)
    );

    type BatchItem =
      | { kind: "individual"; record: (typeof eligibleIndividuals)[0] }
      | { kind: "delegate"; record: (typeof eligibleDelegates)[0] };

    const allItems: BatchItem[] = [
      ...eligibleIndividuals.map((r) => ({ kind: "individual" as const, record: r })),
      ...eligibleDelegates.map((d) => ({ kind: "delegate" as const, record: d }))
    ];

    const batch = allItems.slice(0, batchSize);
    const remaining = allItems.length - batch.length;
    let sent = 0;
    let failed = 0;
    let authErrorOccurred = false;
    let authErrorMessage = "";

    for (let i = 0; i < batch.length; i++) {
      const item = batch[i];

      // Delay between sends
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      if (item.kind === "individual") {
        const r = item.record;
        const committee = r.allottedCommittee || r.committee1 || "";
        const portfolio = r.allottedPortfolio || r.portfolio1 || "";
        try {
          await sendWelcomeAllotmentEmail({
            to: r.email,
            name: r.name,
            publicId: r.publicId,
            trackingToken: r.trackingToken!,
            registrationType: "individual",
            committee,
            portfolio,
            paymentStatus: r.paymentStatus,
            targetType: "individual"
          });
          await prisma.individualRegistration.update({
            where: { id: r.id },
            data: { allotmentEmailSent: true, allotmentEmailSentAt: new Date() }
          });
          await prisma.emailLog.create({
            data: {
              type: "WELCOME_ALLOTMENT",
              recipient: r.email,
              targetType: "individual",
              targetId: r.publicId,
              status: "SENT",
              provider: getSmtpProvider()
            }
          });
          sent++;
        } catch (err: any) {
          const errMsg = err instanceof Error ? err.message : String(err);
          const errCode = err?.code;
          const errResponseCode = err?.responseCode;
          const isAuthBlock = errCode === "EAUTH" || errResponseCode === 454;

          await prisma.emailLog.create({
            data: {
              type: "WELCOME_ALLOTMENT",
              recipient: r.email,
              targetType: "individual",
              targetId: r.publicId,
              status: "FAILED",
              error: isAuthBlock ? "SMTP_AUTH_BLOCKED_TOO_MANY_LOGIN_ATTEMPTS" : errMsg.slice(0, 500),
              provider: getSmtpProvider()
            }
          }).catch(() => {});

          failed++;

          if (isAuthBlock) {
            authErrorOccurred = true;
            authErrorMessage = "Gmail SMTP blocked login attempts. Wait before retrying, verify App Password, or switch to a production email provider like Brevo/SendGrid/Resend.";
            break;
          }
        }
      } else {
        const d = item.record;
        const committee = d.allottedCommittee || d.committee1 || "";
        const portfolio = d.allottedPortfolio || d.portfolio1 || "";
        try {
          await sendWelcomeAllotmentEmail({
            to: d.email!,
            name: d.name,
            publicId: d.publicId,
            trackingToken: d.trackingToken!,
            registrationType: "delegate",
            delegationName: d.delegation.delegationName,
            committee,
            portfolio,
            paymentStatus: d.delegation.paymentStatus,
            targetType: "delegationDelegate"
          });
          await prisma.delegationDelegate.update({
            where: { id: d.id },
            data: { allotmentEmailSent: true, allotmentEmailSentAt: new Date() }
          });
          await prisma.emailLog.create({
            data: {
              type: "WELCOME_ALLOTMENT",
              recipient: d.email!,
              targetType: "delegationDelegate",
              targetId: d.publicId,
              status: "SENT",
              provider: getSmtpProvider()
            }
          });
          sent++;
        } catch (err: any) {
          const errMsg = err instanceof Error ? err.message : String(err);
          const errCode = err?.code;
          const errResponseCode = err?.responseCode;
          const isAuthBlock = errCode === "EAUTH" || errResponseCode === 454;

          await prisma.emailLog.create({
            data: {
              type: "WELCOME_ALLOTMENT",
              recipient: d.email!,
              targetType: "delegationDelegate",
              targetId: d.publicId,
              status: "FAILED",
              error: isAuthBlock ? "SMTP_AUTH_BLOCKED_TOO_MANY_LOGIN_ATTEMPTS" : errMsg.slice(0, 500),
              provider: getSmtpProvider()
            }
          }).catch(() => {});

          failed++;

          if (isAuthBlock) {
            authErrorOccurred = true;
            authErrorMessage = "Gmail SMTP blocked login attempts. Wait before retrying, verify App Password, or switch to a production email provider like Brevo/SendGrid/Resend.";
            break;
          }
        }
      }
    }

    if (authErrorOccurred) {
      return NextResponse.json({
        error: authErrorMessage,
        isAuthBlock: true,
        sent,
        failed,
        remaining: allItems.length - sent
      }, { status: 403 });
    }

    const done = remaining === 0;
    return NextResponse.json({ success: true, done, sent, failed, remaining });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Could not resend failed emails." }, { status: 500 });
  }
}
