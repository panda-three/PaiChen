ALTER TABLE "Category" ADD COLUMN "alias" TEXT;
ALTER TABLE "Category" ADD COLUMN "parentId" TEXT;

ALTER TABLE "Category"
  ADD CONSTRAINT "Category_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "Category"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX IF EXISTS "Category_storeId_name_key";
CREATE UNIQUE INDEX "Category_root_name_key"
  ON "Category" ("storeId", "name") WHERE "parentId" IS NULL;
CREATE UNIQUE INDEX "Category_child_name_key"
  ON "Category" ("storeId", "parentId", "name") WHERE "parentId" IS NOT NULL;
CREATE INDEX "Category_storeId_parentId_sort_createdAt_idx"
  ON "Category" ("storeId", "parentId", "sort", "createdAt");
CREATE INDEX "Category_parentId_idx" ON "Category" ("parentId");
