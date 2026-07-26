# 前台接入与 Vercel 部署方案

## 1. 已确认决策

| 项目 | 决策 |
| --- | --- |
| 代码组织 | 一个仓库、一个 Next.js 应用 |
| Vercel | 一个 Vercel Pro 项目 |
| 数据库 | 一个 Supabase PostgreSQL 数据库 |
| 域名 | 前台使用主域名，后台保留 `/admin` |
| 发布方式 | 合并 `main` 后由 Vercel 自动发布 |
| Preview | 复用生产数据库，但限制为专用测试店铺 |
| Function 区域 | `hnd1`（东京），与当前 Supabase `ap-northeast-1` 匹配 |
| Node.js | 固定为 Node.js 22 |

本阶段不拆分独立前端工程，也不在接入前台时重构现有后台。这样可以继续共享 Prisma、Auth.js、角色权限和发布流程，避免额外建设跨域、双项目配置和独立数据接口。

## 2. 推荐项目结构

```text
app/
  (public)/               # 新前台页面，路由组名称不会出现在 URL 中
  admin/                  # 保持现有后台结构
  api/                    # Route Handler adapters
  login/ customer/ me/    # 保持现有认证入口

components/
  public/                 # 前台专用 UI
  admin/                  # 后台专用 UI
  shared/                 # 确实被前后台共同使用的 UI

modules/
  identity/               # 登录、角色、账号状态和租户校验
  catalog/                # 已发布商品和分类查询
  customer/               # 客户注册、审核和归属
  order/                  # 订单校验和幂等创建
  deployment-scope/       # Preview 测试店铺限制

lib/
  db.ts                   # 唯一 Prisma Client
  env.ts                  # 服务端环境变量校验
  product-storage.ts      # Supabase Storage adapter
```

### 2.1 代码组织原则

- 前台模块到达后放入 `app/(public)`，不移动无关后台文件。
- Prisma 只在服务端 Module 内使用，不允许浏览器代码直接连接数据库。
- Server Component 直接调用服务端 Module；浏览器交互通过 Route Handler 或 Server Action adapter。
- 业务校验、角色权限、店铺范围和幂等规则必须在服务端执行，不能只依赖前端隐藏按钮。
- 当前只有一个数据库 adapter，不增加暂时没有实际变化需求的 Repository Interface。
- 前台使用独立 layout、设计变量和作用域样式，避免全局 CSS 污染现有后台。
- 只有确实被两端复用的 UI 才放入 `components/shared`，不要提前抽象。

## 3. Preview 单库保护

Preview 和 Production 共用数据库存在真实数据污染风险，因此必须建立应用层隔离。

### 3.1 测试店铺

- 在生产库中创建专用测试店铺，默认 slug 为 `preview-qa`。
- Preview 环境配置 `PREVIEW_STORE_SLUG=preview-qa`。
- 测试管理员、员工、商品、客户和订单全部归属该店铺。
- 不得在 Preview 使用生产店铺账号、平台管理员或企业管理员。

### 3.2 服务端限制

新增 `deployment-scope` Module，并在身份验证、公开店铺查询和所有写入入口统一执行以下规则：

- `VERCEL_ENV=preview` 时，只允许访问 `PREVIEW_STORE_SLUG` 对应的店铺。
- 其他店铺公开页面返回 404，写入请求返回 403。
- Preview 拒绝平台管理员、企业管理员和其他店铺账号登录。
- 客户账号必须存在测试店铺的有效客户档案。
- Preview 禁止运行数据库迁移、生产 seed 和定时任务。

Vercel 同时开启 Deployment Protection，只允许团队成员访问 Preview。Preview 使用独立的 `AUTH_SECRET`，避免与生产登录会话混用。

这套措施可以降低风险，但不能完全消除错误代码影响生产库的可能性。该残余风险是“Preview 复用生产数据库”方案的已知取舍。

## 4. 文件与图片存储

Vercel Function 的文件系统只读，只有 `/tmp` 可临时写入，且不能作为持久存储。因此：

- `product-imports` bucket 设为私有，用于暂存 Excel 导入文件。
- `product-images` bucket 可公开读取，但上传和删除只能由服务端 Service Role 执行。
- 大文件由浏览器通过服务端签发的地址直接上传 Supabase Storage。
- `SUPABASE_SERVICE_ROLE_KEY` 只能出现在服务端环境变量中，不能使用 `NEXT_PUBLIC_` 前缀，也不能返回给浏览器。
- 临时 Excel 在处理完成后删除；商品图片只有在数据库写入失败时清理本次已上传文件。

Vercel Function 的请求和响应体上限为 4.5 MB。现有 `serverActions.bodySizeLimit: "5mb"` 不能突破平台限制。20 MB Excel 必须使用签名直传；超过 4.5 MB 的导出文件应先写入 Storage，再返回短期下载地址。

## 5. Vercel 项目配置

### 5.1 构建配置

- Vercel 套餐：Pro。
- Production Branch：`main`。
- Framework Preset：Next.js。
- Install Command：`npm ci`。
- Build Command：`npm run build`。
- Output Directory：保持默认。
- Function Region：`hnd1`。
- Node.js：在 `package.json` 和 Vercel Dashboard 中同时固定为 `22.x`。

`package.json` 应包含：

```json
{
  "engines": {
    "node": "22.x"
  }
}
```

构建继续执行 `prisma generate && next build`。不得把 `prisma db push`、`prisma migrate deploy` 或 `db:seed` 放入 Vercel Build Command。

### 5.2 环境变量

Production：

| 变量 | 用途 |
| --- | --- |
| `DATABASE_URL` | Supabase Transaction Pooler `6543`，供 Vercel 运行时使用 |
| `DIRECT_URL` | Supabase Session Pooler `5432`，供受控迁移使用 |
| `AUTH_SECRET` | Auth.js 生产密钥 |
| `AUTH_TRUST_HOST` | 设置为 `true` |
| `CRON_SECRET` | Vercel Cron Bearer 密钥 |
| `SUPABASE_URL` | Supabase 项目地址 |
| `SUPABASE_SERVICE_ROLE_KEY` | 服务端 Storage 管理密钥 |

Preview：

- 使用相同的数据库和 Storage 连接。
- 使用独立的 `AUTH_SECRET`。
- 增加 `PREVIEW_STORE_SLUG=preview-qa`。
- 不配置或不使用 Preview Cron。

同步更新 `.env.example`，只记录变量名称和示例格式，不写入任何真实密钥。`.env`、导入样例和业务数据文件不得提交到 Git。

### 5.3 域名

- 主域名指向同一个 Vercel 项目。
- 前台入口为 `https://<domain>/`。
- 后台入口为 `https://<domain>/admin`。
- 登录入口继续使用 `https://<domain>/login`。
- `www` 域名统一 301 重定向到主域名。
- 前后台与 Route Handler 保持同源，不新增 CORS 配置。

## 6. 数据库迁移与发布流程

### 6.1 PR 验证

每个 PR 必须依次通过：

```bash
npm ci
npm test
npm run lint
npx tsc --noEmit
npm run build
```

GitHub 将这些检查设为 `main` 的 Required Checks。Vercel Preview 只使用测试店铺验收，不执行迁移。

### 6.2 含数据库变更的发布

1. 为 Prisma schema 变更生成 migration。
2. migration 必须向后兼容，只增不删，确保旧版本应用仍可运行。
3. 备份生产数据库并检查 migration SQL。
4. 在可信终端使用生产 `DIRECT_URL` 执行 `npm run db:deploy`。
5. 迁移成功后合并 `main`。
6. Vercel 自动构建并发布生产版本。
7. 完成前台、后台和数据链路冒烟测试。

应用发布失败时使用 Vercel 回滚到上一部署。数据库不会自动回滚，因此不能依赖破坏性 migration，也不能把回滚建立在删除生产字段之上。

### 6.3 禁止事项

- 禁止在生产库执行 `db:seed`，现有 seed 会清理业务数据。
- 禁止使用 `db:push` 管理已有生产库。
- 禁止从 Preview 或 Vercel Build 自动执行 migration。
- 禁止遗漏 migration 文件、Prisma schema 或 `package-lock.json` 后直接发布。
- 禁止把本地 Word、Excel 验收文件提交到生产部署分支，除非它们明确属于项目资产。

## 7. Cron 与运行时限制

当前 Cron 配置为：

```json
{
  "path": "/api/maintenance/daily",
  "schedule": "15 1 * * *"
}
```

Vercel Cron 使用 UTC，因此它会在北京时间每天 09:15 触发。生产要求：

- 保留 `Authorization: Bearer <CRON_SECRET>` 校验。
- 汇总操作保持幂等，同一天重复执行不能生成重复数据。
- 输出结构化的开始、完成和失败日志。
- 配置失败告警；Vercel Cron 调用失败后不会自动重试。
- 数据量增大后采用按店铺或时间区间分批处理，避免 Function 超时和内存峰值。

Excel、图片导出和批量导入还需要关注：

- Vercel Function 请求和响应体上限 4.5 MB。
- Function bundle 解压后存在平台大小限制，避免无关大型依赖进入路由。
- ExcelJS、JSZip 和图片处理会占用较多内存，必须使用真实业务最大文件做压测。
- 超过 Function 时长或响应大小的任务应改为“生成到 Storage，再返回下载地址”。

## 8. 上线验收标准

### 8.1 自动检查

- 所有测试通过。
- ESLint 无错误。
- TypeScript 类型检查通过。
- `npm run build` 通过。
- Prisma Client 在构建阶段成功生成。
- Git 工作区中的部署文件、migration 和锁文件形成一致提交。

### 8.2 Preview 验收

- Preview 只能登录测试店铺账号。
- 访问其他店铺返回 404 或 403。
- 测试注册、收藏、下单、导入只写入测试店铺。
- 平台管理员和企业管理员无法在 Preview 操作。
- 浏览器代码和响应中不出现 Service Role Key。

### 8.3 Production 冒烟测试

- 主域名前台可访问，静态资源正常加载。
- `/admin` 未登录时跳转登录，角色权限正确。
- 客户注册、审核、登录、收藏和下单链路正常。
- 商品上下架后前台展示及时更新。
- Excel 签名直传、图片上传和失败清理正常。
- 订单 Excel/图片导出正常。
- 未带密钥调用 Cron 返回 401，合法调用成功完成。

## 9. 当前上线阻塞项

截至 2026-07-26 的最新只读检查结果：

- `npx tsc --noEmit`：通过。
- `npm run lint`：通过。
- `npm run build`：通过，公开前台与后台路由均成功生成。
- `npm test`：38 个测试全部通过。
- `npm run lint` 与 `npx tsc --noEmit`：通过。

本地 HTTP 冒烟已覆盖根路径跳转、首页、分类、搜索、商品详情、开单、AI 占位及未知店铺 404。浏览器视口截图仍应在 Preview 验收阶段完成。

Prisma 当前还有 `package.json#prisma` 将在 Prisma 7 废弃的警告，但不阻塞本次部署。本次保持 Prisma 6.19.3，不在前台接入过程中顺带升级大版本。

## 10. 前台模块接入前提

- 前台模块应兼容 Next.js 15、React 19 和 App Router。
- 若交付的是普通 React 页面，优先改造成当前应用的页面和 Client Component，而不是新建第二个 Vercel 项目。
- 接入时只迁移前台所需资源、样式和交互，不顺带重构现有后台。
- 新增数据能力前，先定义服务端校验、租户范围、错误模式和验收测试，再实现页面调用。
