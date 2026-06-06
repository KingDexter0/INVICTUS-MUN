const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function publicIdFromCount(count) {
  return `INV-2026-${String(count + 1).padStart(3, "0")}`;
}

async function importExcel(filePath, importType) {
  console.log(`Loading excel file from: ${filePath}...`);
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);
  
  console.log(`Found ${data.length} rows to process.`);
  
  let successCount = 0;
  
  for (const row of data) {
    try {
      const email = String(row['Email'] || row['E-mail'] || '').trim();
      const name = String(row['Name'] || row['Full Name'] || row['Delegation Name'] || '').trim();
      const phone = String(row['Phone'] || row['Phone Number'] || '').trim();
      
      if (!name) {
        console.log("Skipping row: missing name/delegation name.");
        continue;
      }
      
      const countInd = await prisma.individualRegistration.count();
      const countDel = await prisma.delegationRegistration.count();
      const publicId = publicIdFromCount(countInd + countDel);
      
      if (importType === 'individual') {
        await prisma.individualRegistration.create({
          data: {
            publicId,
            name,
            email: email || `${publicId}@example.com`,
            phone: phone || "N/A",
            institution: String(row['Institution'] || row['School'] || '').trim() || null,
            committee1: String(row['Committee'] || row['Allotted Committee'] || 'UNGA-ESS').trim(),
            portfolio1: String(row['Portfolio'] || row['Allotted Portfolio'] || '').trim() || null,
            allotmentStatus: row['Allotment'] || row['Allotted Committee'] ? 'Allotted' : 'Not allotted',
            allottedCommittee: String(row['Allotted Committee'] || '').trim() || null,
            allottedPortfolio: String(row['Allotted Portfolio'] || '').trim() || null,
            paymentStatus: String(row['Payment Status'] || 'Verified').trim(),
            registrationStatus: String(row['Registration Status'] || 'Approved').trim()
          }
        });
        successCount++;
      } else if (importType === 'delegation') {
        const coTeacherName = String(row['Co-ordinating Teacher'] || row['Teacher Name'] || 'N/A').trim();
        await prisma.delegationRegistration.create({
          data: {
            publicId,
            delegationName: name,
            institution: String(row['Institution'] || row['School'] || '').trim() || null,
            coTeacherName,
            coTeacherEmail: email || `teacher-${publicId}@example.com`,
            coTeacherPhone: phone || "N/A",
            totalDelegates: Number(row['Total Delegates'] || 10),
            paymentStatus: String(row['Payment Status'] || 'Verified').trim(),
            registrationStatus: String(row['Registration Status'] || 'Approved').trim()
          }
        });
        successCount++;
      } else if (importType === 'delegate') {
        const delegationId = String(row['Delegation ID'] || '').trim();
        if (!delegationId) {
          console.log(`Skipping delegate row: missing parent Delegation ID.`);
          continue;
        }
        const delegation = await prisma.delegationRegistration.findFirst({
          where: {
            OR: [
              { id: delegationId },
              { publicId: delegationId }
            ]
          }
        });
        if (!delegation) {
          console.log(`Skipping delegate row: parent delegation with ID ${delegationId} not found.`);
          continue;
        }
        
        const delegatesCount = await prisma.delegationDelegate.count({
          where: { delegationId: delegation.id }
        });
        
        await prisma.delegationDelegate.create({
          data: {
            publicId: `${delegation.publicId}-d${delegatesCount + 1}`,
            delegationId: delegation.id,
            name,
            email: email || null,
            phone: phone || null,
            allottedCommittee: String(row['Allotted Committee'] || '').trim() || null,
            allottedPortfolio: String(row['Allotted Portfolio'] || '').trim() || null,
            allotmentStatus: row['Allotted Committee'] ? 'Allotted' : 'Not allotted'
          }
        });
        successCount++;
      }
    } catch (err) {
      console.error(`Error processing row:`, err.message);
    }
  }
  
  console.log(`Import finished! Successfully imported ${successCount} records.`);
  await prisma.$disconnect();
}

const args = process.argv.slice(2);
if (args.length < 2) {
  console.log("Usage: node import-excel-data.js <path-to-excel-file> <individual|delegation|delegate>");
  process.exit(1);
}

importExcel(args[0], args[1]);
