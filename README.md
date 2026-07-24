# 云丞 AI 商城平台 MVP

基于 Next.js App Router、Tailwind CSS、Prisma 和 Supabase PostgreSQL 的全栈 MVP，实现平台建店、门店商品管理、员工分享、H5 开单、客户线索、订单处理及 Excel/图片导出。

## 环境变量

在 Supabase 项目的 **Connect** 页面复制两个连接地址：

- `DATABASE_URL`：Transaction pooler，端口 `6543`，供 Vercel 运行时使用；追加 `pgbouncer=true&connection_limit=1`。
- `DIRECT_URL`：Session pooler，端口 `5432`，供 Prisma 建表使用。也可使用 Direct connection，但本地网络必须支持 IPv6。

本地复制 `.env.example` 为 `.env`，填入真实地址，并生成认证密钥：

```bash
openssl rand -base64 32
```

将生成结果写入 `AUTH_SECRET`，并为 `SEED_PASSWORD` 设置至少 12 位的演示账号密码。数据库密码包含特殊字符时，请直接使用 Supabase 提供的连接串或进行 URL 编码。不要提交 `.env`。

## 初始化

```bash
npm install
npx prisma db push
npm run db:seed
npm run dev
```

打开：

- 后台登录：<http://localhost:3000/login>
- H5 示例：<http://localhost:3000/s/liangchen?ref=staff-ruan>

## 演示账号

所有账号使用本地 `SEED_PASSWORD` 中设置的密码。

| 角色 | 账号 |
| --- | --- |
| 平台管理员 | `platform_admin` |
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

不要将 `SEED_PASSWORD` 配置到 Vercel，也不要把 `prisma db push` 或 `db:seed` 放入 Vercel Build Command。项目保持默认的 `npm run build`。

首次部署前，在可信任的本地终端使用相同的 `DIRECT_URL` 执行：

```bash
npx prisma db push
npm run db:seed
```

种子脚本会清空并重建演示数据，不要在已有业务数据的生产库重复运行。

### Supabase 访问保护

本项目通过 Next.js 服务端的 Prisma 访问数据库，不需要 Supabase anon key 或 service-role key。初始化后可在 Supabase SQL Editor 执行以下语句，阻止浏览器端角色直接访问这些表：

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

revoke all privileges on all tables in schema public from anon, authenticated;
revoke all privileges on all sequences in schema public from anon, authenticated;

alter default privileges for role postgres in schema public
revoke all on tables from anon, authenticated;
```

无需创建 RLS Policy；Prisma 使用数据库连接串在服务端访问数据。

## MVP 边界

- 图片当前使用外部 HTTP/HTTPS URL；如需自行上传图片，再接入 Supabase Storage。
- Excel 仅支持系统提供的 `.xlsx` 模板，导入商品默认下架。
- 不包含小程序、页面装修、企业/工厂账号、在线支付、库存、物流、客户账号和 AI 能力。
