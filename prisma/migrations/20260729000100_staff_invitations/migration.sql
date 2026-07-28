CREATE TABLE "StaffInvitation" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "role" "Role" NOT NULL,
  "inviteePhone" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StaffInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffInvitation_tokenHash_key" ON "StaffInvitation"("tokenHash");
CREATE INDEX "StaffInvitation_storeId_role_createdAt_idx" ON "StaffInvitation"("storeId", "role", "createdAt");
CREATE INDEX "StaffInvitation_createdById_createdAt_idx" ON "StaffInvitation"("createdById", "createdAt");
ALTER TABLE "StaffInvitation" ADD CONSTRAINT "StaffInvitation_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffInvitation" ADD CONSTRAINT "StaffInvitation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
