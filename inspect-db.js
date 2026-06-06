const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const countLegacy = await prisma.registration.count();
  const countIndividual = await prisma.individualRegistration.count();
  const countDelegation = await prisma.delegationRegistration.count();
  const countDelegate = await prisma.delegationDelegate.count();
  
  console.log("Counts in DB:");
  console.log("- Legacy registrations:", countLegacy);
  console.log("- Individual registrations:", countIndividual);
  console.log("- Delegation registrations:", countDelegation);
  console.log("- Delegation delegates:", countDelegate);
  
  await prisma.$disconnect();
}

main().catch(console.error);
