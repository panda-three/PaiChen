ALTER TABLE "User" ADD COLUMN "wechatQrUrl" TEXT;
ALTER TABLE "Order" ADD COLUMN "appSubmitterId" TEXT;

-- Customer orders were already bound to the signed-in APP customer.
UPDATE "Order"
SET "appSubmitterId" = "customerId"
WHERE "customerId" IS NOT NULL;

-- An employee is backfilled only when the matching APP submission event proves
-- that the order came through /api/public/orders. Admin and quick orders remain null.
UPDATE "Order" AS o
SET "appSubmitterId" = o."sourceEmployeeId"
WHERE o."appSubmitterId" IS NULL
  AND o."sourceEmployeeId" IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM "BehaviorEvent" AS e
    WHERE e."storeId" = o."storeId"
      AND e."sessionId" = o."idempotencyKey"
      AND e."type" = 'ORDER_SUBMIT'
  );

CREATE INDEX "Order_appSubmitterId_createdAt_idx" ON "Order"("appSubmitterId", "createdAt");
ALTER TABLE "Order" ADD CONSTRAINT "Order_appSubmitterId_fkey" FOREIGN KEY ("appSubmitterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
