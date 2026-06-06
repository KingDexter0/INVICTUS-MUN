import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";

function loadEnv() {
  try {
    const envPath = path.join(__dirname, "..", ".env");
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, "utf8").split("\n");
      for (const line of lines) {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let value = (match[2] || "").trim();
          // Remove wrapping quotes if present
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.substring(1, value.length - 1);
          } else if (value.startsWith("'") && value.endsWith("'")) {
            value = value.substring(1, value.length - 1);
          }
          process.env[key] = value;
        }
      }
    }
  } catch (err) {
    console.warn("Could not read .env file:", err);
  }
}

async function main() {
  loadEnv();

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;
  const to = process.env.TEST_EMAIL_TO || user;

  console.log("================ SMTP TEST SCRIPT ================");
  console.log("Host:  ", host);
  console.log("Port:  ", port);
  console.log("Secure:", secure);
  console.log("User:  ", user);
  console.log("From:  ", from);
  console.log("To:    ", to);
  console.log("==================================================\n");

  if (!host || !user || !pass || !to) {
    console.error("Error: Missing SMTP configuration (host, user, pass) or target email (to).");
    process.exit(1);
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  try {
    console.log("Verifying connection to SMTP server...");
    await transporter.verify();
    console.log("SMTP connection verified successfully!");

    console.log(`Sending test email to ${to}...`);
    const info = await transporter.sendMail({
      from,
      to,
      subject: "Invictus MUN: CLI SMTP Connection Test",
      text: "This confirms that SMTP is working correctly via the command line test script.",
      html: "<p>This confirms that SMTP is working correctly via the command line test script.</p>",
    });

    console.log(`Email sent successfully! MessageID: ${info.messageId}`);
  } catch (err) {
    console.error("SMTP Test Failed:", err);
    process.exit(1);
  }
}

main().catch(console.error);
