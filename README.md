# 云丞 AI 商城平台第一阶段

基于 Next.js App Router、Tailwind CSS、Prisma 和 Supabase PostgreSQL 的多租户商城第一阶段，实现平台配额与代运营、企业商品授权、页面装修、客户审核与归属、多规格意向开单、经营分析及 Excel/图片导出。

## 环境变量

在 Supabase 项目的 **Connect** 页面复制两个连接地址：

- `DATABASE_URL`：Transaction pooler，端口 `6543`，供 Vercel 运行时使用；追加 `pgbouncer=true&connection_limit=1`。
- `DIRECT_URL`：Session pooler，端口 `5432`，供 Prisma 建表使用。也可使用 Direct connection，但本地网络必须支持 IPv6。
- `SUPABASE_URL`：Supabase 项目 URL，供服务端 Storage 客户端使用。
- `SUPABASE_SERVICE_ROLE_KEY`：仅服务端使用的 service role 密钥，不得使用 `NEXT_PUBLIC_` 前缀或传入浏览器。
- `DEFAULT_PUBLIC_STORE_SLUG`：根路径 `/` 展示的默认店铺 slug。
- `PREVIEW_STORE_SLUG`：Vercel Preview 唯一允许访问和写入的测试店铺 slug。

本地复制 `.env.example` 为 `.env`，填入真实地址，并生成认证密钥：

```bash
openssl rand -base64 32
```

将生成结果写入 `AUTH_SECRET`，并为 `SEED_PASSWORD` 设置至少 12 位的演示账号密码。数据库密码包含特殊字符时，请直接使用 Supabase 提供的连接串或进行 URL 编码。不要提交 `.env`。

## 初始化

```bash
npm install
npm run db:deploy
npm run db:seed
npm run dev
```

在 Supabase SQL Editor 执行 [`supabase/product-storage.sql`](supabase/product-storage.sql)，创建私有临时 Excel 桶 `product-imports` 和公开商品图片桶 `product-images`。建议再为 `product-imports` 配置一天后清理的生命周期规则，兜底清除上传成功但尚未发起导入的文件。

已有 MVP 生产库不要再执行 `db push`。首次切换迁移管理时，先备份并在脱敏副本演练，然后登记现有结构 baseline，再执行只增不删的第一阶段迁移：

```bash
npx prisma migrate resolve --applied 20260724000100_baseline
npm run db:deploy
```

全新数据库直接运行 `npm run db:deploy`，会依次建立 baseline 和第一阶段扩展结构。扩展迁移会为旧商品回填默认规格，并为旧店铺生成与原 H5 主链路等效的已发布主页。上线前后应核对各业务表数量、订单商品快照、账号登录及原 `/s/:slug` URL；迁移不删除旧字段。

打开：

- 客户注册/登录：<http://localhost:3000/login>
- 后台登录：<http://localhost:3000/admin/login>
- 默认 H5：<http://localhost:3000/>
- 员工分享 H5：<http://localhost:3000/s/liangchen?ref=staff-ruan>

公开路由包括 `/s/:slug` 首页、`category`、`search`、`product/:id`、`cart`、`ai`，以及 `/login` 客户注册登录页和 `/me?store=:slug` 客户中心。后台统一从 `/admin/login` 登录；客户与后台会话相互独立。购物车只保存在浏览器本地并按店铺隔离；提交的是购买意向，不会在线支付或扣减库存。

## 演示账号

所有账号使用本地 `SEED_PASSWORD` 中设置的密码。

| 角色 | 账号 |
| --- | --- |
| 平台管理员 | `platform_admin` |
| 企业管理员 | `enterprise_admin` |
| 良丞店铺管理员 | `store_a_admin` |
| 云栖店铺管理员 | `store_b_admin` |
| 良丞员工 | `employee_a`、`employee_a2` |
| 云栖员工 | `employee_b` |

种子数据包含两家店铺及同店多名员工，用于验证跨店铺与员工数据隔离。

种子脚本会先清空相关表再写入演示数据，只能用于全新或可重置的数据库。首次初始化后请从本地 `.env` 删除 `SEED_PASSWORD`。

## 常用命令

```bash
npm run test       # 单元测试
npx tsc --noEmit   # 类型检查
npm run build      # 生产构建
npm run db:seed    # 重置本地演示数据
```

## Vercel 部署

在 Vercel 项目的 Production 环境添加以下变量：

- `DATABASE_URL`：Supabase Transaction pooler 地址
- `DIRECT_URL`：Supabase Session pooler 地址
- `AUTH_SECRET`：使用 `openssl rand -base64 32` 生成
- `AUTH_TRUST_HOST`：`true`
- `CRON_SECRET`：用于每日经营汇总与 365 天原始行为清理的随机密钥
- `SUPABASE_URL`：Supabase 项目 URL
- `SUPABASE_SERVICE_ROLE_KEY`：仅配置在服务端的 service role 密钥
- `DEFAULT_PUBLIC_STORE_SLUG`：Production 默认公开店铺
- `PREVIEW_STORE_SLUG`：Preview 测试店铺（Production 可不配置）

不要将 `SEED_PASSWORD` 配置到 Vercel，也不要把 `prisma db push` 或 `db:seed` 放入 Vercel Build Command。项目保持默认的 `npm run build`。

Preview 必须使用与 Production 不同的 `AUTH_SECRET`，并在 Vercel Dashboard 开启 Deployment Protection。验收时确认测试店铺可访问、其他店铺公开页返回 404、其他店铺写入返回 403，平台/企业/其他店铺后台会话不能进入 Preview 前台。

首次部署前，在可信任的本地终端使用相同的 `DIRECT_URL` 执行迁移。已有 MVP 库先按上文登记 baseline；全新库直接部署全部迁移：

```bash
npm run db:deploy
```

`db:seed` 只用于全新演示库，会清空并重建演示数据，绝不能在已有业务数据的生产库运行。

### Supabase 访问保护

本项目通过 Next.js 服务端的 Prisma 访问数据库；商品图片导入额外通过服务端 service role 访问 Storage，不需要 anon key。初始化后可在 Supabase SQL Editor 执行以下语句，阻止浏览器端角色直接访问这些表：

```sql
alter table public."Store" enable row level security;
alter table public."User" enable row level security;
alter table public."Category" enable row level security;
alter table public."Product" enable row level security;
alter table public."Lead" enable row level security;
alter table public."Order" enable row level security;
alter table public."OrderItem" enable row level security;
alter table public."OrderNote" enable row level security;
alter table public."AuditLog" enable row level security;
alter table public."Enterprise" enable row level security;
alter table public."EnterpriseSeries" enable row level security;
alter table public."EnterpriseProduct" enable row level security;
alter table public."EnterpriseVariant" enable row level security;
alter table public."ProductVariant" enable row level security;
alter table public."ProductAuthorization" enable row level security;
alter table public."ProductSyncLog" enable row level security;
alter table public."StorePage" enable row level security;
alter table public."PageTemplate" enable row level security;
alter table public."CustomerProfile" enable row level security;
alter table public."CustomerAttribution" enable row level security;
alter table public."OrderChange" enable row level security;
alter table public."Favorite" enable row level security;
alter table public."BehaviorEvent" enable row level security;
alter table public."DailyMetric" enable row level security;

revoke all privileges on all tables in schema public from anon, authenticated;
revoke all privileges on all sequences in schema public from anon, authenticated;

alter default privileges for role postgres in schema public
revoke all on tables from anon, authenticated;
```

无需创建 RLS Policy；Prisma 使用数据库连接串在服务端访问数据。

## 第一阶段边界

- 手工商品仍使用外部 HTTP/HTTPS 图片 URL；A:P Excel 批量导入支持 WPS `DISPIMG` 和标准 Excel 锚点图片，并存入 Supabase Storage。
- 默认下载 A:P 图片模板，同时兼容 V2 多规格 URL 模板和旧模板；图片批量导入商品默认未分类、未上架。
- 本轮只交付响应式 H5 与 PC 后台；不包含微信小程序、AI、在线支付、真实库存扣减、物流、退款及营销交易能力。
