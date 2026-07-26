# Supabase 数据库与 Storage 部署说明

## 1. 文档目的

本项目最初只使用 Supabase PostgreSQL 数据库，商品图片采用外部 HTTP/HTTPS URL，因此部署时只需要配置数据库连接并执行 Prisma 迁移。

现在的 Excel 商品导入需要读取类似 `04欣雅图一件上传测试打样(1).xlsx` 中的内嵌图片。图片从 Excel 提取后必须保存到可长期访问的文件存储中，H5 商品页面才能继续展示。因此，本项目在 PostgreSQL 之外增加了 Supabase Storage。

这是一项上线前的一次性系统配置。配置完成后，店长日常操作仍然只是上传 `.xlsx` 文件，不需要接触数据库、Storage 或密钥。

## 2. PostgreSQL 与 Storage 的区别

Supabase 项目同时提供数据库和文件存储，但它们是两个不同的服务。

| 服务 | 保存内容 | 项目中的访问方式 |
| --- | --- | --- |
| PostgreSQL | 商品名称、型号、规格、价格、分类、图片 URL 等结构化数据 | Prisma、`DATABASE_URL`、`DIRECT_URL` |
| Supabase Storage | Excel 临时文件、从 Excel 提取的 PNG/JPEG/WebP 图片 | Supabase Storage API、`SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY` |

数据流如下：

```text
上传 Excel
├─ 商品文字、规格、价格 ──────────→ PostgreSQL
└─ Excel 内嵌图片 ─→ Storage ─→ 生成公开图片 URL
                                  ↓
                         PostgreSQL 保存图片 URL
```

`npm run db:deploy` 只能执行 PostgreSQL 表结构迁移，不能创建 Storage 桶，也不能上传文件。因此，图片导入需要额外配置 Storage。

## 3. 为什么需要两个新的环境变量

### `SUPABASE_URL`

Supabase 项目的 API 地址，例如：

```text
https://PROJECT_REF.supabase.co
```

服务端通过它定位当前项目的 Storage API。

### `SUPABASE_SERVICE_ROLE_KEY`

服务端使用的高权限密钥，用于：

- 创建仅允许当前店铺使用的临时上传地址；
- 下载并解析店长上传的 Excel；
- 上传从 Excel 中提取的商品图片；
- 导入完成或失败后删除临时 Excel；
- 商品写入失败时清理该商品已经上传的图片。

该密钥只能配置在 Next.js/Vercel 服务端，严禁：

- 写入源代码或提交到 Git；
- 放入浏览器代码；
- 使用 `NEXT_PUBLIC_` 前缀；
- 通过聊天、截图或前端日志传播。

浏览器拿到的只是一个短期、单文件、受当前店铺路径约束的签名上传地址，不会拿到 service role 密钥。

## 4. Storage 桶的用途

项目使用两个桶：

| 桶名称 | 可见性 | 用途 | 生命周期 |
| --- | --- | --- | --- |
| `product-imports` | 私有 | 临时保存上传的 `.xlsx` | 导入结束后立即删除 |
| `product-images` | 公开 | 长期保存商品主图、规格图和详情图 | 随商品业务长期保留 |

`product-imports` 建议额外配置一天后自动清理的生命周期规则，作为浏览器上传成功但未继续调用导入接口时的兜底措施。

## 5. 首次上线配置步骤

### 第一步：备份并确认目标数据库

确认本地 `.env` 中的 `DATABASE_URL` 和 `DIRECT_URL` 指向准备上线的 Supabase 项目。生产库执行迁移前应先备份。

不要在已有业务数据的生产库执行：

```bash
npm run db:seed
npm run db:push
```

`db:seed` 会重建演示数据，不适合生产环境。

### 第二步：执行数据库迁移

在项目根目录执行：

```bash
npm run db:deploy
```

图片导入对应的迁移为：

```text
prisma/migrations/20260726000200_product_image_import/migration.sql
```

该迁移只增加以下字段，不删除旧商品或旧订单数据：

- `Product.galleryImageUrls`
- `ProductVariant.imageUrl`
- `ProductVariant.specification`

### 第三步：创建 Storage 桶

在 Supabase 项目后台打开 SQL Editor，新建查询并执行：

[`../supabase/product-storage.sql`](../supabase/product-storage.sql)

执行完成后，在 Storage 页面确认存在：

- `product-imports`
- `product-images`

脚本使用 `on conflict` 更新配置，可以重复执行，不会删除桶内已有文件。

### 第四步：配置服务端环境变量

在 Supabase 项目后台的 Project Settings → API 中获取：

- Project URL；
- `service_role` secret key。

在本地 `.env` 中配置：

```dotenv
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=替换为真实的service-role密钥
```

在 Vercel 项目的 Settings → Environment Variables 中添加同名变量，至少应用到 Production 环境。

保存环境变量后需要重新部署 Vercel，运行中的旧实例不会自动获得新变量。

### 第五步：上线验收

使用店铺管理员账号进入：

```text
后台 → 商品管理 → Excel 导入
```

上传业务 Excel 后检查：

1. 成功/失败数量按“款”统计；
2. 商品默认是“未分类、未上架”；
3. 主图、附加主图、规格白底图和详情图映射正确；
4. 批量分配分类后商品仍然保持下架；
5. 手工确认商品资料后再逐个上架；
6. H5 可以切换主图和规格图，并显示详情图。

## 6. 日常导入流程

完成首次部署后，店长每次导入只需要：

```text
选择 .xlsx 文件
→ 上传
→ 系统读取文字与内嵌图片
→ 查看按款统计的导入结果
→ 前往商品管理批量分类
→ 核对后逐个上架
```

店长不需要重复执行数据库迁移、Storage SQL，也不需要接触任何 Supabase 密钥。

## 7. 安全与权限边界

- 上传接口必须要求已登录的店铺管理员身份；
- 临时文件路径必须属于当前店铺目录，不能读取其他店铺文件；
- Excel 临时桶保持私有，商品图片桶仅公开读取图片；
- service role 密钥只能存在于服务端环境变量；
- 数据库写入按单款商品保持事务原子性；
- 单款上传或数据库保存失败时，清理该款已上传图片；
- 无论导入成功还是失败，都尝试删除临时 Excel。

当前限制：

- Excel：仅 `.xlsx`，最大 20 MB；
- 单次最多 50 款商品、500 个规格；
- 图片：PNG、JPEG、WebP；
- 单张图片最大 5 MB。

## 8. 常见问题

### 已经执行 `npm run db:deploy`，为什么仍然无法上传？

数据库迁移只处理 PostgreSQL。还需要创建两个 Storage 桶，并配置 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY`。

### 为什么不把图片直接存进 PostgreSQL？

数据库适合结构化数据，不适合长期存放大量图片二进制。把图片放在 Storage、数据库只保存 URL，更适合网页访问、缓存、扩容和备份管理。

### 为什么浏览器不直接使用 service role 密钥？

service role 可以绕过大部分权限限制。一旦进入浏览器，任何访问者都可能提取它。正确方式是由服务端生成一次性的签名上传地址。

### 为什么 Excel 要先直传 Storage？

业务样表可能接近 10 MB。浏览器直传私有临时桶可以避免大文件经过 Vercel 请求体，同时服务端仍负责身份校验、路径限制、解析和最终清理。

### 旧的 URL 型 Excel 模板还能使用吗？

可以。系统保留 V2 和旧版 URL 模板兼容，但默认下载的是 A:P 图片业务模板。

## 9. 上线检查清单

- [ ] 已备份生产数据库
- [ ] `DATABASE_URL`、`DIRECT_URL` 指向正确项目
- [ ] 已执行 `npm run db:deploy`
- [ ] 已运行 `supabase/product-storage.sql`
- [ ] Storage 中存在两个目标桶
- [ ] Vercel 已配置 `SUPABASE_URL`
- [ ] Vercel 已配置 `SUPABASE_SERVICE_ROLE_KEY`
- [ ] service role 密钥没有 `NEXT_PUBLIC_` 前缀
- [ ] 已重新部署 Vercel
- [ ] 已使用真实业务 Excel 完成一次导入验收
- [ ] 已确认商品默认未分类、未上架
