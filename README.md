# 云丞 AI 商城平台 MVP

基于 Next.js App Router、Tailwind CSS、Prisma 和 Supabase PostgreSQL 的全栈 MVP，实现平台建店、门店商品管理、员工分享、H5 开单、客户线索、订单处理及 Excel/图片导出。

## 环境变量

在 Supabase 项目的 **Connect** 页面复制两个连接地址：

- `DATABASE_URL`：Transaction pooler，端口 `6543`，供 Vercel 运行时使用；追加 `pgbouncer=true&connection_limit=1`。
- `DIRECT_URL`：Direct connection，端口 `5432`，供 Prisma 建表使用。

本地复制 `.env.example` 为 `.env`，填入真实地址，并生成认证密钥：

```bash
openssl rand -base64 32
```

将生成结果写入 `AUTH_SECRET`。不要提交 `.env`。

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

所有账号密码均为 `Demo123!`。

| 角色 | 账号 |
| --- | --- |
| 平台管理员 | `platform_admin` |
| 良丞店铺管理员 | `store_a_admin` |
| 云栖店铺管理员 | `store_b_admin` |
| 良丞员工 | `employee_a`、`employee_a2` |
| 云栖员工 | `employee_b` |

种子数据包含两家店铺及同店多名员工，用于验证跨店铺与员工数据隔离。

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
- `DIRECT_URL`：Supabase Direct connection 地址
- `AUTH_SECRET`：使用 `openssl rand -base64 32` 生成
- `AUTH_TRUST_HOST`：`true`

首次部署前，在可信任的本地终端使用相同的 `DIRECT_URL` 执行：

```bash
npx prisma db push
npm run db:seed
```

种子脚本会清空并重建演示数据，不要在已有业务数据的生产库重复运行。

## MVP 边界

- 图片当前使用外部 HTTP/HTTPS URL；如需自行上传图片，再接入 Supabase Storage。
- Excel 仅支持系统提供的 `.xlsx` 模板，导入商品默认下架。
- 不包含小程序、页面装修、企业/工厂账号、在线支付、库存、物流、客户账号和 AI 能力。
