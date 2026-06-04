import { NextResponse } from "next/server";
import { assertAdmin } from "../../../../lib/admin";
import { prisma } from "../../../../lib/prisma";
import { csvEscape } from "../../../../lib/registrations";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    assertAdmin();
    const registrations = await prisma.registration.findMany({
      orderBy: { createdAt: "desc" }
    });

    const headers = [
      "publicId",
      "name",
      "email",
      "phone",
      "institution",
      "type",
      "committee1",
      "committee2",
      "portfolio1",
      "paymentStatus",
      "registrationStatus",
      "allotmentStatus",
      "allottedCommittee",
      "allottedPortfolio",
      "amount",
      "utr",
      "paymentProofUrl",
      "createdAt"
    ];

    const csv = [
      headers.join(","),
      ...registrations.map((registration) =>
        headers
          .map((header) => {
            const value = registration[header as keyof typeof registration];
            return csvEscape(value instanceof Date ? value.toISOString() : value);
          })
          .join(",")
      )
    ].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=invictus-registrations.csv"
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
