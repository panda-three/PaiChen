# 商品二级分类与默认微信名片上线 Runbook

## 上线边界

本次数据库迁移只增加分类父子关系、别名、约束和索引。页面装修 `draftJson`、`publishedJson` 不做批量改写；旧配置中的一级分类 ID 由兼容代码自动聚合其二级商品。默认名片二维码仍使用现有 `customer-assets` 桶，限制为 JPG/PNG/WebP、最大 5 MB。

## 固定上线顺序

1. 在发布环境执行 `npx prisma migrate status`，确认迁移历史无分叉。
2. 确认 `DIRECT_URL` 指向 PostgreSQL 5432 直连地址后执行 `npm run db:deploy`。
3. 部署兼容代码。此阶段允许存量商品暂时直挂原一级分类，但后台新建、编辑、批量分类和上架只接受有效二级分类。
4. 只读执行 [category-tree-dry-run.sql](../prisma/scripts/category-tree-dry-run.sql)，记录预计创建/复用“其他”的一级分类和直挂商品数。
5. 审核 dry-run 后，在受控 SQL 会话执行 [category-tree-backfill.sql](../prisma/scripts/category-tree-backfill.sql)。脚本自带事务且可幂等重跑。
6. 执行下方只读验收 SQL，并保存结果。
7. 使用真实店铺、真实 Storage 和 320/390/430px 浏览器完成 UI 验收。

## 回填后只读 SQL

```sql
-- 必须为 0：商品直挂一级
SELECT COUNT(*) FROM "Product" p JOIN "Category" c ON c."id" = p."categoryId" WHERE c."parentId" IS NULL;

-- 必须为 0：三级或跨店父子关系
SELECT COUNT(*) FROM "Category" c JOIN "Category" p ON p."id" = c."parentId"
WHERE p."parentId" IS NOT NULL OR p."storeId" <> c."storeId";

-- 必须为 0：已发布商品不属于有效二级分类
SELECT COUNT(*) FROM "Product" product
LEFT JOIN "Category" child ON child."id" = product."categoryId"
LEFT JOIN "Category" parent ON parent."id" = child."parentId"
WHERE product."isPublished" = TRUE AND product."isDeleted" = FALSE
  AND (child."id" IS NULL OR child."parentId" IS NULL OR child."isActive" = FALSE OR parent."isActive" = FALSE OR child."storeId" <> product."storeId" OR parent."storeId" <> product."storeId");
```

## 浏览器验收

- 320/390/430px：`/login`、`/me`、`/s/[slug]` 使用系统/苹方字体，无 Georgia 或宋体标题覆盖。
- 分类页左侧切换一级，右侧默认显示全部二级商品；选择二级后精确过滤；旧一级 `category` URL 仍聚合。
- 停用一级后整棵树和商品从商城隐藏，重新启用后恢复。
- 完整个人名片展示个人微信弹层；个人信息缺一项回退完整默认名片；默认名片不完整时隐藏微信按钮。
- 弹层可通过遮罩、关闭按钮、Esc 关闭，可复制微信号，可长按/保存二维码。
- 页面装修选一级后预览与发布页都聚合二级商品，选二级时精确展示；发布前后 JSON 结构未变化。
- 店铺管理员可上传、替换、删除默认二维码；其他角色请求 `/api/store/settings/assets` 返回 401。

## 生产禁令与证据边界

- 禁止在已有生产库执行 `prisma db push`、`npm run db:push`、`prisma db seed` 或 `npm run db:seed`。
- 不得用本地测试代替线上迁移、Supabase Storage 策略、真实上传删除和并发行为证据。
- 回填前必须保留数据库备份或平台时间点恢复能力；回填脚本不得在未审 dry-run 时执行。
