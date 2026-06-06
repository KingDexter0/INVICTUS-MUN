const XLSX = require('xlsx');

function main() {
  const workbook = XLSX.readFile('All Allotments.xlsx');
  const worksheet = workbook.Sheets['All Allotments'];
  const data = XLSX.utils.sheet_to_json(worksheet);
  
  console.log("Total rows:", data.length);
  const emails = data.map(r => String(r['E-mail'] || '').trim().toLowerCase()).filter(Boolean);
  console.log("Total non-empty emails:", emails.length);
  
  const uniqueEmails = new Set(emails);
  console.log("Unique emails count:", uniqueEmails.size);

  const emailCounts = {};
  emails.forEach(email => {
    emailCounts[email] = (emailCounts[email] || 0) + 1;
  });

  const duplicates = Object.entries(emailCounts).filter(([email, count]) => count > 1);
  console.log("Number of duplicate emails:", duplicates.length);
  if (duplicates.length > 0) {
    console.log("Top 5 duplicate emails:", duplicates.slice(0, 5));
  }
}

main();
