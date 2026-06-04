-- CreateTable
CREATE TABLE "Registration" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "institution" TEXT,
    "type" TEXT NOT NULL,
    "committee1" TEXT NOT NULL,
    "committee2" TEXT,
    "portfolio1" TEXT,
    "muns" INTEGER,
    "awards" INTEGER,
    "experience" TEXT,
    "utr" TEXT,
    "amount" INTEGER NOT NULL DEFAULT 1500,
    "paymentProofUrl" TEXT,
    "paymentProofPublicId" TEXT,
    "accommodation" TEXT,
    "transport" TEXT,
    "arrivalCity" TEXT,
    "requirements" TEXT,
    "paymentStatus" TEXT NOT NULL DEFAULT 'Pending',
    "registrationStatus" TEXT NOT NULL DEFAULT 'Pending',
    "allotmentStatus" TEXT NOT NULL DEFAULT 'Not allotted',
    "allottedCommittee" TEXT,
    "allottedPortfolio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminNote" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Registration_publicId_key" ON "Registration"("publicId");

-- CreateIndex
CREATE INDEX "Registration_email_idx" ON "Registration"("email");

-- CreateIndex
CREATE INDEX "Registration_phone_idx" ON "Registration"("phone");

-- CreateIndex
CREATE INDEX "Registration_paymentStatus_idx" ON "Registration"("paymentStatus");

-- CreateIndex
CREATE INDEX "Registration_registrationStatus_idx" ON "Registration"("registrationStatus");

-- CreateIndex
CREATE INDEX "Registration_allotmentStatus_idx" ON "Registration"("allotmentStatus");

-- CreateIndex
CREATE INDEX "AdminNote_registrationId_idx" ON "AdminNote"("registrationId");

-- AddForeignKey
ALTER TABLE "AdminNote" ADD CONSTRAINT "AdminNote_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
