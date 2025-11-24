-- CreateTable
CREATE TABLE "Firm" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firmName" TEXT NOT NULL,
    "profile" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Firm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "dealName" TEXT NOT NULL,
    "targetAmount" DOUBLE PRECISION NOT NULL,
    "sector" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "dealType" TEXT NOT NULL,
    "description" TEXT,
    "targetInvestorProfile" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "invitedFirms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "syndicateMembers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "fromFirmId" TEXT NOT NULL,
    "toFirmId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NDA" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NDA_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Firm_email_key" ON "Firm"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_dealId_toFirmId_key" ON "Invitation"("dealId", "toFirmId");

-- CreateIndex
CREATE UNIQUE INDEX "NDA_dealId_firmId_key" ON "NDA"("dealId", "firmId");

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_fromFirmId_fkey" FOREIGN KEY ("fromFirmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_toFirmId_fkey" FOREIGN KEY ("toFirmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NDA" ADD CONSTRAINT "NDA_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NDA" ADD CONSTRAINT "NDA_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
