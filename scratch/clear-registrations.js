const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Emptying all registrations tables from Prisma (including legacy table)...");
  
  await prisma.$transaction([
    prisma.delegationDelegate.deleteMany(),
    prisma.delegationRegistration.deleteMany(),
    prisma.individualRegistration.deleteMany(),
    prisma.registration.deleteMany()
  ]);
  
  console.log("All registrations successfully deleted and database is empty.");
  await prisma.$disconnect();
}

main().catch(console.error);
