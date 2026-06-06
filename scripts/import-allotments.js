const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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

// Helper to normalize strings
function normalizeStr(val) {
  if (val === undefined || val === null) return '';
  return String(val).trim();
}

// Helper to check if delegation name is blank/invalid
function isBlankDelegation(name) {
  const normalized = normalizeStr(name).toLowerCase();
  return (
    !normalized ||
    normalized === '-' ||
    normalized === 'na' ||
    normalized === 'n/a' ||
    normalized === 'none'
  );
}

// Helper to find matching row in parsed excel
function findMatch(dbRecord, parsedRows) {
  // 1. Try exact match on email (if both have email)
  if (dbRecord.email && dbRecord.email !== 'N/A' && dbRecord.email.includes('@')) {
    const cleanDbEmail = dbRecord.email.split('+')[0].toLowerCase();
    const emailMatch = parsedRows.find(xl => {
      if (!xl.email) return false;
      const cleanXlEmail = xl.email.split('+')[0].toLowerCase();
      return cleanXlEmail === cleanDbEmail;
    });
    if (emailMatch) return emailMatch;
  }
  
  // 2. Try exact match on phone (if both have phone)
  if (dbRecord.phone && dbRecord.phone !== 'N/A') {
    const cleanDbPhone = dbRecord.phone.replace(/\D/g, '');
    if (cleanDbPhone) {
      const phoneMatch = parsedRows.find(xl => {
        const cleanXlPhone = xl.phone.replace(/\D/g, '');
        return cleanXlPhone && cleanXlPhone === cleanDbPhone;
      });
      if (phoneMatch) return phoneMatch;
    }
  }

  // 3. Try match by Name (case-insensitive)
  const nameMatches = parsedRows.filter(xl => xl.name.toLowerCase() === dbRecord.name.toLowerCase());
  if (nameMatches.length === 1) {
    return nameMatches[0];
  } else if (nameMatches.length > 1) {
    // Disambiguate with allotment/committee
    const dbCommittee = (dbRecord.allottedCommittee || dbRecord.committee1 || '').toLowerCase();
    const correctMatch = nameMatches.find(xl => {
      const xlAllotment = xl.allotment.toLowerCase();
      return xlAllotment.includes(dbCommittee) || dbCommittee.includes(xlAllotment);
    });
    if (correctMatch) return correctMatch;
  }

  return null;
}

// Helper to match an Excel row to a DB record
function findDbMatch(xlRow, dbIndividuals, dbDelegates) {
  // Try to match by email
  if (xlRow.email && xlRow.email !== 'N/A' && xlRow.email.includes('@')) {
    const cleanXlEmail = xlRow.email.split('+')[0].toLowerCase();
    // Check individuals
    const indMatch = dbIndividuals.find(db => {
      const cleanDbEmail = db.email.split('+')[0].toLowerCase();
      return cleanDbEmail === cleanXlEmail && db.name.toLowerCase() === xlRow.name.toLowerCase();
    });
    if (indMatch) return { type: 'individual', record: indMatch };
    
    // Check delegates
    const delMatch = dbDelegates.find(db => {
      if (!db.email) return false;
      const cleanDbEmail = db.email.split('+')[0].toLowerCase();
      return cleanDbEmail === cleanXlEmail && db.name.toLowerCase() === xlRow.name.toLowerCase();
    });
    if (delMatch) return { type: 'delegate', record: delMatch };
  }
  
  // Try to match by phone
  if (xlRow.phone && xlRow.phone !== 'N/A') {
    const cleanXlPhone = xlRow.phone.replace(/\D/g, '');
    if (cleanXlPhone) {
      const indMatch = dbIndividuals.find(db => db.phone.replace(/\D/g, '') === cleanXlPhone && db.name.toLowerCase() === xlRow.name.toLowerCase());
      if (indMatch) return { type: 'individual', record: indMatch };
      
      const delMatch = dbDelegates.find(db => db.phone && db.phone.replace(/\D/g, '') === cleanXlPhone && db.name.toLowerCase() === xlRow.name.toLowerCase());
      if (delMatch) return { type: 'delegate', record: delMatch };
    }
  }

  // Try to match by name
  const indMatch = dbIndividuals.find(db => db.name.toLowerCase() === xlRow.name.toLowerCase());
  if (indMatch) return { type: 'individual', record: indMatch };

  const delMatch = dbDelegates.find(db => db.name.toLowerCase() === xlRow.name.toLowerCase());
  if (delMatch) return { type: 'delegate', record: delMatch };

  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isApply = args.includes('--apply');
  const isFixExisting = args.includes('--fix-existing');
  const isReconcile = args.includes('--reconcile');

  if (!isDryRun && !isApply && !isReconcile) {
    console.log("Usage:");
    console.log("  Dry Run:       node scripts/import-allotments.js --dry-run");
    console.log("  Apply Import:  node scripts/import-allotments.js --apply");
    console.log("  Fix Existing:  node scripts/import-allotments.js --apply --fix-existing");
    console.log("  Reconcile:     node scripts/import-allotments.js --reconcile");
    process.exit(1);
  }

  console.log("Reading Excel file...");
  let workbook;
  try {
    workbook = XLSX.readFile('All Allotments.xlsx');
  } catch (err) {
    console.error("Could not find 'All Allotments.xlsx' in the current directory.");
    process.exit(1);
  }

  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet);

  let totalRows = rows.length;
  let validRowsCount = 0;
  let skippedNoName = 0;
  let missingEmail = 0;
  let missingPhone = 0;
  let missingAllotment = 0;

  const parsedRows = [];
  const delegationGroupsMap = new Map(); // lowercaseKey -> { originalName: string, items: [] }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    
    // Normalize headers (trim, lowercase)
    const normalizedRow = {};
    for (const key of Object.keys(row)) {
      const normalizedKey = key.trim().toLowerCase();
      normalizedRow[normalizedKey] = row[key];
    }

    const name = normalizeStr(normalizedRow['name'] || normalizedRow['full name']);
    const email = normalizeStr(normalizedRow['email'] || normalizedRow['e-mail']);
    const phone = normalizeStr(normalizedRow['phone'] || normalizedRow['number'] || normalizedRow['phone number']);
    const allotment = normalizeStr(normalizedRow['allotment'] || normalizedRow['allotted committee']);
    const delegationNameVal = normalizedRow['delegation name (if any)'] || normalizedRow['delegation name'] || '';
    const awards = normalizeStr(normalizedRow['awards']);
    const points = normalizeStr(normalizedRow['points(if any)'] || normalizedRow['points']);

    if (!name) {
      skippedNoName++;
      continue;
    }

    validRowsCount++;

    if (!email) missingEmail++;
    if (!phone) missingPhone++;
    if (!allotment) missingAllotment++;

    const item = {
      rowNum: i + 2,
      name,
      email,
      phone,
      allotment,
      delegationName: normalizeStr(delegationNameVal),
      awards,
      points
    };

    parsedRows.push(item);

    if (!isBlankDelegation(item.delegationName)) {
      const cleanDelName = item.delegationName.trim();
      const lowercaseKey = cleanDelName.toLowerCase();
      if (!delegationGroupsMap.has(lowercaseKey)) {
        delegationGroupsMap.set(lowercaseKey, {
          originalName: cleanDelName,
          items: []
        });
      }
      delegationGroupsMap.get(lowercaseKey).items.push(item);
    }
  }

  const individualRows = parsedRows.filter(r => isBlankDelegation(r.delegationName));
  const delegationDelegateRows = parsedRows.filter(r => !isBlankDelegation(r.delegationName));

  if (isReconcile) {
    console.log("Running reconciliation audit...");
    const dbIndividuals = await prisma.individualRegistration.findMany();
    const dbDelegates = await prisma.delegationDelegate.findMany();
    const dbDelegations = await prisma.delegationRegistration.findMany();

    const missingRows = [];
    const duplicateRows = [];
    const skippedDuplicateProtection = [];
    const blankContactValidName = [];

    for (const xl of parsedRows) {
      if (!xl.email && !xl.phone) {
        blankContactValidName.push(xl);
      }

      const match = findDbMatch(xl, dbIndividuals, dbDelegates);
      if (!match) {
        const emailDupInd = dbIndividuals.find(db => xl.email && db.email.toLowerCase() === xl.email.toLowerCase());
        const emailDupDel = dbDelegates.find(db => xl.email && db.email && db.email.toLowerCase() === xl.email.toLowerCase());
        const dupRecord = emailDupInd || emailDupDel;
        
        missingRows.push({
          excelRow: xl.rowNum,
          name: xl.name,
          email: xl.email,
          phone: xl.phone,
          allotment: xl.allotment,
          delegationName: xl.delegationName,
          reason: dupRecord ? `Skipped due to duplicate email with existing DB record: ${dupRecord.name}` : 'Not present in database',
          matchedDbRecord: dupRecord ? { name: dupRecord.name, email: dupRecord.email } : null
        });

        if (dupRecord) {
          skippedDuplicateProtection.push(xl);
        }
      }
    }

    // Check duplicate rows in Excel itself
    const excelKeys = new Map();
    for (const xl of parsedRows) {
      const key = `${xl.name.toLowerCase()}|${xl.email.toLowerCase()}`;
      excelKeys.set(key, (excelKeys.get(key) || 0) + 1);
    }
    for (const xl of parsedRows) {
      const key = `${xl.name.toLowerCase()}|${xl.email.toLowerCase()}`;
      if (excelKeys.get(key) > 1) {
        duplicateRows.push(xl);
      }
    }

    const isReconciled = (dbIndividuals.length === 183 && dbDelegates.length === 166 && missingRows.length === 0);
    const statusStr = isReconciled ? "Reconciled" : "Mismatch found";

    console.log("\n================ RECONCILIATION AUDIT REPORT ================");
    console.log(`Excel Valid Rows Count: ${parsedRows.length}`);
    console.log(`Database IndividualRegistration Count: ${dbIndividuals.length}`);
    console.log(`Database DelegationDelegate Count: ${dbDelegates.length}`);
    console.log(`Database Total Persons: ${dbIndividuals.length + dbDelegates.length}`);
    console.log(`Reconciliation Status: ${statusStr}`);
    console.log(`Missing Rows: ${missingRows.length}`);
    console.log(`Duplicate Rows in Excel: ${duplicateRows.length}`);
    console.log(`Rows Skipped by Duplicate Protection: ${skippedDuplicateProtection.length}`);
    console.log(`Rows with Blank Email/Phone: ${blankContactValidName.length}`);

    if (missingRows.length > 0) {
      console.log("\n--- Missing Row Details ---");
      for (const r of missingRows) {
        console.log(`Excel Row ${r.excelRow}: ${r.name}`);
        console.log(`  Email: ${r.email}`);
        console.log(`  Phone: ${r.phone}`);
        console.log(`  Allotment: ${r.allotment}`);
        console.log(`  Delegation: ${r.delegationName}`);
        console.log(`  Reason: ${r.reason}`);
      }
    }
    console.log("=============================================================\n");

    const reportData = {
      totalRows,
      validRows: parsedRows.length,
      individualRows: individualRows.length,
      delegationDelegateRows: delegationDelegateRows.length,
      uniqueDelegationGroups: dbDelegations.length,
      skippedNoName,
      missingEmail: parsedRows.filter(r => !r.email).length,
      missingPhone: parsedRows.filter(r => !r.phone).length,
      missingAllotment: parsedRows.filter(r => !r.allotment).length,
      databaseIndividuals: dbIndividuals.length,
      databaseDelegationDelegates: dbDelegates.length,
      databaseTotalPersons: dbIndividuals.length + dbDelegates.length,
      excelValidRows: parsedRows.length,
      reconciliationStatus: statusStr,
      missingRows,
      duplicateRows,
      delegationGroups: dbDelegations.map(d => ({ name: d.delegationName, count: d.totalDelegates }))
    };

    const publicDir = path.join(__dirname, '..', 'public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    fs.writeFileSync(path.join(publicDir, 'import-report.json'), JSON.stringify(reportData, null, 2));

    await prisma.$disconnect();
    return;
  }

  console.log("\n================ DATASET VALIDATION REPORT ================");
  console.log(`Total rows parsed: ${totalRows}`);
  console.log(`Valid rows: ${validRowsCount}`);
  console.log(`Individual registrations: ${individualRows.length}`);
  console.log(`Delegation delegate rows: ${delegationDelegateRows.length}`);
  console.log(`Unique delegation groups: ${delegationGroupsMap.size}`);
  console.log("\nDelegation groups:");
  const groupsReportList = [];
  for (const [key, val] of delegationGroupsMap.entries()) {
    console.log(`* ${val.originalName}: ${val.items.length} delegates`);
    groupsReportList.push({ name: val.originalName, count: val.items.length });
  }
  console.log("\nWarnings / Skips:");
  console.log(`- Rows skipped because of missing name: ${skippedNoName}`);
  console.log(`- Rows with missing email: ${missingEmail}`);
  console.log(`- Rows with missing phone: ${missingPhone}`);
  console.log(`- Rows with missing allotment: ${missingAllotment}`);
  console.log("===========================================================\n");

  if (isDryRun) {
    console.log("Dry run finished. No database modifications were made.");
    await prisma.$disconnect();
    return;
  }

  if (isApply) {
    if (isFixExisting) {
      console.log("Starting correction of existing records in database...");
      
      let movedCount = 0;
      let remainedCount = 0;
      let groupsCreated = 0;
      let needsManualReview = 0;

      // 1. Load all existing IndividualRegistrations
      const existingIndividuals = await prisma.individualRegistration.findMany();
      console.log(`Found ${existingIndividuals.length} individual registrations in DB to analyze.`);

      for (const dbRecord of existingIndividuals) {
        // Find matching row in parsed excel
        const match = findMatch(dbRecord, parsedRows);

        if (!match) {
          console.log(`Needs manual review: ${dbRecord.name} (ID: ${dbRecord.publicId}) could not be matched in Excel file.`);
          needsManualReview++;
          remainedCount++;
          continue;
        }

        if (isBlankDelegation(match.delegationName)) {
          // If delegation name is empty in Excel, it remains an IndividualRegistration
          remainedCount++;
          // Save the blank original delegation name field for audit/debugging
          await prisma.individualRegistration.update({
            where: { id: dbRecord.id },
            data: { originalDelegationName: match.delegationName || 'None' }
          });
          continue;
        }

        // We must move this to DelegationDelegate!
        const cleanDelName = match.delegationName.trim();
        const lowercaseKey = cleanDelName.toLowerCase();

        await prisma.$transaction(async (tx) => {
          // Find or create parent delegation group with unique delegationName
          let delegation = await tx.delegationRegistration.findUnique({
            where: { delegationName: cleanDelName }
          });

          if (!delegation) {
            // Generate guaranteed unique public ID
            const publicId = await generateUniquePublicId();

            delegation = await tx.delegationRegistration.create({
              data: {
                publicId: `DEL-${publicId}`,
                delegationName: cleanDelName,
                coTeacherName: "Imported Coordinating Teacher",
                coTeacherEmail: `teacher-${lowercaseKey}@example.com`,
                coTeacherPhone: "N/A",
                paymentStatus: dbRecord.paymentStatus,
                registrationStatus: dbRecord.registrationStatus,
                totalDelegates: 1
              }
            });
            groupsCreated++;
          }

          // Duplicate delegate check: name + email within same delegation
          let duplicateDelegate = null;
          if (dbRecord.email) {
            duplicateDelegate = await tx.delegationDelegate.findFirst({
              where: {
                delegationId: delegation.id,
                name: dbRecord.name,
                email: dbRecord.email
              }
            });
          } else {
            duplicateDelegate = await tx.delegationDelegate.findFirst({
              where: {
                delegationId: delegation.id,
                name: dbRecord.name,
                phone: dbRecord.phone
              }
            });
          }

          if (duplicateDelegate) {
            console.log(`Duplicate delegate detected: ${dbRecord.name} already exists under delegation ${cleanDelName}. Skipping insertion.`);
          } else {
            // Create delegate
            await tx.delegationDelegate.create({
              data: {
                publicId: dbRecord.publicId,
                delegationId: delegation.id,
                name: dbRecord.name,
                email: dbRecord.email,
                phone: dbRecord.phone,
                originalDelegationName: cleanDelName,
                committee1: dbRecord.committee1,
                portfolio1: dbRecord.portfolio1,
                allotmentStatus: dbRecord.allotmentStatus,
                allottedCommittee: dbRecord.allottedCommittee,
                allottedPortfolio: dbRecord.allottedPortfolio,
                checkedIn: dbRecord.checkedIn,
                checkedInAt: dbRecord.checkedInAt,
                checkedInBy: dbRecord.checkedInBy,
                certificateReleased: dbRecord.certificateReleased,
                certificateReleasedAt: dbRecord.certificateReleasedAt,
                certificateUrl: dbRecord.certificateUrl,
                createdAt: dbRecord.createdAt
              }
            });
          }

          // Delete from IndividualRegistration safely
          await tx.individualRegistration.delete({
            where: { id: dbRecord.id }
          });
        });

        movedCount++;
      }

      // 2. Identify missing rows from Excel that aren't in database yet
      console.log("Checking for missing records from Excel to restore/insert...");
      const updatedIndividuals = await prisma.individualRegistration.findMany();
      const updatedDelegates = await prisma.delegationDelegate.findMany();

      let restoredCount = 0;
      for (const xl of parsedRows) {
        const match = findDbMatch(xl, updatedIndividuals, updatedDelegates);
        if (!match) {
          // Record is missing! Insert it now.
          if (isBlankDelegation(xl.delegationName)) {
            // Insert missing IndividualRegistration
            const publicId = await generateUniquePublicId();

            // Duplicate email protection: if email already exists, use plus-addressing
            let finalEmail = xl.email || `${publicId}@example.com`;
            const emailExists = await prisma.individualRegistration.findUnique({
              where: { email: finalEmail }
            });
            if (emailExists && xl.email) {
              const [local, domain] = xl.email.split('@');
              finalEmail = `${local}+${xl.name.toLowerCase().replace(/\s+/g, '-')}@${domain}`;
              console.log(`Email conflict for ${xl.name}. Using subaddressing: ${finalEmail}`);
            }

            await prisma.individualRegistration.create({
              data: {
                publicId,
                name: xl.name,
                email: finalEmail,
                phone: xl.phone || "N/A",
                committee1: xl.allotment || 'UNGA-ESS',
                allotmentStatus: xl.allotment ? 'Allotted' : 'Not allotted',
                allottedCommittee: xl.allotment || null,
                originalDelegationName: xl.delegationName || 'None'
              }
            });
            restoredCount++;
          } else {
            // Insert missing DelegationDelegate
            const cleanDelName = xl.delegationName.trim();
            const lowercaseKey = cleanDelName.toLowerCase();
            
            // Find or create parent delegation
            let delegation = await prisma.delegationRegistration.findUnique({
              where: { delegationName: cleanDelName }
            });
            if (!delegation) {
              const publicId = await generateUniquePublicId();
              delegation = await prisma.delegationRegistration.create({
                data: {
                  publicId: `DEL-${publicId}`,
                  delegationName: cleanDelName,
                  coTeacherName: "Imported Coordinating Teacher",
                  coTeacherEmail: `teacher-${lowercaseKey}@example.com`,
                  coTeacherPhone: "N/A",
                  totalDelegates: 1
                }
              });
              groupsCreated++;
            }

            const countD = await prisma.delegationDelegate.count();
            await prisma.delegationDelegate.create({
              data: {
                publicId: `${delegation.publicId}-d${countD + 1}`,
                delegationId: delegation.id,
                name: xl.name,
                email: xl.email || null,
                phone: xl.phone || null,
                allottedCommittee: xl.allotment || null,
                allotmentStatus: xl.allotment ? 'Allotted' : 'Not allotted',
                originalDelegationName: cleanDelName
              }
            });
            restoredCount++;
          }
        }
      }

      console.log("\n================ CORRECTION MIGRATION REPORT ================");
      console.log(`Records successfully moved to DelegationDelegate: ${movedCount}`);
      console.log(`Records remaining in IndividualRegistration: ${remainedCount}`);
      console.log(`New DelegationRegistration groups created: ${groupsCreated}`);
      console.log(`Missing records restored/inserted: ${restoredCount}`);
      console.log(`Records needing manual review: ${needsManualReview}`);
      console.log("=============================================================\n");

      // Recalculate delegation aggregates
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
      console.log("Stats recalculated.");

    } else {
      console.log("Applying full import to database from Excel...");
      let indCount = 0;
      let delGroupCount = 0;
      let delDelegateCount = 0;

      // Import Individual Registrations
      for (const item of individualRows) {
        try {
          const publicId = await generateUniquePublicId();

          let finalEmail = item.email || `${publicId}@example.com`;
          const emailExists = await prisma.individualRegistration.findUnique({
            where: { email: finalEmail }
          });
          if (emailExists) {
            const [local, domain] = finalEmail.split('@');
            finalEmail = `${local}+${item.name.toLowerCase().replace(/\s+/g, '-')}@${domain}`;
          }

          await prisma.individualRegistration.upsert({
            where: { email: finalEmail },
            update: {
              name: item.name,
              phone: item.phone || "N/A",
              committee1: item.allotment || 'UNGA-ESS',
              allotmentStatus: item.allotment ? 'Allotted' : 'Not allotted',
              allottedCommittee: item.allotment || null,
              originalDelegationName: item.delegationName || 'None'
            },
            create: {
              publicId,
              name: item.name,
              email: finalEmail,
              phone: item.phone || "N/A",
              committee1: item.allotment || 'UNGA-ESS',
              allotmentStatus: item.allotment ? 'Allotted' : 'Not allotted',
              allottedCommittee: item.allotment || null,
              originalDelegationName: item.delegationName || 'None'
            }
          });
          indCount++;
        } catch (err) {
          console.error(`Error importing individual ${item.name}:`, err.message);
        }
      }

      // Import Delegations
      for (const [key, val] of delegationGroupsMap.entries()) {
        try {
          // Check uniqueness by delegationName
          let delegation = await prisma.delegationRegistration.findUnique({
            where: { delegationName: val.originalName }
          });

          if (!delegation) {
            const publicId = await generateUniquePublicId();

            delegation = await prisma.delegationRegistration.create({
              data: {
                publicId: `DEL-${publicId}`,
                delegationName: val.originalName,
                coTeacherName: "Imported Coordinating Teacher",
                coTeacherEmail: `teacher-${key}@example.com`,
                coTeacherPhone: "N/A",
                totalDelegates: val.items.length
              }
            });
            delGroupCount++;
          }

          // Import delegates
          for (let idx = 0; idx < val.items.length; idx++) {
            const delItem = val.items[idx];
            try {
              // Ensure we check duplicate delegate inside same delegation Registration
              let existingDelegate = null;
              if (delItem.email) {
                existingDelegate = await prisma.delegationDelegate.findFirst({
                  where: {
                    delegationId: delegation.id,
                    name: delItem.name,
                    email: delItem.email
                  }
                });
              } else {
                existingDelegate = await prisma.delegationDelegate.findFirst({
                  where: {
                    delegationId: delegation.id,
                    name: delItem.name,
                    phone: delItem.phone
                  }
                });
              }

              if (existingDelegate) {
                // Update existing
                await prisma.delegationDelegate.update({
                  where: { id: existingDelegate.id },
                  data: {
                    phone: delItem.phone || existingDelegate.phone,
                    allottedCommittee: delItem.allotment || existingDelegate.allottedCommittee,
                    allotmentStatus: delItem.allotment ? 'Allotted' : existingDelegate.allotmentStatus,
                    originalDelegationName: val.originalName
                  }
                });
              } else {
                // Create new delegate
                const countD = await prisma.delegationDelegate.count();
                await prisma.delegationDelegate.create({
                  data: {
                    publicId: `${delegation.publicId}-d${countD + 1}`,
                    delegationId: delegation.id,
                    name: delItem.name,
                    email: delItem.email || null,
                    phone: delItem.phone || null,
                    allottedCommittee: delItem.allotment || null,
                    allotmentStatus: delItem.allotment ? 'Allotted' : 'Not allotted',
                    originalDelegationName: val.originalName
                  }
                });
                delDelegateCount++;
              }
            } catch (err) {
              console.error(`Error importing delegation delegate ${delItem.name}:`, err.message);
            }
          }
        } catch (err) {
          console.error(`Error importing delegation group ${val.originalName}:`, err.message);
        }
      }

      // Recalculate totals
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

      console.log(`Import completed: ${indCount} individuals, ${delGroupCount} groups, ${delDelegateCount} delegates.`);
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
