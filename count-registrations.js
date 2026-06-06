const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.registration.count();
  console.log("Total registrations in database:", count);
  
  const byType = await prisma.registration.groupBy({
    by: ['registrationType'],
    _count: true
  });
  console.log("Grouped by registrationType:", byType);
  
  await prisma.$disconnect();
}

main().catch(console.error);
