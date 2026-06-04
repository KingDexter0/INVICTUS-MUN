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
ADMIN_PASSCODE="..."
ADMIN_SESSION_SECRET="..."
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

- `/registration` creates a database registration and uploads payment proof to Cloudinary when a file is attached.
- `/dashboard?id=INV-2026-001` shows delegate status, allotment, announcements, and QR preview after allotment release.
- `/portal` requires `ADMIN_PASSCODE`, then lets admins verify/reject payment, approve registrations, release allotments, save notes, publish announcements, and export CSV.

The active website is the Next.js App Router project in `app/`, with Prisma database access in `lib/` and `prisma/`.
