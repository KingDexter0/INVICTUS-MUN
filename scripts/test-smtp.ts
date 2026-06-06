import { config } from "dotenv";
import path from "path";
// Load env files
config({ path: path.resolve(process.cwd(), ".env") });

import { verifySmtpConnection, sendAdminTestEmail } from "../lib/mail";

async function main() {
  const args = process.argv.slice(2);
  const targetEmail = args[0] || process.env.TEST_EMAIL_TO || process.env.SMTP_USER;

  if (!targetEmail) {
    console.error("Error: Please provide a target email address.");
    console.error("Usage: npm run test:smtp -- your-email@example.com");
    process.exit(1);
  }

  console.log("-------------------------------------------------");
  console.log("Invictus MUN - CLI SMTP Diagnostics Tool");
  console.log("-------------------------------------------------");
  console.log(`SMTP Host: ${process.env.SMTP_HOST}`);
  console.log(`SMTP Port: ${process.env.SMTP_PORT || 587}`);
  console.log(`SMTP User: ${process.env.SMTP_USER}`);
  console.log(`SMTP From: ${process.env.SMTP_FROM || process.env.SMTP_USER}`);
  console.log(`Target:    ${targetEmail}`);
  console.log("-------------------------------------------------");

  console.log("Verifying SMTP connection credentials...");
  try {
    await verifySmtpConnection();
    console.log("✔ SMTP Connection verified successfully!");
  } catch (err) {
    console.error("❌ SMTP Verification Failed!");
    console.error(err);
    process.exit(1);
  }

  console.log(`Sending diagnostic test email to: ${targetEmail}...`);
  try {
    const result = await sendAdminTestEmail(targetEmail);
    console.log(`✔ Diagnostic email sent! Status: ${result.status}, MessageID: ${result.messageId}`);
    console.log("Check the inbox of the target email to confirm receipt.");
  } catch (err) {
    console.error("❌ Diagnostic Email Sending Failed!");
    console.error(err);
    process.exit(1);
  }
}

main().catch(console.error);
