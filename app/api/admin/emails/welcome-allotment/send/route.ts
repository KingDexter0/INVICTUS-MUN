import { NextResponse } from "next/server";
import { assertAdmin } from "../../../../../../lib/admin";
import { prisma } from "../../../../../../lib/prisma";
import { isSmtpConfigured, sendWelcomeAllotmentEmail, getSmtpProvider } from "../../../../../../lib/mail";
import { getBaseUrl } from "../../../../../../lib/url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_BATCH_SIZE = 25;

function validateAppUrl(): { ok: boolean; error?: string; baseUrl: string } {
  let baseUrl = "";
  try {
    baseUrl = getBaseUrl();
  } catch (err) {
    return { ok: false, error: "APP_URL is not set. Cannot send emails with valid links.", baseUrl: "" };
  }
  if (baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1")) {
    return { ok: false, error: `APP_URL is set to localhost: "${baseUrl}". Set a production URL in Vercel.`, baseUrl };
  }
  if (!baseUrl.startsWith("https://")) {
    return { ok: false, error: `APP_URL must start with https://. Current: "${baseUrl}"`, baseUrl };
  }
  return { ok: true, baseUrl };
}

export async function POST(request: Request) {
  try {
    assertAdmin();

    const body = await request.json().catch(() => ({}));
    if (!body?.confirm) {
      return NextResponse.json({ error: "Send requires confirm=true in request body." }, { status: 400 });
    }

    // Validate environment
    const urlCheck = validateAppUrl();
    if (!urlCheck.ok) {
      return NextResponse.json({ error: urlCheck.error }, { status: 503 });
    }
    if (!isSmtpConfigured()) {
      return NextResponse.json({ error: "SMTP is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in Vercel environment variables." }, { status: 503 });
    }

    const batchSize = Math.min(Math.max(Number(body.batchSize) || DEFAULT_BATCH_SIZE, 1), 25);

    // ── Fetch all unsent eligible records ────────────────────────────────────
    const [individuals, delegates] = await Promise.all([
      prisma.individualRegistration.findMany({
        where: { allotmentEmailSent: false, email: { not: "" } },
        select: {
          id: true, publicId: true, name: true, email: true, trackingToken: true,
          allottedCommittee: true, allottedPortfolio: true, committee1: true, portfolio1: true,
          paymentStatus: true
        },
        orderBy: { createdAt: "asc" }
      }),
      prisma.delegationDelegate.findMany({
        where: { allotmentEmailSent: false, email: { not: null } },
        select: {
          id: true, publicId: true, name: true, email: true, trackingToken: true,
          allottedCommittee: true, allottedPortfolio: true, committee1: true, portfolio1: true,
          delegation: { select: { delegationName: true, paymentStatus: true } }
        },
        orderBy: { createdAt: "asc" }
      })
    ]);

    // ── Filter truly eligible (must have email + token + committee) ──────────
    const eligibleIndividuals = individuals.filter(
      (r) => r.email && r.trackingToken && (r.allottedCommittee || r.committee1)
    );
    const eligibleDelegates = delegates.filter(
      (d) => d.email && d.trackingToken && (d.allottedCommittee || d.committee1)
    );

    // Interleave: take batchSize total across both groups
    type IndItem = (typeof eligibleIndividuals)[0];
    type DelItem = (typeof eligibleDelegates)[0];
    type BatchItem = { kind: "individual"; record: IndItem } | { kind: "delegate"; record: DelItem };

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

          console.error(`[welcome-allotment] Failed to send to ${r.email}:`, errMsg);

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

          console.error(`[welcome-allotment] Failed to send to ${d.email}:`, errMsg);

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
    return NextResponse.json({ error: "Could not send emails." }, { status: 500 });
  }
}
