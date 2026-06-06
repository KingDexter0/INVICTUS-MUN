const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const individuals = await prisma.individualRegistration.count();
  const delegations = await prisma.delegationRegistration.count();
  const delegates = await prisma.delegationDelegate.count();

  console.log("================ DATABASE SUMMARY ================");
  console.log("Individual Registrations: ", individuals);
  console.log("Delegation Registrations: ", delegations);
  console.log("Delegation Delegates:     ", delegates);
  console.log("Total Person Records:      ", individuals + delegates);
  console.log("==================================================");
  
  await prisma.$disconnect();
}

main().catch(console.error);
