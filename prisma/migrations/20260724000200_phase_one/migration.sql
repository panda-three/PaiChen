-- CreateEnum
CREATE TYPE "ProductSource" AS ENUM ('MANUAL', 'EXCEL', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "AuthorizationStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED', 'RESET_PENDING');

-- CreateEnum
CREATE TYPE "BehaviorType" AS ENUM ('PAGE_VIEW', 'PRODUCT_VIEW', 'FAVORITE', 'CART_ADD', 'ORDER_SUBMIT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'ENTERPRISE_ADMIN';
ALTER TYPE "Role" ADD VALUE 'CUSTOMER';

-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_categoryId_fkey";

-- DropIndex
DROP INDEX "Product_storeId_isPublished_sort_idx";

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "adminLimit" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "analyticsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "authorizationEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "customerEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "defaultCardJson" TEXT NOT NULL DEFAULT '{}',
ADD COLUMN     "employeeLimit" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "pageEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "customerStatus" "CustomerStatus",
ADD COLUMN     "enterpriseId" TEXT,
ADD COLUMN     "pendingPasswordHash" TEXT,
ADD COLUMN     "resetCode" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "authorizationId" TEXT,
ADD COLUMN     "enterpriseProductId" TEXT,
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "referenceStock" INTEGER,
ADD COLUMN     "source" "ProductSource" NOT NULL DEFAULT 'MANUAL',
ALTER COLUMN "categoryId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "customerId" TEXT,
ADD COLUMN     "responsibleEmployeeId" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "remark" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "variantCode" TEXT,
ADD COLUMN     "variantId" TEXT;

-- CreateTable
CREATE TABLE "Enterprise" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Enterprise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "price" DECIMAL(65,30),
    "referenceStock" INTEGER,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "enterpriseVariantId" TEXT,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnterpriseSeries" (
    "id" TEXT NOT NULL,
    "enterpriseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnterpriseSeries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnterpriseProduct" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "mainImageUrl" TEXT NOT NULL,
    "detailImageUrls" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "unit" TEXT NOT NULL DEFAULT '件',
    "suggestedPrice" DECIMAL(65,30),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnterpriseProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnterpriseVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "suggestedPrice" DECIMAL(65,30),

    CONSTRAINT "EnterpriseVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAuthorization" (
    "id" TEXT NOT NULL,
    "enterpriseId" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "status" "AuthorizationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSyncLog" (
    "id" TEXT NOT NULL,
    "authorizationId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detailJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorePage" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT '首页',
    "draftJson" TEXT NOT NULL,
    "publishedJson" TEXT,
    "isHome" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorePage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "isFree" BOOLEAN NOT NULL DEFAULT true,
    "configJson" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerProfile" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "status" "CustomerStatus" NOT NULL DEFAULT 'PENDING',
    "sourceEmployeeId" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerAttribution" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "employeeId" TEXT,
    "reason" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerAttribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderChange" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "beforeValue" TEXT,
    "afterValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BehaviorEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" "BehaviorType" NOT NULL,
    "storeId" TEXT NOT NULL,
    "customerId" TEXT,
    "productId" TEXT,
    "pageSlug" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BehaviorEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Enterprise_code_key" ON "Enterprise"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_productId_code_key" ON "ProductVariant"("productId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "EnterpriseSeries_enterpriseId_name_key" ON "EnterpriseSeries"("enterpriseId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "EnterpriseProduct_seriesId_code_key" ON "EnterpriseProduct"("seriesId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "EnterpriseVariant_productId_code_key" ON "EnterpriseVariant"("productId", "code");

-- CreateIndex
CREATE INDEX "ProductAuthorization_storeId_status_idx" ON "ProductAuthorization"("storeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAuthorization_seriesId_storeId_key" ON "ProductAuthorization"("seriesId", "storeId");

-- CreateIndex
CREATE INDEX "StorePage_storeId_isHome_idx" ON "StorePage"("storeId", "isHome");

-- CreateIndex
CREATE UNIQUE INDEX "StorePage_storeId_slug_key" ON "StorePage"("storeId", "slug");

-- CreateIndex
CREATE INDEX "CustomerProfile_storeId_status_idx" ON "CustomerProfile"("storeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerProfile_storeId_customerId_key" ON "CustomerProfile"("storeId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerProfile_storeId_phone_key" ON "CustomerProfile"("storeId", "phone");

-- CreateIndex
CREATE INDEX "CustomerAttribution_storeId_customerId_isCurrent_idx" ON "CustomerAttribution"("storeId", "customerId", "isCurrent");

-- CreateIndex
CREATE INDEX "OrderChange_orderId_createdAt_idx" ON "OrderChange"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "Favorite_storeId_createdAt_idx" ON "Favorite"("storeId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_customerId_productId_key" ON "Favorite"("customerId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "BehaviorEvent_dedupeKey_key" ON "BehaviorEvent"("dedupeKey");

-- CreateIndex
CREATE INDEX "BehaviorEvent_storeId_type_createdAt_idx" ON "BehaviorEvent"("storeId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "BehaviorEvent_customerId_createdAt_idx" ON "BehaviorEvent"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "User_enterpriseId_role_idx" ON "User"("enterpriseId", "role");

-- CreateIndex
CREATE INDEX "Product_storeId_isPublished_isDeleted_sort_idx" ON "Product"("storeId", "isPublished", "isDeleted", "sort");

-- CreateIndex
CREATE INDEX "Order_responsibleEmployeeId_createdAt_idx" ON "Order"("responsibleEmployeeId", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_enterpriseId_fkey" FOREIGN KEY ("enterpriseId") REFERENCES "Enterprise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_authorizationId_fkey" FOREIGN KEY ("authorizationId") REFERENCES "ProductAuthorization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_enterpriseProductId_fkey" FOREIGN KEY ("enterpriseProductId") REFERENCES "EnterpriseProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_enterpriseVariantId_fkey" FOREIGN KEY ("enterpriseVariantId") REFERENCES "EnterpriseVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseSeries" ADD CONSTRAINT "EnterpriseSeries_enterpriseId_fkey" FOREIGN KEY ("enterpriseId") REFERENCES "Enterprise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseProduct" ADD CONSTRAINT "EnterpriseProduct_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "EnterpriseSeries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseVariant" ADD CONSTRAINT "EnterpriseVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "EnterpriseProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAuthorization" ADD CONSTRAINT "ProductAuthorization_enterpriseId_fkey" FOREIGN KEY ("enterpriseId") REFERENCES "Enterprise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAuthorization" ADD CONSTRAINT "ProductAuthorization_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "EnterpriseSeries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAuthorization" ADD CONSTRAINT "ProductAuthorization_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSyncLog" ADD CONSTRAINT "ProductSyncLog_authorizationId_fkey" FOREIGN KEY ("authorizationId") REFERENCES "ProductAuthorization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorePage" ADD CONSTRAINT "StorePage_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerProfile" ADD CONSTRAINT "CustomerProfile_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerProfile" ADD CONSTRAINT "CustomerProfile_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerProfile" ADD CONSTRAINT "CustomerProfile_sourceEmployeeId_fkey" FOREIGN KEY ("sourceEmployeeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerProfile" ADD CONSTRAINT "CustomerProfile_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAttribution" ADD CONSTRAINT "CustomerAttribution_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAttribution" ADD CONSTRAINT "CustomerAttribution_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAttribution" ADD CONSTRAINT "CustomerAttribution_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_responsibleEmployeeId_fkey" FOREIGN KEY ("responsibleEmployeeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderChange" ADD CONSTRAINT "OrderChange_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderChange" ADD CONSTRAINT "OrderChange_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BehaviorEvent" ADD CONSTRAINT "BehaviorEvent_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BehaviorEvent" ADD CONSTRAINT "BehaviorEvent_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BehaviorEvent" ADD CONSTRAINT "BehaviorEvent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill one default variant for every existing MVP product. Product and order
-- snapshots remain untouched; the new variant is only used by future orders.
INSERT INTO "ProductVariant" ("id", "productId", "name", "code", "price", "sort")
SELECT 'pv_' || md5(random()::text || clock_timestamp()::text || p."id"),
       p."id", p."specification", p."code" || '-DEFAULT', p."price", 0
FROM "Product" p
WHERE NOT EXISTS (SELECT 1 FROM "ProductVariant" v WHERE v."productId" = p."id");

-- Preserve the former fixed H5 as each store's initially published home page.
INSERT INTO "StorePage" ("id", "storeId", "title", "slug", "draftJson", "publishedJson", "isHome", "publishedAt", "createdAt", "updatedAt")
SELECT 'page_' || md5(random()::text || clock_timestamp()::text || s."id"),
       s."id", '店铺首页', 'home', config.value, config.value, true,
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Store" s
CROSS JOIN LATERAL (
  SELECT jsonb_build_object(
    'version', 1,
    'components', jsonb_build_array(
      jsonb_build_object('id', 'welcome', 'type', 'text', 'title', s."name", 'body', '家居美学 · 一站式开单'),
      jsonb_build_object('id', 'search', 'type', 'productSearch', 'placeholder', '搜索商品'),
      jsonb_build_object('id', 'products', 'type', 'products', 'title', '精选商品', 'productIds', COALESCE((SELECT jsonb_agg(p."id") FROM "Product" p WHERE p."storeId" = s."id"), '[]'::jsonb))
    )
  )::text AS value
) config
WHERE NOT EXISTS (SELECT 1 FROM "StorePage" page WHERE page."storeId" = s."id" AND page."isHome" = true);

CREATE UNIQUE INDEX "StorePage_one_home_per_store" ON "StorePage" ("storeId") WHERE "isHome" = true;

CREATE TABLE "DailyMetric" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "visitors" INTEGER NOT NULL DEFAULT 0,
    "productViews" INTEGER NOT NULL DEFAULT 0,
    "favorites" INTEGER NOT NULL DEFAULT 0,
    "cartAdds" INTEGER NOT NULL DEFAULT 0,
    "orderSubmits" INTEGER NOT NULL DEFAULT 0,
    "intentCustomers" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DailyMetric_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DailyMetric_storeId_date_key" ON "DailyMetric"("storeId", "date");
ALTER TABLE "DailyMetric" ADD CONSTRAINT "DailyMetric_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
