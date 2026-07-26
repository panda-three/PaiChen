ALTER TABLE "Product"
ADD COLUMN "galleryImageUrls" TEXT NOT NULL DEFAULT '';

ALTER TABLE "ProductVariant"
ADD COLUMN "imageUrl" TEXT,
ADD COLUMN "specification" TEXT;
