const { PrismaClient } = require('@prisma/client');
const { processDelegateEmail } = require('./helper-mail');

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isApply = args.includes('--apply');
  const force = args.includes('--force');

  if (!isDryRun && !isApply) {
    console.log("Usage:");
    console.log("  Dry Run:  node scripts/send-allotment-payment-emails.js --dry-run");
    console.log("  Apply:    node scripts/send-allotment-payment-emails.js --apply");
    console.log("  Options:  --force (resends even if already marked sent)");
    process.exit(1);
  }

  console.log(`Starting combined allotment and payment email batch script in ${isDryRun ? 'DRY-RUN' : 'APPLY'} mode...`);

  // 1. Fetch all individual registrations
  const individuals = await prisma.individualRegistration.findMany();
  console.log(`Found ${individuals.length} individual registrations.`);

  // 2. Fetch all delegation delegates (with their parent delegation to check payment status)
  const delegates = await prisma.delegationDelegate.findMany({
    include: { delegation: true }
  });
  console.log(`Found ${delegates.length} delegation delegates.`);

  let eligibleIndividuals = 0;
  let eligibleDelegates = 0;
  let sentCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  console.log("\n--- Processing Individuals ---");
  for (const reg of individuals) {
    try {
      const res = await processDelegateEmail('individual', reg, force, isApply);
      if (res.status === 'dry-run-eligible') {
        eligibleIndividuals++;
        console.log(`[ELIGIBLE INDIVIDUAL] Name: ${res.name}, Email: ${res.email}, PublicId: ${reg.publicId}`);
      } else if (res.status === 'sent' || res.status === 'sent-test') {
        sentCount++;
        console.log(`[SENT INDIVIDUAL] ${reg.name} (${reg.email}) - Status: ${res.status}`);
      } else if (res.status === 'skipped') {
        skippedCount++;
      }
    } catch (err) {
      failedCount++;
      console.error(`[FAILED INDIVIDUAL] ${reg.name} (${reg.email}):`, err);
    }
  }

  console.log("\n--- Processing Delegation Delegates ---");
  for (const del of delegates) {
    try {
      const res = await processDelegateEmail('delegate', del, force, isApply);
      if (res.status === 'dry-run-eligible') {
        eligibleDelegates++;
        console.log(`[ELIGIBLE DELEGATE] Name: ${res.name}, Email: ${res.email}, PublicId: ${del.publicId}, Delegation: ${del.delegation.delegationName}`);
      } else if (res.status === 'sent' || res.status === 'sent-test') {
        sentCount++;
        console.log(`[SENT DELEGATE] ${del.name} (${del.email}) - Status: ${res.status}`);
      } else if (res.status === 'skipped') {
        skippedCount++;
      }
    } catch (err) {
      failedCount++;
      console.error(`[FAILED DELEGATE] ${del.name} (${del.email}):`, err);
    }
  }

  console.log("\n================ BATCH RESULTS ================");
  if (isDryRun) {
    console.log(`Eligible Individuals: ${eligibleIndividuals}`);
    console.log(`Eligible Delegates: ${eligibleDelegates}`);
    console.log(`Total Eligible to send: ${eligibleIndividuals + eligibleDelegates}`);
  } else {
    console.log(`Total successfully sent: ${sentCount}`);
    console.log(`Total skipped: ${skippedCount}`);
    console.log(`Total failed: ${failedCount}`);
  }
  console.log("===============================================\n");

  await prisma.$disconnect();
}

main().catch(console.error);
