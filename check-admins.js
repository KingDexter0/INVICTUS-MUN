const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const admins = await prisma.adminUser.findMany();
  console.log("Admins in database:", admins);
  await prisma.$disconnect();
}
main().catch(console.error);
