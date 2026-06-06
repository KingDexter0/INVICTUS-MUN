const { PrismaClient } = require('@prisma/client');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Helper to delay execution (rate limiting)
const sleep = (ms) => new Promise((resolve) => resolve(setTimeout(resolve, ms)));

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isApply = args.includes('--apply');

  if (!isDryRun && !isApply) {
    console.log("Usage:");
    console.log("  Dry Run:  node scripts/send-registrations-email.js --dry-run");
    console.log("  Apply:    node scripts/send-registrations-email.js --apply");
    process.exit(1);
  }

  // Load environment variables manually
  let host = process.env.SMTP_HOST;
  let port = Number(process.env.SMTP_PORT || 587);
  let secure = process.env.SMTP_SECURE === "true";
  let user = process.env.SMTP_USER;
  let pass = process.env.SMTP_PASS;
  let fromEmail = process.env.SMTP_FROM || user;
  let siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000";

  // Read from .env file directly
  try {
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      host = host || envContent.match(/SMTP_HOST="?([^"\n\r]+)"?/)?.[1];
      const portStr = envContent.match(/SMTP_PORT="?([^"\n\r]+)"?/)?.[1];
      if (portStr) port = Number(portStr);
      secure = secure || envContent.match(/SMTP_SECURE="?([^"\n\r]+)"?/)?.[1] === "true";
      user = user || envContent.match(/SMTP_USER="?([^"\n\r]+)"?/)?.[1];
      pass = pass || envContent.match(/SMTP_PASS="?([^"\n\r]+)"?/)?.[1];
      fromEmail = fromEmail || envContent.match(/SMTP_FROM="?([^"\n\r]+)"?/)?.[1];
      siteUrl = siteUrl || envContent.match(/NEXT_PUBLIC_SITE_URL="?([^"\n\r]+)"?/)?.[1];
    }
  } catch (err) {
    console.warn("Could not read .env file:", err.message);
  }

  if (!host || !user || !pass) {
    console.error("Error: SMTP_HOST, SMTP_USER, or SMTP_PASS environment variable is missing.");
    process.exit(1);
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass }
  });

  console.log("Fetching registered individuals and delegates from database...");
  const individuals = await prisma.individualRegistration.findMany();
  const delegates = await prisma.delegationDelegate.findMany({
    include: {
      delegation: true
    }
  });

  const totalPeople = individuals.length + delegates.length;
  console.log(`\n================ REGISTERED RECIPIENTS ================`);
  console.log(`Individual Registrations: ${individuals.length}`);
  console.log(`Delegation Delegates:     ${delegates.length}`);
  console.log(`Total Recipients:         ${totalPeople}`);
  console.log(`=======================================================\n`);

  // Build the list of recipients with their custom details
  const recipients = [];

  for (const ind of individuals) {
    if (!ind.email || ind.email.includes('@example.com')) {
      console.warn(`[Skip] Individual ${ind.name} has no valid email: ${ind.email}`);
      continue;
    }
    recipients.push({
      type: 'individual',
      name: ind.name,
      email: ind.email.trim(),
      publicId: ind.publicId,
      committee: ind.allottedCommittee || ind.committee1 || 'Not allotted yet',
      portfolio: ind.allottedPortfolio || ind.portfolio1 || 'Not allotted yet',
      delegationName: ind.originalDelegationName || 'Independent'
    });
  }

  for (const del of delegates) {
    if (!del.email || del.email.includes('@example.com')) {
      console.warn(`[Skip] Delegate ${del.name} has no valid email: ${del.email}`);
      continue;
    }
    recipients.push({
      type: 'delegate',
      name: del.name,
      email: del.email.trim(),
      publicId: del.publicId,
      committee: del.allottedCommittee || del.committee1 || 'Not allotted yet',
      portfolio: del.allottedPortfolio || del.portfolio1 || 'Not allotted yet',
      delegationName: del.originalDelegationName || del.delegation.delegationName
    });
  }

  console.log(`Total eligible email recipients: ${recipients.length} / ${totalPeople}`);

  if (isDryRun) {
    console.log("\n[DRY RUN PREVIEW] Showing first 5 recipients:");
    console.log(recipients.slice(0, 5));
    console.log("\nDry run completed successfully. No emails were sent.");
    await prisma.$disconnect();
    return;
  }

  console.log(`\nStarting email broadcast to ${recipients.length} recipients...`);
  
  // Track already sent emails to support resuming after hitting quota limits
  const sentLogPath = path.join(__dirname, '..', 'public', 'sent-emails.json');
  let sentIds = [];
  if (fs.existsSync(sentLogPath)) {
    try {
      sentIds = JSON.parse(fs.readFileSync(sentLogPath, 'utf8'));
    } catch (err) {
      console.warn("Could not read sent-emails.json log, starting fresh:", err.message);
    }
  }

  let sentCount = 0;
  let failCount = 0;
  let skipCount = 0;

  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i];
    
    if (sentIds.includes(r.publicId)) {
      console.log(`[${i + 1}/${recipients.length}] Skipping ${r.name} (${r.email}) - Already sent.`);
      skipCount++;
      continue;
    }

    const heading = "Registration and Allotment Confirmation";
    const action = `Your registration for Invictus MUN 2026 is confirmed. Below are your registration, committee, and portfolio details:`;
    
    const detailsHtml = `
      <p style="margin:6px 0;color:#565061"><strong>Committee:</strong> ${r.committee}</p>
      <p style="margin:6px 0;color:#565061"><strong>Portfolio:</strong> ${r.portfolio}</p>
      <p style="margin:6px 0;color:#565061"><strong>Delegation:</strong> ${r.delegationName}</p>
    `;

    const htmlContent = `
      <div style="margin:0;padding:0;background:#ffffff;font-family:Arial,sans-serif;color:#181424">
        <div style="max-width:620px;margin:0 auto;padding:28px;border:1px solid #e9e5f0;border-radius:16px;box-shadow:0 4px 12px rgba(0,0,0,0.05)">
          <div style="border-left:5px solid #6d43c8;padding-left:16px;margin-bottom:24px">
            <p style="margin:0;color:#6d43c8;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">Invictus MUN</p>
            <h1 style="margin:8px 0 0;font-size:28px;line-height:1.2">${heading}</h1>
          </div>
          <p style="font-size:16px;line-height:1.7">Dear ${r.name},</p>
          <p style="font-size:16px;line-height:1.7">${action}</p>
          <div style="margin:20px 0;padding:16px;border:1px solid #e9e5f0;border-radius:14px;background:#fbf9ff">
            <p style="margin:6px 0;color:#565061"><strong>Delegate ID:</strong> ${r.publicId}</p>
            ${detailsHtml}
          </div>
          <p style="font-size:16px;line-height:1.7">You can access your delegate dashboard to view study guides, resources, and updates using the button below:</p>
          <div style="margin:24px 0 12px 0;">
            <a href="${siteUrl}/portal" style="display:inline-block;padding:12px 24px;border-radius:999px;background:#6d43c8;color:#ffffff;text-decoration:none;font-weight:700;box-shadow:0 4px 6px rgba(109,67,200,0.2)">Open Delegate Dashboard</a>
          </div>
          <p style="margin-top:28px;color:#706b7e;font-size:13px;line-height:1.6;border-top:1px solid #eee;padding-top:16px">This is an automated update from Invictus MUN. Please do not reply directly to this email.</p>
        </div>
      </div>
    `;

    try {
      console.log(`[${i + 1}/${recipients.length}] Sending to ${r.name} (${r.email})...`);
      const info = await transporter.sendMail({
        from: fromEmail,
        to: r.email,
        subject: "Invictus MUN 2026: Registration & Allotment Confirmed",
        html: htmlContent
      });

      sentCount++;
      sentIds.push(r.publicId);
      fs.writeFileSync(sentLogPath, JSON.stringify(sentIds, null, 2));
    } catch (err) {
      console.error(`  [FAILED] Exception:`, err.message);
      failCount++;
    }

    // Rate limiting: sleep for 600ms between sends to stay under Resend's 2 requests/second rate limit
    await sleep(600);
  }

  console.log(`\n================ BROADCAST SUMMARY ================`);
  console.log(`Already Sent (Skipped): ${skipCount}`);
  console.log(`Newly Sent Successfully: ${sentCount}`);
  console.log(`Total Failures:          ${failCount}`);
  console.log(`===================================================\n`);

  await prisma.$disconnect();
}

main().catch(console.error);
