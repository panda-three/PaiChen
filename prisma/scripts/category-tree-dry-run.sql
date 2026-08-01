SELECT parent."storeId", parent."id" AS "parentId", parent."name", COUNT(product."id") AS "directProducts",
       EXISTS (SELECT 1 FROM "Category" child WHERE child."parentId" = parent."id" AND child."name" = '其他') AS "reusesOther"
FROM "Category" parent
JOIN "Product" product ON product."categoryId" = parent."id"
WHERE parent."parentId" IS NULL
GROUP BY parent."storeId", parent."id", parent."name"
ORDER BY parent."storeId", parent."name";
