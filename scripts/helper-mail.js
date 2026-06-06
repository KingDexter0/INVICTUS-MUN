const { PrismaClient } = require('@prisma/client');
const nodemailer = require('nodemailer');
const { randomUUID } = require('crypto');

const prisma = new PrismaClient();

const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpSecure = process.env.SMTP_SECURE === "true";
const isTestMode = process.env.EMAIL_TEST_MODE === "true";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: smtpPort,
  secure: smtpSecure,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function configured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:4173";
}

function testModeNotice(to, trigger) {
  if (!isTestMode) return "";
  return `
    <div style="margin:0 0 18px;padding:12px;border:1px solid #e9d8a6;border-radius:12px;background:#fff8e6;color:#6f4f00">
      <strong>SMTP test mode</strong>
      <p style="margin:8px 0 0">Original intended recipient: ${to}</p>
      <p style="margin:6px 0 0">Trigger: ${trigger}</p>
    </div>
  `;
}

function getDelegateDashboardUrl(trackingToken) {
  const base = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || siteUrl();
  return `${base}/dashboard?id=${encodeURIComponent(trackingToken)}`;
}

async function sendEmail({ to, subject, html }) {
  if (!configured()) {
    console.warn("SMTP email skipped: host, user, or pass are not configured.");
    return { status: "skipped" };
  }

  const recipient = Array.isArray(to) ? to.join(", ") : to;
  const actualTo = isTestMode ? (process.env.TEST_EMAIL_TO || "yokshpatil7388@gmail.com") : recipient;
  const finalHtml = isTestMode ? html.replace(testModeNotice("", subject), testModeNotice(recipient, subject)) : html;

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: actualTo,
      subject,
      html: finalHtml,
    });
    return { status: isTestMode ? "sent-test" : "sent", messageId: info.messageId };
  } catch (error) {
    console.error(`[SMTP] Send failed to: ${actualTo}`, error);
    throw error;
  }
}

async function sendAllotmentAndPaymentEmail({ to, name, publicId, trackingToken, committee, portfolio }) {
  const dashboardUrl = getDelegateDashboardUrl(trackingToken);
  return sendEmail({
    to,
    subject: "Invictus MUN: Portfolio Allotment & Dashboard Access",
    html: `
      <div style="margin:0;padding:0;background:#ffffff;font-family:Arial,sans-serif;color:#181424">
        <div style="max-width:620px;margin:0 auto;padding:28px">
          ${testModeNotice("", "Allotment & Payment Confirmation")}
          <div style="border-left:5px solid #6d43c8;padding-left:16px;margin-bottom:24px">
            <p style="margin:0;color:#6d43c8;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">Invictus MUN</p>
            <h1 style="margin:8px 0 0;font-size:28px;line-height:1.2">Your Portfolio is Allotted!</h1>
          </div>
          <p style="font-size:16px;line-height:1.7">Dear ${name},</p>
          <p style="font-size:16px;line-height:1.7">We are pleased to inform you that your portfolio/allotment has been assigned, and your registration payment is verified. You can now access your personalized delegate dashboard.</p>
          <div style="margin:20px 0;padding:16px;border:1px solid #e9e5f0;border-radius:14px;background:#fbf9ff">
            <p style="margin:6px 0;color:#565061"><strong>Delegate ID:</strong> ${publicId}</p>
            <p style="margin:6px 0;color:#565061"><strong>Committee:</strong> ${committee}</p>
            <p style="margin:6px 0;color:#565061"><strong>Portfolio/Allotment:</strong> ${portfolio}</p>
          </div>
          <div style="margin:24px 0">
            <a href="${dashboardUrl}" style="display:inline-block;padding:14px 24px;border-radius:999px;background:#6d43c8;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;text-align:center">Open Delegate Dashboard</a>
          </div>
          <p style="margin-top:24px;color:#706b7e;font-size:13px;line-height:1.6">This is an automated update from Invictus MUN.</p>
        </div>
      </div>
    `,
  });
}

// Clean helper to check and process emails for scripts/batch jobs
async function processDelegateEmail(type, record, forceResend = false, apply = false) {
  if (type === 'individual') {
    const hasAllotment = Boolean(
      (record.allottedCommittee && record.allottedCommittee.trim()) ||
      (record.allottedPortfolio && record.allottedPortfolio.trim())
    );
    const isPaid = record.paymentStatus === "Verified";

    if (!hasAllotment || !isPaid) {
      return { status: "skipped", reason: `Criteria not met. allotment=${hasAllotment}, payment=${isPaid}` };
    }

    if (record.allotmentEmailSent && !forceResend) {
      return { status: "skipped", reason: "Already sent" };
    }

    if (!apply) {
      return { status: "dry-run-eligible", name: record.name, email: record.email };
    }

    let trackingToken = record.trackingToken;
    if (!trackingToken) {
      trackingToken = randomUUID();
      await prisma.individualRegistration.update({
        where: { id: record.id },
        data: { trackingToken },
      });
    }

    const res = await sendAllotmentAndPaymentEmail({
      to: record.email,
      name: record.name,
      publicId: record.publicId,
      trackingToken,
      committee: record.allottedCommittee || "N/A",
      portfolio: record.allottedPortfolio || "N/A",
    });

    if (res.status === "sent" || res.status === "sent-test") {
      await prisma.individualRegistration.update({
        where: { id: record.id },
        data: {
          allotmentEmailSent: true,
          allotmentEmailSentAt: new Date(),
        },
      });
    }
    return res;
  } else {
    // delegate
    const hasAllotment = Boolean(
      (record.allottedCommittee && record.allottedCommittee.trim()) ||
      (record.allottedPortfolio && record.allottedPortfolio.trim())
    );
    const isPaid = record.delegation.paymentStatus === "Verified";

    if (!hasAllotment || !isPaid) {
      return { status: "skipped", reason: `Criteria not met. allotment=${hasAllotment}, payment=${isPaid}` };
    }

    if (record.allotmentEmailSent && !forceResend) {
      return { status: "skipped", reason: "Already sent" };
    }

    if (!record.email) {
      return { status: "skipped", reason: "No email" };
    }

    if (!apply) {
      return { status: "dry-run-eligible", name: record.name, email: record.email };
    }

    let trackingToken = record.trackingToken;
    if (!trackingToken) {
      trackingToken = randomUUID();
      await prisma.delegationDelegate.update({
        where: { id: record.id },
        data: { trackingToken },
      });
    }

    const res = await sendAllotmentAndPaymentEmail({
      to: record.email,
      name: record.name,
      publicId: record.publicId,
      trackingToken,
      committee: record.allottedCommittee || "N/A",
      portfolio: record.allottedPortfolio || "N/A",
    });

    if (res.status === "sent" || res.status === "sent-test") {
      await prisma.delegationDelegate.update({
        where: { id: record.id },
        data: {
          allotmentEmailSent: true,
          allotmentEmailSentAt: new Date(),
        },
      });
    }
    return res;
  }
}

module.exports = {
  processDelegateEmail,
  sendAllotmentAndPaymentEmail,
  getDelegateDashboardUrl
};
