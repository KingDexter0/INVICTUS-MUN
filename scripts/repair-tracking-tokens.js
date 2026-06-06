const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isApply = args.includes('--apply');

  if (!isDryRun && !isApply) {
    console.log("Usage:");
    console.log("  Dry Run:  node scripts/repair-tracking-tokens.js --dry-run");
    console.log("  Apply:    node scripts/repair-tracking-tokens.js --apply");
    process.exit(1);
  }

  console.log(`Starting tracking token repair in ${isDryRun ? 'DRY-RUN' : 'APPLY'} mode...`);

  // 1. Fetch all existing non-null tracking tokens to avoid duplicates
  const individualTokens = await prisma.individualRegistration.findMany({
    where: { NOT: { trackingToken: null } },
    select: { trackingToken: true }
  });
  const delegateTokens = await prisma.delegationDelegate.findMany({
    where: { NOT: { trackingToken: null } },
    select: { trackingToken: true }
  });

  const existingTokens = new Set([
    ...individualTokens.map(r => r.trackingToken),
    ...delegateTokens.map(d => d.trackingToken)
  ]);

  function getUniqueToken() {
    let token = randomUUID();
    while (existingTokens.has(token)) {
      token = randomUUID();
    }
    existingTokens.add(token);
    return token;
  }

  // 2. Find IndividualRegistration with missing/empty trackingToken
  const missingInds = await prisma.individualRegistration.findMany({
    where: {
      OR: [
        { trackingToken: null },
        { trackingToken: "" }
      ]
    }
  });

  console.log(`Found ${missingInds.length} individual registrations with missing tracking tokens.`);

  let repairedCount = 0;

  for (const reg of missingInds) {
    const token = getUniqueToken();
    if (isDryRun) {
      console.log(`[DRY-RUN] Will generate token ${token} for Individual ${reg.name} (${reg.publicId})`);
    } else {
      await prisma.individualRegistration.update({
        where: { id: reg.id },
        data: { trackingToken: token }
      });
      console.log(`[REPAIRED] Generated token ${token} for Individual ${reg.name} (${reg.publicId})`);
      repairedCount++;
    }
  }

  // 3. Find DelegationDelegate with missing/empty trackingToken
  const missingDels = await prisma.delegationDelegate.findMany({
    where: {
      OR: [
        { trackingToken: null },
        { trackingToken: "" }
      ]
    }
  });

  console.log(`Found ${missingDels.length} delegation delegates with missing tracking tokens.`);

  for (const del of missingDels) {
    const token = getUniqueToken();
    if (isDryRun) {
      console.log(`[DRY-RUN] Will generate token ${token} for Delegate ${del.name} (${del.publicId})`);
    } else {
      await prisma.delegationDelegate.update({
        where: { id: del.id },
        data: { trackingToken: token }
      });
      console.log(`[REPAIRED] Generated token ${token} for Delegate ${del.name} (${del.publicId})`);
      repairedCount++;
    }
  }

  console.log(`\nRepair completed. Repaired ${repairedCount} records in database.`);
  await prisma.$disconnect();
}

main().catch(console.error);
