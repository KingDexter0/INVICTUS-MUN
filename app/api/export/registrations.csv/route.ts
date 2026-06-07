import { NextResponse } from "next/server";
import { assertAdmin } from "../../../../lib/admin";
import { prisma } from "../../../../lib/prisma";
import { csvEscape } from "../../../../lib/registrations";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    assertAdmin();

    // 1. Fetch Individual Registrations
    const individuals = await prisma.individualRegistration.findMany({
      orderBy: { createdAt: "desc" }
    });

    // 2. Fetch Delegation Registrations along with their delegates
    const delegations = await prisma.delegationRegistration.findMany({
      include: {
        delegates: true
      },
      orderBy: { createdAt: "desc" }
    });

    console.log(`[CSV EXPORT] Found ${individuals.length} individual registrations and ${delegations.length} delegation registrations.`);

    // Define CSV columns/headers
    const headers = [
      "Registration ID",
      "Registration Type",
      "Delegate Name",
      "Email",
      "Phone",
      "School / College",
      "Committee Preferences",
      "Portfolio Preferences",
      "Allotted Committee",
      "Allotted Portfolio",
      "Delegation Name",
      "Head Delegate / Coordinating Teacher",
      "Coordinating Teacher Email",
      "Coordinating Teacher Phone",
      "Payment Status",
      "Amount Paid",
      "Payment ID / UTR",
      "Check-in Status",
      "Certificate Status",
      "Registration Date"
    ];

    const rows: string[] = [];

    // Add individuals
    for (const ind of individuals) {
      const committeePrefs = [ind.committee1, ind.committee2].filter(Boolean).join(" | ");
      const portfolioPrefs = [ind.portfolio1, ind.portfolio2].filter(Boolean).join(" | ");

      const row = [
        ind.publicId,
        "Individual",
        ind.name,
        ind.email,
        ind.phone,
        ind.institution || "",
        committeePrefs,
        portfolioPrefs,
        ind.allottedCommittee || "",
        ind.allottedPortfolio || "",
        ind.delegationName || "",
        "", // Co-teacher name
        "", // Co-teacher email
        "", // Co-teacher phone
        ind.paymentStatus,
        String(ind.totalAmountPaid),
        ind.utr || "",
        ind.checkedIn ? "Checked In" : "Not Checked In",
        ind.certificateReleased ? "Released" : "Not Released",
        ind.createdAt.toISOString()
      ];

      rows.push(row.map(csvEscape).join(","));
    }

    // Add delegation delegates
    for (const del of delegations) {
      for (const d of del.delegates) {
        const row = [
          d.publicId,
          "Delegation",
          d.name,
          d.email || "",
          d.phone || "",
          del.institution || "",
          d.committee1 || "",
          d.portfolio1 || "",
          d.allottedCommittee || "",
          d.allottedPortfolio || "",
          del.delegationName,
          del.coTeacherName,
          del.coTeacherEmail,
          del.coTeacherPhone,
          del.paymentStatus,
          String(del.totalAmountPaid),
          "", // No direct UTR
          d.checkedIn ? "Checked In" : "Not Checked In",
          d.certificateReleased ? "Released" : "Not Released",
          d.createdAt.toISOString()
        ];

        rows.push(row.map(csvEscape).join(","));
      }

      // If a delegation has no delegates in the roster yet, we still want to export the parent record so they don't lose the registration details or payment!
      if (del.delegates.length === 0) {
        const row = [
          del.publicId,
          "Delegation",
          "N/A (No delegates in roster)",
          del.coTeacherEmail,
          del.coTeacherPhone,
          del.institution || "",
          "",
          "",
          "",
          "",
          del.delegationName,
          del.coTeacherName,
          del.coTeacherEmail,
          del.coTeacherPhone,
          del.paymentStatus,
          String(del.totalAmountPaid),
          "",
          "N/A",
          "N/A",
          del.createdAt.toISOString()
        ];
        rows.push(row.map(csvEscape).join(","));
      }
    }

    // Prepend UTF-8 BOM \uFEFF to make Excel open it with correct UTF-8 formatting
    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=\"invictus-registrations-export.csv\""
      }
    });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Could not export registrations." }, { status: 500 });
  }
}
