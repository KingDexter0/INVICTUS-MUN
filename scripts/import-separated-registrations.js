const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper to normalize strings and treat dashes/NA as null/empty
function cleanStr(val) {
  if (val === undefined || val === null) return null;
  const str = String(val).trim();
  if (!str || str === '-' || str.toLowerCase() === 'na' || str.toLowerCase() === 'n/a' || str.toLowerCase() === 'none') {
    return null;
  }
  return str;
}

// Helper to parse numeric values safely
function parseNum(val) {
  if (val === undefined || val === null) return null;
  const num = parseInt(String(val).replace(/[^\d-]/g, ''), 10);
  return isNaN(num) ? null : num;
}

// Unique Public ID generator using the in-memory cache we optimized
let maxPublicIdNum = null;
async function generateUniquePublicId() {
  if (maxPublicIdNum === null) {
    const inds = await prisma.individualRegistration.findMany({ select: { publicId: true } });
    const dels = await prisma.delegationRegistration.findMany({ select: { publicId: true } });
    const ids = [...inds.map(i => i.publicId), ...dels.map(d => d.publicId)];
    
    maxPublicIdNum = 0;
    for (const id of ids) {
      const match = id.match(/INV-2026-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxPublicIdNum) maxPublicIdNum = num;
      }
    }
  }
  
  maxPublicIdNum++;
  return `INV-2026-${String(maxPublicIdNum).padStart(3, "0")}`;
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isApply = args.includes('--apply');
  const isReplace = args.includes('--replace');

  if (!isDryRun && !isApply) {
    console.log("Usage:");
    console.log("  Dry Run:       node scripts/import-separated-registrations.js --dry-run");
    console.log("  Apply Import:  node scripts/import-separated-registrations.js --apply");
    console.log("  Replace Mode:  node scripts/import-separated-registrations.js --apply --replace");
    process.exit(1);
  }

  const filename = 'Invictus_Separated_Registrations.xlsx';
  console.log(`Reading Excel file: ${filename}...`);
  let workbook;
  try {
    workbook = XLSX.readFile(filename);
  } catch (err) {
    console.error(`Could not find '${filename}' in the workspace directory. Make sure it was copied correctly.`);
    process.exit(1);
  }

  // Load sheets
  const individualSheet = workbook.Sheets['Individual Registrations'];
  const delegationSheet = workbook.Sheets['Delegation Registrations'];
  const delegatesSheet = workbook.Sheets['Delegation Delegates'];
  const skippedSheet = workbook.Sheets['Skipped Rows'];

  if (!individualSheet || !delegationSheet || !delegatesSheet) {
    console.error("Missing required sheets. The Excel file must contain 'Individual Registrations', 'Delegation Registrations', and 'Delegation Delegates' sheets.");
    process.exit(1);
  }

  const individualRows = XLSX.utils.sheet_to_json(individualSheet);
  const delegationRows = XLSX.utils.sheet_to_json(delegationSheet);
  const delegatesRows = XLSX.utils.sheet_to_json(delegatesSheet);
  const skippedRows = skippedSheet ? XLSX.utils.sheet_to_json(skippedSheet) : [];

  console.log("\n================ EXCEL SHEET COUNTS ================");
  console.log(`Individual Registrations Sheet Rows: ${individualRows.length}`);
  console.log(`Delegation Registrations Sheet Rows: ${delegationRows.length}`);
  console.log(`Delegation Delegates Sheet Rows: ${delegatesRows.length}`);
  console.log(`Skipped Rows Sheet Rows: ${skippedRows.length}`);
  console.log(`Total Valid People (Individuals + Delegates): ${individualRows.length + delegatesRows.length}`);
  console.log("====================================================");

  if (isDryRun) {
    console.log("\n--- Validation and First 3 Rows ---");

    console.log("\n[Individual Registrations Preview]:");
    if (individualRows.length > 0) {
      console.log("Headers available:", Object.keys(individualRows[0]).join(', '));
      console.log(individualRows.slice(0, 3));
    }

    console.log("\n[Delegation Registrations Preview]:");
    if (delegationRows.length > 0) {
      console.log("Headers available:", Object.keys(delegationRows[0]).join(', '));
      console.log(delegationRows.slice(0, 3));
    }

    console.log("\n[Delegation Delegates Preview]:");
    if (delegatesRows.length > 0) {
      console.log("Headers available:", Object.keys(delegatesRows[0]).join(', '));
      console.log(delegatesRows.slice(0, 3));
    }

    console.log("\nDry-run mode finished. No writes were made to the database.");
    await prisma.$disconnect();
    return;
  }

  if (isApply) {
    if (isReplace) {
      console.log("\n[REPLACE MODE ACTIVE]");
      console.log("Backing up existing counts first...");
      const currentInds = await prisma.individualRegistration.count();
      const currentDels = await prisma.delegationRegistration.count();
      const currentDelegates = await prisma.delegationDelegate.count();
      console.log(`Current DB State - Individuals: ${currentInds}, Delegations: ${currentDels}, Delegates: ${currentDelegates}`);
      
      console.log("Clearing all registration tables in a transaction...");
      await prisma.$transaction([
        prisma.delegationDelegate.deleteMany(),
        prisma.delegationRegistration.deleteMany(),
        prisma.individualRegistration.deleteMany()
      ]);
      console.log("Tables cleared successfully.");
    }

    console.log("\nStarting import to database...");

    // 1. Process Delegation Registrations
    console.log(`Importing ${delegationRows.length} Delegation groups...`);
    let delGroupsCreated = 0;
    const delegationMapByName = new Map(); // name -> DB DelegationRegistration record

    for (const row of delegationRows) {
      // Normalize row headers
      const normRow = {};
      for (const k of Object.keys(row)) {
        normRow[k.trim().toLowerCase()] = row[k];
      }

      const delegationName = cleanStr(normRow['delegation name'] || normRow['name']);
      if (!delegationName) continue;

      const totalDelegates = parseNum(normRow['total delegates']) || 10;
      const checkedInCount = parseNum(normRow['checked in count'] || normRow['checkedincount']) || 0;
      const paymentStatus = cleanStr(normRow['payment status'] || normRow['paymentstatus']) || 'Pending';
      const institutionName = cleanStr(normRow['institution name'] || normRow['institution'] || normRow['school']);
      const headName = cleanStr(normRow['head delegate name'] || normRow['coordinating teacher name'] || normRow['coteachername'] || 'Imported Head Delegate');
      const headEmail = cleanStr(normRow['head delegate email'] || normRow['coordinating teacher email'] || normRow['coteacheremail']) || `teacher-${delegationName.toLowerCase().replace(/\s+/g, '-')}@example.com`;
      const headPhone = cleanStr(normRow['head delegate phone'] || normRow['coordinating teacher phone'] || normRow['coteacherphone']) || 'N/A';

      // Trim & Match case-insensitively
      const trimmedName = delegationName.trim();

      let delegation = await prisma.delegationRegistration.findUnique({
        where: { delegationName: trimmedName }
      });

      if (!delegation) {
        const publicId = await generateUniquePublicId();
        delegation = await prisma.delegationRegistration.create({
          data: {
            publicId: `DEL-${publicId}`,
            delegationName: trimmedName,
            institution: institutionName,
            coTeacherName: headName,
            coTeacherEmail: headEmail,
            coTeacherPhone: headPhone,
            totalDelegates,
            checkedInCount,
            paymentStatus,
            registrationStatus: 'Approved'
          }
        });
        delGroupsCreated++;
      } else {
        // Update existing group metadata
        delegation = await prisma.delegationRegistration.update({
          where: { id: delegation.id },
          data: {
            institution: institutionName || delegation.institution,
            coTeacherName: headName || delegation.coTeacherName,
            coTeacherPhone: headPhone || delegation.coTeacherPhone,
            paymentStatus: paymentStatus || delegation.paymentStatus
          }
        });
      }

      delegationMapByName.set(trimmedName.toLowerCase(), delegation);
    }

    // 2. Process Delegation Delegates
    console.log(`Importing ${delegatesRows.length} Delegation delegates...`);
    let delegatesCreated = 0;
    for (const row of delegatesRows) {
      const normRow = {};
      for (const k of Object.keys(row)) {
        normRow[k.trim().toLowerCase()] = row[k];
      }

      const rawDelName = cleanStr(normRow['delegation name']);
      if (!rawDelName) {
        console.warn(`Skipping delegate row due to missing delegation name:`, row);
        continue;
      }
      const delegationNameLower = rawDelName.trim().toLowerCase();

      // Find or create parent delegation
      let parentDelegation = delegationMapByName.get(delegationNameLower);
      if (!parentDelegation) {
        console.warn(`Delegation name '${rawDelName}' not found in Delegation Registrations. Creating group automatically.`);
        const cleanName = rawDelName.trim();
        const publicId = await generateUniquePublicId();
        parentDelegation = await prisma.delegationRegistration.create({
          data: {
            publicId: `DEL-${publicId}`,
            delegationName: cleanName,
            coTeacherName: "Imported Coordinating Teacher",
            coTeacherEmail: `teacher-${delegationNameLower.replace(/\s+/g, '-')}@example.com`,
            coTeacherPhone: "N/A",
            totalDelegates: 1
          }
        });
        delegationMapByName.set(delegationNameLower, parentDelegation);
        delGroupsCreated++;
      }

      const name = cleanStr(normRow['name'] || normRow['full name'] || normRow['delegate name']);
      if (!name) continue;

      const email = cleanStr(normRow['email'] || normRow['e-mail']);
      const phone = cleanStr(normRow['phone'] || normRow['number'] || normRow['phone number']);
      const allotment = cleanStr(normRow['allotment'] || normRow['allotted committee']);
      const awards = parseNum(normRow['awards']);
      const points = parseNum(normRow['points(if any)'] || normRow['points']);
      const originalDelegationName = cleanStr(normRow['originaldelegationname'] || normRow['original delegation name']) || rawDelName;

      // Duplicate check: delegationRegistrationId + email if email exists
      // If no email, delegationRegistrationId + fullName + phone + allotment
      let existingDelegate = null;
      if (email) {
        existingDelegate = await prisma.delegationDelegate.findFirst({
          where: {
            delegationId: parentDelegation.id,
            email: email
          }
        });
      } else {
        existingDelegate = await prisma.delegationDelegate.findFirst({
          where: {
            delegationId: parentDelegation.id,
            name: name,
            phone: phone || null,
            allottedCommittee: allotment || null
          }
        });
      }

      if (!existingDelegate) {
        const countD = await prisma.delegationDelegate.count();
        await prisma.delegationDelegate.create({
          data: {
            publicId: `${parentDelegation.publicId}-d${countD + 1}`,
            delegationId: parentDelegation.id,
            name: name,
            email: email,
            phone: phone || "N/A",
            originalDelegationName: originalDelegationName,
            allottedCommittee: allotment || null,
            allotmentStatus: allotment ? 'Allotted' : 'Not allotted',
            checkedIn: false
          }
        });
        delegatesCreated++;
      } else {
        // Update details if rerun
        await prisma.delegationDelegate.update({
          where: { id: existingDelegate.id },
          data: {
            phone: phone || existingDelegate.phone,
            allottedCommittee: allotment || existingDelegate.allottedCommittee,
            allotmentStatus: allotment ? 'Allotted' : existingDelegate.allotmentStatus,
            originalDelegationName: originalDelegationName || existingDelegate.originalDelegationName
          }
        });
      }
    }

    // 3. Process Individual Registrations
    console.log(`Importing ${individualRows.length} Individual registrations...`);
    let individualsCreated = 0;
    for (const row of individualRows) {
      const normRow = {};
      for (const k of Object.keys(row)) {
        normRow[k.trim().toLowerCase()] = row[k];
      }

      const name = cleanStr(normRow['name'] || normRow['full name'] || normRow['delegate name']);
      if (!name) continue;

      const email = cleanStr(normRow['email'] || normRow['e-mail']);
      const phone = cleanStr(normRow['phone'] || normRow['number'] || normRow['phone number']);
      const allotment = cleanStr(normRow['allotment'] || normRow['allotted committee']);
      const awards = parseNum(normRow['awards']);
      const points = parseNum(normRow['points(if any)'] || normRow['points']);
      const originalDelegationName = cleanStr(normRow['originaldelegationname'] || normRow['original delegation name']);

      // Duplicate check: email if exists
      // If email exists, check if there's a record with this name and this email (or subaddressed email)
      // If no email, match by name + phone + allotment
      let existingInd = null;
      if (email) {
        const [local, domain] = email.split('@');
        const subaddressedEmail = `${local}+${name.toLowerCase().replace(/\s+/g, '-')}@${domain}`;
        existingInd = await prisma.individualRegistration.findFirst({
          where: {
            name: name,
            email: { in: [email, subaddressedEmail] }
          }
        });
      } else {
        existingInd = await prisma.individualRegistration.findFirst({
          where: {
            name: name,
            phone: phone || "N/A",
            allottedCommittee: allotment || null
          }
        });
      }

      if (!existingInd) {
        const publicId = await generateUniquePublicId();
        // Duplicate email subaddressing check (to handle myriene chopra case)
        let finalEmail = email || `${publicId}@example.com`;
        const emailExists = await prisma.individualRegistration.findUnique({
          where: { email: finalEmail }
        });
        if (emailExists && email) {
          const [local, domain] = email.split('@');
          finalEmail = `${local}+${name.toLowerCase().replace(/\s+/g, '-')}@${domain}`;
          console.log(`Email conflict for individual ${name}. Using subaddressing: ${finalEmail}`);
        }

        await prisma.individualRegistration.create({
          data: {
            publicId,
            name: name,
            email: finalEmail,
            phone: phone || "N/A",
            committee1: allotment || 'UNGA-ESS',
            allotmentStatus: allotment ? 'Allotted' : 'Not allotted',
            allottedCommittee: allotment || null,
            originalDelegationName: originalDelegationName || 'None',
            awards: awards || 0,
            amount: 2100,
            paymentStatus: 'Verified',
            registrationStatus: 'Approved'
          }
        });
        individualsCreated++;
      } else {
        // Update details if rerun
        await prisma.individualRegistration.update({
          where: { id: existingInd.id },
          data: {
            phone: phone || existingInd.phone,
            allottedCommittee: allotment || existingInd.allottedCommittee,
            allotmentStatus: allotment ? 'Allotted' : existingInd.allotmentStatus,
            originalDelegationName: originalDelegationName || existingInd.originalDelegationName
          }
        });
      }
    }

    // 4. Recalculate delegation aggregates
    console.log("Recalculating delegation stats...");
    const delegations = await prisma.delegationRegistration.findMany({
      include: { delegates: true }
    });
    for (const del of delegations) {
      await prisma.delegationRegistration.update({
        where: { id: del.id },
        data: {
          totalDelegates: del.delegates.length,
          checkedInCount: del.delegates.filter(d => d.checkedIn).length
        }
      });
    }

    // 5. Final Reconciliation Verification
    const finalIndCount = await prisma.individualRegistration.count();
    const finalDelCount = await prisma.delegationRegistration.count();
    const finalDelegateCount = await prisma.delegationDelegate.count();
    const totalDbPersons = finalIndCount + finalDelegateCount;

    const isReconciled = (finalIndCount === 183 && finalDelegateCount === 166);
    const reconciliationStatus = isReconciled ? "Reconciled" : "Mismatch found";

    console.log("\n================ IMPORT & RECONCILIATION SUMMARY ================");
    console.log(`Individuals Imported: ${individualsCreated}`);
    console.log(`Delegations Imported: ${delGroupsCreated}`);
    console.log(`Delegation Delegates Imported: ${delegatesCreated}`);
    console.log(`Skipped Rows Ignored: ${skippedRows.length}`);
    console.log(`\nFinal IndividualRegistration DB Count: ${finalIndCount} (Expected: 183)`);
    console.log(`Final DelegationRegistration DB Count: ${finalDelCount} (Expected: 20)`);
    console.log(`Final DelegationDelegate DB Count: ${finalDelegateCount} (Expected: 166)`);
    console.log(`Total Database Person Records (Individuals + Delegates): ${totalDbPersons} (Expected: 349)`);
    console.log(`Reconciliation Status: ${reconciliationStatus}`);
    console.log("=================================================================\n");

    // Save report json to public
    const reportData = {
      sourceFile: 'Invictus_Separated_Registrations.xlsx',
      individuals: finalIndCount,
      delegationGroups: finalDelCount,
      delegationDelegates: finalDelegateCount,
      skippedRows: skippedRows.length,
      totalValidPeople: totalDbPersons,
      databaseReconciled: isReconciled,
      importedAt: new Date().toISOString()
    };

    const publicDir = path.join(__dirname, '..', 'public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    fs.writeFileSync(path.join(publicDir, 'import-report.json'), JSON.stringify(reportData, null, 2));
    console.log("Saved report summary to public/import-report.json.");
  }

  await prisma.$disconnect();
}

main().catch(console.error);
