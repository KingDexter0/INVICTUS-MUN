const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function normalizeStr(val) {
  if (val === undefined || val === null) return '';
  return String(val).trim();
}

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

async function main() {
  const workbook = XLSX.readFile('All Allotments.xlsx');
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet);

  const parsedRows = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const normalizedRow = {};
    for (const key of Object.keys(row)) {
      normalizedRow[key.trim().toLowerCase()] = row[key];
    }
    const name = normalizeStr(normalizedRow['name'] || normalizedRow['full name']);
    if (!name) continue;

    parsedRows.push({
      rowNum: i + 2, // 1-indexed, +1 header row
      name,
      email: normalizeStr(normalizedRow['email'] || normalizedRow['e-mail']),
      phone: normalizeStr(normalizedRow['phone'] || normalizedRow['number'] || normalizedRow['phone number']),
      allotment: normalizeStr(normalizedRow['allotment'] || normalizedRow['allotted committee']),
      delegationName: normalizeStr(normalizedRow['delegation name (if any)'] || normalizedRow['delegation name'] || '')
    });
  }

  const dbIndividuals = await prisma.individualRegistration.findMany();
  const dbDelegates = await prisma.delegationDelegate.findMany();

  console.log(`Excel parsed: ${parsedRows.length} valid rows.`);
  console.log(`DB Individuals: ${dbIndividuals.length}`);
  console.log(`DB Delegation Delegates: ${dbDelegates.length}`);
  console.log(`DB Total: ${dbIndividuals.length + dbDelegates.length}`);

  // For each Excel row, find match in DB
  const missing = [];
  const dbMatchedIds = new Set();
  const matchedRows = [];

  for (const xl of parsedRows) {
    const matchedInds = dbIndividuals.filter(db => 
      db.name.toLowerCase() === xl.name.toLowerCase() ||
      (db.email && xl.email && db.email.toLowerCase() === xl.email.toLowerCase())
    );
    const matchedDels = dbDelegates.filter(db => 
      db.name.toLowerCase() === xl.name.toLowerCase() ||
      (db.email && xl.email && db.email.toLowerCase() === xl.email.toLowerCase())
    );

    const allMatches = [...matchedInds.map(i => ({ type: 'individual', record: i })), ...matchedDels.map(d => ({ type: 'delegate', record: d }))];

    if (allMatches.length === 0) {
      missing.push(xl);
    } else {
      matchedRows.push({ xl, matches: allMatches });
      for (const m of allMatches) {
        dbMatchedIds.add(m.record.id);
      }
    }
  }

  console.log("\n--- Missing Rows in DB ---");
  console.log(missing);

  console.log("\n--- Mismatch Check ---");
  console.log("Total unique DB records matched:", dbMatchedIds.size);

  // Find DB records that matched multiple Excel rows
  const dbRecordMatchesCount = new Map();
  for (const item of matchedRows) {
    for (const m of item.matches) {
      const id = `${m.type}-${m.record.id}-${m.record.name}`;
      dbRecordMatchesCount.set(id, (dbRecordMatchesCount.get(id) || 0) + 1);
    }
  }

  console.log("\n--- DB records matching multiple Excel rows ---");
  for (const [id, count] of dbRecordMatchesCount.entries()) {
    if (count > 1) {
      console.log(`DB Record ${id} matched ${count} times in Excel.`);
    }
  }

  // Find Excel rows matching the same DB record or Excel duplicates
  const nameCounts = new Map();
  for (const xl of parsedRows) {
    const key = `${xl.name.toLowerCase()}|${xl.email.toLowerCase()}`;
    nameCounts.set(key, (nameCounts.get(key) || 0) + 1);
  }

  console.log("\n--- Rows matching Manya Chopra DB email or name ---");
  const matchingRows = parsedRows.filter(xl => 
    xl.name.toLowerCase() === "manya chopra" || 
    xl.email.toLowerCase() === "manyachopra2701@gmail.com"
  );
  console.log(matchingRows);

  await prisma.$disconnect();
}

main();
