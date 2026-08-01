BEGIN;

-- 幂等创建“其他”二级分类；原一级分类 ID 保持不变。
INSERT INTO "Category" ("id", "name", "alias", "sort", "isActive", "storeId", "parentId", "createdAt", "updatedAt")
SELECT 'cat_other_' || md5(parent."id"), '其他', NULL, 2147483647, parent."isActive", parent."storeId", parent."id", NOW(), NOW()
FROM "Category" parent
WHERE parent."parentId" IS NULL
  AND EXISTS (SELECT 1 FROM "Product" product WHERE product."categoryId" = parent."id")
  AND NOT EXISTS (SELECT 1 FROM "Category" child WHERE child."parentId" = parent."id" AND child."name" = '其他');

UPDATE "Product" product
SET "categoryId" = child."id", "updatedAt" = NOW()
FROM "Category" parent
JOIN "Category" child ON child."parentId" = parent."id" AND child."name" = '其他'
WHERE product."categoryId" = parent."id" AND parent."parentId" IS NULL;

COMMIT;
