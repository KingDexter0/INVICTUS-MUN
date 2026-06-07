import { NextResponse } from "next/server";
import { assertAdmin } from "../../../../lib/admin";
import { prisma } from "../../../../lib/prisma";
import { ensureUniqueTrackingToken } from "../../../../lib/tracking-token";
import { publicIdFromCount } from "../../../../lib/registrations";

export const dynamic = "force-dynamic";

// Simple, robust CSV parser supporting quotes and commas
function parseCSV(text: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let insideQuote = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (insideQuote) {
      if (char === '"') {
        if (nextChar === '"') {
          cell += '"';
          i++; // Skip next quote
        } else {
          insideQuote = false;
        }
      } else {
        cell += char;
      }
    } else {
      if (char === '"') {
        insideQuote = true;
      } else if (char === ",") {
        row.push(cell);
        cell = "";
      } else if (char === "\n" || char === "\r") {
        row.push(cell);
        result.push(row);
        row = [];
        cell = "";
        if (char === "\r" && nextChar === "\n") {
          i++;
        }
      } else {
        cell += char;
      }
    }
  }

  if (cell !== "" || row.length > 0) {
    row.push(cell);
    result.push(row);
  }

  return result
    .map((r) => r.map((c) => c.trim()))
    .filter((r) => r.some((c) => c !== ""));
}

export async function POST(request: Request) {
  try {
    assertAdmin();
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file || file.size === 0) {
      return NextResponse.json({ error: "Please upload a CSV file." }, { status: 400 });
    }

    const text = await file.text();
    const rawRows = parseCSV(text);

    if (rawRows.length < 2) {
      return NextResponse.json({ error: "CSV must contain a header row and at least one data row." }, { status: 400 });
    }

    const rawHeaders = rawRows[0];
    const dataRows = rawRows.slice(1);

    // Normalize headers for flexible mapping
    const headerMap: Record<string, string> = {
      "delegate name": "name",
      "name": "name",
      "delegatename": "name",
      "email": "email",
      "delegateemail": "email",
      "phone": "phone",
      "contact": "phone",
      "mobile": "phone",
      "phonenumber": "phone",
      "school": "institution",
      "college": "institution",
      "school/college": "institution",
      "school / college": "institution",
      "institution": "institution",
      "grade": "gradeYear",
      "year": "gradeYear",
      "grade/year": "gradeYear",
      "grade / year": "gradeYear",
      "gradeyear": "gradeYear",
      "delegation name": "delegationName",
      "delegation": "delegationName",
      "delegation_name": "delegationName",
      "group": "delegationName",
      "groupname": "delegationName",
      "schooldelegation": "delegationName",
      "head delegate / coordinating teacher": "coTeacherName",
      "head delegate": "coTeacherName",
      "coordinating teacher": "coTeacherName",
      "co-ordinating teacher": "coTeacherName",
      "coteachername": "coTeacherName",
      "teachername": "coTeacherName",
      "coteacheremail": "coTeacherEmail",
      "coteacherphone": "coTeacherPhone",
      "committee preference 1": "committee1",
      "committee1": "committee1",
      "preference1": "committee1",
      "committee preference 2": "committee2",
      "committee2": "committee2",
      "preference2": "committee2",
      "portfolio preference 1": "portfolio1",
      "portfolio1": "portfolio1",
      "portfolio preference 2": "portfolio2",
      "portfolio2": "portfolio2",
      "payment status": "paymentStatus",
      "paymentstatus": "paymentStatus",
      "payment id / transaction id": "utr",
      "payment id": "utr",
      "transaction id": "utr",
      "utr": "utr",
      "check-in status": "checkedIn",
      "checkin status": "checkedIn",
      "check-in": "checkedIn",
      "checkin": "checkedIn",
      "checkedin": "checkedIn",
      "certificate status": "certificateReleased",
      "certificate eligibility": "certificateReleased",
      "certificate": "certificateReleased",
      "certificatereleased": "certificateReleased",
      "notes": "notes",
      "note": "notes"
    };

    const mappedHeaders = rawHeaders.map((header) => {
      const cleaned = header.toLowerCase().replace(/[^a-z0-9\s/]/g, "").trim();
      return headerMap[cleaned] || cleaned;
    });

    let importedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    const duplicates: string[] = [];

    // Cache existing database counters
    let countInd = await prisma.individualRegistration.count();
    let countDel = await prisma.delegationRegistration.count();

    // Cache delegation objects created in this batch or database
    const delegationCache: Record<string, any> = {};

    for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex++) {
      const rawRow = dataRows[rowIndex];
      const rowNum = rowIndex + 2; // Row number in Excel/CSV (1-indexed headers is row 1)

      // Map row elements to fields object
      const fields: Record<string, string> = {};
      mappedHeaders.forEach((header, index) => {
        if (header) {
          fields[header] = (rawRow[index] || "").trim();
        }
      });

      const name = fields.name;
      const email = fields.email;
      const phone = fields.phone;

      // Validate required minimum fields
      if (!name) {
        failedCount++;
        errors.push(`Row ${rowNum}: Missing Delegate Name.`);
        continue;
      }

      if (!email && !phone) {
        failedCount++;
        errors.push(`Row ${rowNum}: Missing Email or Phone.`);
        continue;
      }

      // Check duplicates
      let isDuplicate = false;
      if (email) {
        const indExists = await prisma.individualRegistration.findUnique({
          where: { email }
        });
        const delExists = await prisma.delegationDelegate.findFirst({
          where: { email }
        });

        if (indExists || delExists) {
          isDuplicate = true;
          skippedCount++;
          duplicates.push(`${name} (${email})`);
          continue;
        }
      }

      // Determine Registration Type: Individual vs Delegation
      const delegationName = fields.delegationName;

      if (!delegationName) {
        // --- CREATE INDIVIDUAL REGISTRATION ---
        const publicId = publicIdFromCount(countInd + countDel);
        countInd++;

        const trackingToken = await ensureUniqueTrackingToken();
        const paymentStatus = fields.paymentStatus || "Verified";
        const totalAmountPaid = fields.utr ? 2100 : 0;

        await prisma.individualRegistration.create({
          data: {
            publicId,
            trackingToken,
            name,
            email: email || `${publicId.toLowerCase()}@invictus.local`,
            phone: phone || "0000000000",
            institution: fields.institution || null,
            gradeYear: fields.gradeYear || null,
            committee1: fields.committee1 || "UNHRC",
            portfolio1: fields.portfolio1 || null,
            committee2: fields.committee2 || null,
            portfolio2: fields.portfolio2 || null,
            paymentStatus,
            utr: fields.utr || null,
            registrationStatus: "Approved",
            allotmentStatus: fields.committee1 ? "Allotted" : "Not allotted",
            allottedCommittee: fields.committee1 || null,
            allottedPortfolio: fields.portfolio1 || null,
            checkedIn: fields.checkedIn?.toLowerCase() === "true" || fields.checkedIn?.toLowerCase() === "checked in",
            certificateReleased: fields.certificateReleased?.toLowerCase() === "true" || fields.certificateReleased?.toLowerCase() === "released",
            totalAmountPaid,
            registrationType: "individual"
          }
        });

        // Add optional notes
        if (fields.notes) {
          const created = await prisma.individualRegistration.findUnique({
            where: { publicId }
          });
          if (created) {
            await prisma.individualAdminNote.create({
              data: {
                registrationId: created.id,
                note: fields.notes
              }
            });
          }
        }

        importedCount++;
      } else {
        // --- CREATE / CONNECT DELEGATION REGISTRATION ---
        let delegationRecord = delegationCache[delegationName.toLowerCase()];

        if (!delegationRecord) {
          // Check if delegation already exists in DB
          delegationRecord = await prisma.delegationRegistration.findUnique({
            where: { delegationName },
            include: { delegates: true }
          });

          if (!delegationRecord) {
            const publicId = publicIdFromCount(countInd + countDel);
            countDel++;

            const coTeacherName = fields.coTeacherName || "N/A";
            const coTeacherEmail = fields.coTeacherEmail || `teacher-${publicId.toLowerCase()}@invictus.local`;
            const coTeacherPhone = fields.coTeacherPhone || "0000000000";

            delegationRecord = await prisma.delegationRegistration.create({
              data: {
                publicId,
                delegationName,
                institution: fields.institution || null,
                coTeacherName,
                coTeacherEmail,
                coTeacherPhone,
                amount: 20000,
                paymentStatus: fields.paymentStatus || "Verified",
                registrationStatus: "Approved",
                totalAmountPaid: fields.paymentStatus === "Verified" ? 20000 : 0
              },
              include: { delegates: true }
            });

            // Add optional notes
            if (fields.notes) {
              await prisma.delegationAdminNote.create({
                data: {
                  registrationId: delegationRecord.id,
                  note: fields.notes
                }
              });
            }
          }

          delegationCache[delegationName.toLowerCase()] = delegationRecord;
        }

        // Create Delegation Delegate
        const rosterCount = delegationRecord.delegates?.length || 0;
        const delegateIndex = rosterCount + 1;
        const publicId = `${delegationRecord.publicId}-d${delegateIndex}`;
        const trackingToken = await ensureUniqueTrackingToken();

        const newDelegate = await prisma.delegationDelegate.create({
          data: {
            publicId,
            trackingToken,
            delegationId: delegationRecord.id,
            name,
            email: email || null,
            phone: phone || null,
            originalDelegationName: delegationName,
            committee1: fields.committee1 || null,
            portfolio1: fields.portfolio1 || null,
            allotmentStatus: fields.committee1 ? "Allotted" : "Not allotted",
            allottedCommittee: fields.committee1 || null,
            allottedPortfolio: fields.portfolio1 || null,
            checkedIn: fields.checkedIn?.toLowerCase() === "true" || fields.checkedIn?.toLowerCase() === "checked in",
            certificateReleased: fields.certificateReleased?.toLowerCase() === "true" || fields.certificateReleased?.toLowerCase() === "released"
          }
        });

        // Add delegate to cache list
        if (!delegationRecord.delegates) delegationRecord.delegates = [];
        delegationRecord.delegates.push(newDelegate);

        importedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      totalRows: dataRows.length,
      importedCount,
      skippedCount,
      failedCount,
      errors,
      duplicates
    });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Admin access required." }, { status: 401 });
    }
    console.error("CSV Import Error:", error);
    return NextResponse.json({ error: "Could not import CSV data." }, { status: 500 });
  }
}
