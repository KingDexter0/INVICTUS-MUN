# Invictus MUN Portal

Next.js App Router version of the Invictus MUN portal.

## Setup

1. Install dependencies:

```powershell
npm.cmd install
```

2. Create `.env` from `.env.example` and fill:

```env
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
CLOUDINARY_CLOUD_NAME="..."
CLOUDINARY_API_KEY="..."
CLOUDINARY_API_SECRET="..."
ADMIN_SETUP_TOKEN="..."
CHECKIN_PASSCODE="..."
ADMIN_SESSION_SECRET="..."
RESEND_API_KEY="..."
FROM_EMAIL="Invictus MUN <noreply@yourdomain.com>"
EMAIL_TEST_MODE="false"
TEST_EMAIL_TO=""
NEXT_PUBLIC_SITE_URL="https://invictusmun.com"
NEXT_PUBLIC_RAZORPAY_KEY_ID="..."
RAZORPAY_KEY_ID="..."
RAZORPAY_KEY_SECRET="..."
RAZORPAY_WEBHOOK_SECRET="..."
WHATSAPP_ACCESS_TOKEN="..."
WHATSAPP_PHONE_NUMBER_ID="..."
WHATSAPP_TEMPLATE_NAME="..."
WHATSAPP_TEMPLATE_LANGUAGE="en_US"
```

3. Create the PostgreSQL tables:

```powershell
npx.cmd prisma migrate deploy
```

For local development against a disposable database, use:

```powershell
npx.cmd prisma migrate dev
```

4. Run the app:

```powershell
npm.cmd run dev
```

Open `http://127.0.0.1:4173`.

## Core Flow

- `/registration` creates a database registration and sends delegates to the dashboard for Razorpay payment.
- `/dashboard?id=INV-2026-001` shows delegate status, allotment, announcements, and QR preview after allotment release.
- `/mun-ops` requires an admin email/password account, then lets admins verify/reject payment, approve registrations, release allotments, save notes, publish announcements, manage resources/EB/testimonials/admin users, and export CSV.
- `/admin-portal` and `/portal` redirect to `/mun-ops` for backwards compatibility.
- `/delegate/login` lets delegates open a private dashboard with registered email + phone.
- `/verify/pass/INV-2026-001` verifies QR passes and supports limited staff check-in through `CHECKIN_PASSCODE`.
- `/executive-board` displays published Executive Board profiles managed from the admin portal.
- `/api/payments/razorpay/order` and `/api/payments/razorpay/verify` support Razorpay checkout when Razorpay keys are configured.
- Admin portal includes admin user creation, analytics, certificate issuing, award assignment, and WhatsApp test tools.
- `/eb/login` and `/eb/dashboard` provide a limited EB workspace for EB profiles with email + phone saved by admin.

## External Services

Razorpay requires `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `NEXT_PUBLIC_RAZORPAY_KEY_ID`. The public status dashboard shows a Razorpay payment button for unpaid registrations and verifies payment signatures server-side.

WhatsApp automation uses Meta WhatsApp Cloud API. Set `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, and an approved `WHATSAPP_TEMPLATE_NAME`. If these are missing, WhatsApp sends are safely skipped/logged.

## First Admin Setup

Set `ADMIN_SETUP_TOKEN` in production. If no admin users exist yet, `/mun-ops` shows a **First Admin Setup** form. After the first admin account is created, only admin email/password login is shown.

## Resend Test Email Mode

For safe email testing:

```env
EMAIL_TEST_MODE="true"
TEST_EMAIL_TO="your-test-inbox@example.com"
FROM_EMAIL="Invictus MUN <onboarding@resend.dev>"
```

When test mode is on, all automated emails go only to `TEST_EMAIL_TO`. The email body includes the original intended recipient and trigger name. The admin portal has a **Send Test Email** button to verify Resend setup.

The active website is the Next.js App Router project in `app/`, with Prisma database access in `lib/` and `prisma/`.
