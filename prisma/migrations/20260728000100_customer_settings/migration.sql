ALTER TABLE "CustomerProfile"
ADD COLUMN "avatarUrl" TEXT,
ADD COLUMN "servicePhone" TEXT,
ADD COLUMN "serviceWechat" TEXT,
ADD COLUMN "serviceQrUrl" TEXT;

CREATE TABLE "CustomerSession" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "userAgent" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "CustomerSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomerSession_customerId_expiresAt_idx" ON "CustomerSession"("customerId", "expiresAt");
ALTER TABLE "CustomerSession" ADD CONSTRAINT "CustomerSession_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "User"
SET "customerStatus" = 'ACTIVE', "isActive" = true
WHERE "role" = 'CUSTOMER' AND "customerStatus" = 'PENDING';

UPDATE "CustomerProfile"
SET "status" = 'ACTIVE', "approvedAt" = COALESCE("approvedAt", CURRENT_TIMESTAMP)
WHERE "status" = 'PENDING';
