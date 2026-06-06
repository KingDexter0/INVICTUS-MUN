import { NextResponse } from "next/server";
import { assertAdmin } from "../../../../../../lib/admin";
import { prisma } from "../../../../../../lib/prisma";
import { isSmtpConfigured } from "../../../../../../lib/mail";
import { getBaseUrl } from "../../../../../../lib/url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAppUrlStatus() {
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "";
  const isSet = Boolean(appUrl);
  const isLocalhost = appUrl.includes("localhost") || appUrl.includes("127.0.0.1");
  const isProduction = isSet && !isLocalhost && appUrl.startsWith("https://");
  return { appUrl: isSet ? appUrl : "(not set)", isSet, isLocalhost, isProduction };
}

export async function GET() {
  try {
    assertAdmin();

    const appUrlStatus = getAppUrlStatus();
    const smtpOk = isSmtpConfigured();

    // ── Individual Registrations ──────────────────────────────────────────────
    const [individuals, delegates] = await Promise.all([
      prisma.individualRegistration.findMany({
        select: {
          id: true,
          publicId: true,
          name: true,
          email: true,
          trackingToken: true,
          allottedCommittee: true,
          allottedPortfolio: true,
          committee1: true,
          portfolio1: true,
          paymentStatus: true,
          allotmentEmailSent: true,
          allotmentEmailSentAt: true
        },
        orderBy: { createdAt: "asc" }
      }),
      prisma.delegationDelegate.findMany({
        select: {
          id: true,
          publicId: true,
          name: true,
          email: true,
          trackingToken: true,
          allottedCommittee: true,
          allottedPortfolio: true,
          committee1: true,
          portfolio1: true,
          allotmentEmailSent: true,
          allotmentEmailSentAt: true,
          delegation: {
            select: { delegationName: true, paymentStatus: true }
          }
        },
        orderBy: { createdAt: "asc" }
      })
    ]);

    // ── Categorise individuals ───────────────────────────────────────────────
    const indStats = { eligible: 0, alreadySent: 0, missingEmail: 0, missingToken: 0, missingAllotment: 0 };
    const eligibleIndividuals: typeof individuals = [];

    for (const r of individuals) {
      if (r.allotmentEmailSent) { indStats.alreadySent++; continue; }
      if (!r.email) { indStats.missingEmail++; continue; }
      if (!r.trackingToken) { indStats.missingToken++; continue; }
      const committee = r.allottedCommittee || r.committee1;
      if (!committee) { indStats.missingAllotment++; continue; }
      indStats.eligible++;
      eligibleIndividuals.push(r);
    }

    // ── Categorise delegates ─────────────────────────────────────────────────
    const delStats = { eligible: 0, alreadySent: 0, missingEmail: 0, missingToken: 0, missingAllotment: 0 };
    const eligibleDelegates: typeof delegates = [];

    for (const d of delegates) {
      if (d.allotmentEmailSent) { delStats.alreadySent++; continue; }
      if (!d.email) { delStats.missingEmail++; continue; }
      if (!d.trackingToken) { delStats.missingToken++; continue; }
      const committee = d.allottedCommittee || d.committee1;
      if (!committee) { delStats.missingAllotment++; continue; }
      delStats.eligible++;
      eligibleDelegates.push(d);
    }

    // ── Sample recipients (up to 5 each) ────────────────────────────────────
    let baseUrl = "";
    try { baseUrl = getBaseUrl(); } catch { baseUrl = "(APP_URL not set)"; }

    const sampleIndividuals = eligibleIndividuals.slice(0, 5).map((r) => ({
      name: r.name,
      email: r.email,
      publicId: r.publicId,
      committee: r.allottedCommittee || r.committee1,
      dashboardUrl: r.trackingToken ? `${baseUrl}/dashboard?id=${encodeURIComponent(r.trackingToken)}` : "(no token)"
    }));

    const sampleDelegates = eligibleDelegates.slice(0, 5).map((d) => ({
      name: d.name,
      email: d.email,
      publicId: d.publicId,
      delegationName: d.delegation.delegationName,
      committee: d.allottedCommittee || d.committee1,
      dashboardUrl: d.trackingToken ? `${baseUrl}/dashboard?id=${encodeURIComponent(d.trackingToken)}` : "(no token)"
    }));

    return NextResponse.json({
      appUrl: appUrlStatus,
      smtp: { configured: smtpOk },
      totals: {
        individuals: {
          total: individuals.length,
          eligible: indStats.eligible,
          alreadySent: indStats.alreadySent,
          missingEmail: indStats.missingEmail,
          missingToken: indStats.missingToken,
          missingAllotment: indStats.missingAllotment
        },
        delegates: {
          total: delegates.length,
          eligible: delStats.eligible,
          alreadySent: delStats.alreadySent,
          missingEmail: delStats.missingEmail,
          missingToken: delStats.missingToken,
          missingAllotment: delStats.missingAllotment
        },
        totalEligible: indStats.eligible + delStats.eligible,
        totalAlreadySent: indStats.alreadySent + delStats.alreadySent
      },
      samples: { individuals: sampleIndividuals, delegates: sampleDelegates }
    });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Could not load preview." }, { status: 500 });
  }
}
