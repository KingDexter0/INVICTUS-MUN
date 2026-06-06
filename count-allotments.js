const XLSX = require('xlsx');

function main() {
  const workbook = XLSX.readFile('All Allotments.xlsx');
  const worksheet = workbook.Sheets['All Allotments'];
  const data = XLSX.utils.sheet_to_json(worksheet);
  
  let withAllotment = 0;
  let withoutAllotment = 0;
  
  data.forEach(row => {
    const email = String(row['E-mail'] || '').trim();
    if (!email) return;
    
    const allotment = String(row.Allotment || '').trim();
    if (allotment) {
      withAllotment++;
    } else {
      withoutAllotment++;
    }
  });
  
  console.log("Total rows with emails:", withAllotment + withoutAllotment);
  console.log("Rows with allotment specified:", withAllotment);
  console.log("Rows with NO allotment specified:", withoutAllotment);
}

main();
