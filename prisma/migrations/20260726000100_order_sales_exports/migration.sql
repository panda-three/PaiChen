-- Add formal sales document fields while preserving the original catalog price snapshot.
ALTER TABLE "Order"
ADD COLUMN "shippingFee" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN "installationFee" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN "soldAt" TIMESTAMP(3);

ALTER TABLE "OrderItem"
ADD COLUMN "salePrice" DECIMAL(65,30),
ADD COLUMN "color" TEXT NOT NULL DEFAULT '';

UPDATE "OrderItem" SET "salePrice" = "price";
UPDATE "Order" SET "soldAt" = "updatedAt" WHERE "status" = 'WON';
