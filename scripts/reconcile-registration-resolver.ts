import { prisma } from "../lib/prisma";
import { resolveRegistrationByToken } from "../lib/registration-resolver";

async function main() {
  console.log("Starting resolver validation test...");

  // 1. Fetch a sample IndividualRegistration
  const individual = await prisma.individualRegistration.findFirst();
  if (individual) {
    console.log(`\nTesting IndividualRegistration resolver: ${individual.name} (${individual.publicId})`);
    
    // Test by id
    const resById = await resolveRegistrationByToken(individual.id);
    console.log(`- Lookup by DB ID (${individual.id}): ${resById ? 'SUCCESS' : 'FAILED'}`);
    if (resById) {
      console.log(`  Found Type: ${resById.targetType}, Name: ${resById.fullName}`);
    }

    // Test by publicId
    const resByPublic = await resolveRegistrationByToken(individual.publicId);
    console.log(`- Lookup by Public ID (${individual.publicId}): ${resByPublic ? 'SUCCESS' : 'FAILED'}`);

    // Test by trackingToken
    if (individual.trackingToken) {
      const resByToken = await resolveRegistrationByToken(individual.trackingToken);
      console.log(`- Lookup by Tracking Token (${individual.trackingToken}): ${resByToken ? 'SUCCESS' : 'FAILED'}`);
    } else {
      console.log("- Tracking token is missing on this record. Run repair script first.");
    }
  } else {
    console.log("\nNo individual registrations found in database to test.");
  }

  // 2. Fetch a sample DelegationDelegate
  const delegate = await prisma.delegationDelegate.findFirst();
  if (delegate) {
    console.log(`\nTesting DelegationDelegate resolver: ${delegate.name} (${delegate.publicId})`);
    
    // Test by id
    const resById = await resolveRegistrationByToken(delegate.id);
    console.log(`- Lookup by DB ID (${delegate.id}): ${resById ? 'SUCCESS' : 'FAILED'}`);
    if (resById) {
      console.log(`  Found Type: ${resById.targetType}, Name: ${resById.fullName}`);
    }

    // Test by publicId
    const resByPublic = await resolveRegistrationByToken(delegate.publicId);
    console.log(`- Lookup by Public ID (${delegate.publicId}): ${resByPublic ? 'SUCCESS' : 'FAILED'}`);

    // Test by trackingToken
    if (delegate.trackingToken) {
      const resByToken = await resolveRegistrationByToken(delegate.trackingToken);
      console.log(`- Lookup by Tracking Token (${delegate.trackingToken}): ${resByToken ? 'SUCCESS' : 'FAILED'}`);
    } else {
      console.log("- Tracking token is missing on this record. Run repair script first.");
    }
  } else {
    console.log("\nNo delegation delegates found in database to test.");
  }

  // 3. Test non-existent token
  console.log("\nTesting non-existent token resolution...");
  const nonExistent = await resolveRegistrationByToken("NON_EXISTENT_TOKEN_12345");
  console.log(`- Non-existent token lookup: ${nonExistent === null ? 'SUCCESS (returned null)' : 'FAILED'}`);

  await prisma.$disconnect();
  console.log("\nValidation test completed.");
}

main().catch(console.error);
