# APP 员工注册与名片联动测试 Checklist

## 1. 目的

本文档用于验收以下完整链路：

```text
后台签发邀请
→ 受邀者注册
→ APP 自动登录
→ 员工/店铺管理员个人中心
→ 修改名片与头像
→ 带个人 ref 的店铺首页展示最新名片
```

同时回归客户注册登录、后台登录以及同一浏览器中的 APP/后台独立会话。

测试时必须同时核对三类证据：

1. 用户所见：页面、提示、跳转和名片内容。
2. 持久化状态：Supabase PostgreSQL、Storage 对象和审计日志。
3. 业务规则：邀请权限、角色绑定、手机号绑定、配额和账号隔离。

## 2. 范围

### 2.1 核心范围

- 店铺管理员签发 `EMPLOYEE` 邀请。
- 平台管理员签发 `STORE_ADMIN` 邀请。
- 邀请预览、撤销、过期、重复使用和手机号绑定。
- 员工/店铺管理员通过 `/login` 登录 APP。
- 员工版 `/me`、名片资料、头像、密码和个人分享首页。
- 邀请创建、撤销、兑换及名片修改的审计日志。

### 2.2 回归范围

- 客户手机号注册、登录、个人中心和意向单。
- `/admin/login` 后台登录。
- APP 与后台 Cookie 隔离，可在同一浏览器同时登录。
- 无效 `ref`、停用员工和停用店铺回退到店铺默认名片。

### 2.3 本轮不测

- 企业管理员业务功能。
- 商品、订单、页面装修等无关业务。
- 实时推送；本功能只要求刷新后读取最新名片。
- 视频文件；头像仅支持 JPG、PNG、WebP。

## 3. 测试环境与账号

### 3.1 环境确认

当前项目使用 Supabase PostgreSQL：

- 应用运行时：`DATABASE_URL`，通常为 `6543` 事务池连接。
- 受控迁移：`DIRECT_URL`，通常为 `5432` 会话连接。
- 本地启动：`npm run dev`，或使用已启动的 `http://localhost:3100`。

执行前确认：

- [ ] P-001 已确认测试目标是预期的 Supabase 项目和环境。
- [ ] P-002 生产环境已具备可恢复备份；测试库已记录测试前基线。
- [ ] P-003 已准备平台管理员账号 A、店铺管理员账号 B、客户账号 C。
- [ ] P-004 已选择启用中的测试店铺 S，并记录 `storeId`、`slug`、`employeeLimit`、`adminLimit`。
- [ ] P-005 已准备两个未占用的登录账号和两个可接收邀请的手机号。
- [ ] P-006 已配置 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`，且 `customer-assets` 为公开读取桶。

不要在已有业务数据的生产库运行：

```bash
npm run db:seed
npm run db:push
```

## 4. 数据库迁移

对应迁移：

```text
prisma/migrations/20260729000100_staff_invitations/migration.sql
```

执行顺序：

```bash
npx prisma migrate status
npm run db:deploy
npx prisma migrate status
```

- [ ] D-001 `[BLOCK]` 迁移执行成功，第二次 `migrate status` 显示数据库结构为最新状态。
- [ ] D-002 `[AI]` `StaffInvitation` 的 11 个字段、唯一索引和外键均存在。

只读校验 SQL：

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'StaffInvitation'
order by ordinal_position;

select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'StaffInvitation'
order by indexname;

select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = '"StaffInvitation"'::regclass
order by conname;
```

预期：

- `tokenHash` 有唯一索引。
- `storeId` 指向 `Store.id`，店铺删除时级联删除邀请。
- `createdById` 指向 `User.id`。
- 本次迁移不修改已有 `User`、客户资料或名片记录。

## 5. 状态跃迁

```text
邀请不存在
  → 已创建、未使用
  → 已预览
  → 已兑换
  → 员工账号已启用
  → 名片已更新
  → 个人 ref 首页已更新

已创建、未使用
  ├→ 已撤销
  └→ 已过期

员工账号已启用
  ├→ 员工停用 → 登录拒绝、ref 回退
  └→ 店铺停用 → 登录拒绝、ref 回退
```

## 6. Group A：员工账号生命线

测试期间店铺管理员 B 保持登录后台；受邀员工使用无痕窗口完成 APP 操作，避免已有 APP Cookie 干扰。

### A1. 创建员工邀请

- [ ] T-001 `[BLOCK][RT]` 店铺管理员 B 打开 `/admin/employees`，输入邀请手机号并生成链接；页面只展示一次完整链接，链接形如 `/login?mode=staff-register&invite=...`。
- [ ] T-002 `[AI]` 数据库新增一条未使用邀请，角色固定为 `EMPLOYEE`，店铺固定为 B 所属店铺，有效期约为创建时间后 72 小时。
- [ ] T-003 `[AI]` 数据库 `tokenHash` 为 64 位 SHA-256 十六进制字符串，不包含页面中的原始令牌。
- [ ] T-004 `[AI]` `AuditLog` 存在“创建员工邀请”记录，`actorId` 为 B，`storeId` 为测试店铺。

只读校验 SQL，将手机号替换为本次邀请手机号：

```sql
select i."id", i."storeId", i."role", i."inviteePhone",
       length(i."tokenHash") as token_hash_length,
       i."createdById", i."expiresAt", i."usedAt", i."revokedAt", i."createdAt"
from "StaffInvitation" i
where i."inviteePhone" = '<邀请手机号>'
order by i."createdAt" desc
limit 1;

select "action", "actorId", "storeId", "entityId", "createdAt"
from "AuditLog"
where "entityType" = 'StaffInvitation'
order by "createdAt" desc
limit 5;
```

### A2. 预览与兑换

- [ ] T-005 `[RT]` 在无痕窗口打开邀请链接，页面显示正确店铺、角色“员工”和脱敏手机号，不提供角色或店铺选择。
- [ ] T-006 `[RT]` 输入与邀请不同的手机号提交，页面明确拒绝；数据库仍为 `usedAt is null`，且没有创建用户。
- [ ] T-007 `[BLOCK][RT]` 改为邀请手机号，填写姓名、未占用的独立登录账号和 8–72 位密码；注册成功后自动登录并进入 `/me`。
- [ ] T-008 `[RT]` `/me` 显示店铺、员工角色、登录账号、名片预览和个人分享入口，不显示客户意向单。
- [ ] T-009 `[AI]` `User` 新记录的 `role=EMPLOYEE`、`storeId` 正确、`shareCode` 非空且 `isActive=true`；邀请 `usedAt` 已写入。
- [ ] T-010 `[AI]` `AuditLog` 存在邀请兑换记录，且 `afterJson` 中的用户和角色与新账号一致。

只读校验 SQL：

```sql
select "id", "username", "role", "name", "phone", "storeId",
       "shareCode", "isActive", "createdAt"
from "User"
where "username" = '<员工登录账号>';

select "id", "usedAt", "revokedAt", "expiresAt"
from "StaffInvitation"
where "inviteePhone" = '<邀请手机号>'
order by "createdAt" desc
limit 1;

select "action", "actorId", "storeId", "entityId", "afterJson", "createdAt"
from "AuditLog"
where "entityType" = 'StaffInvitation'
order by "createdAt" desc
limit 5;
```

### A3. 修改名片与头像

- [ ] T-011 `[RT]` 进入 `/me/settings`，登录账号、角色、所属店铺和分享码只读，没有可编辑控件。
- [ ] T-012 `[RT]` 分别尝试空微信号、31 字职位和 91 字简介，页面拒绝保存并显示对应校验信息。
- [ ] T-013 `[BLOCK][RT]` 保存合法姓名、11 位联系电话、真实微信号、职位和简介；页面立即显示“名片已保存”。
- [ ] T-014 `[AI]` `User` 同一记录更新，未创建名片副本；`username`、`role`、`storeId`、`shareCode` 保持不变。
- [ ] T-015 `[AI]` `AuditLog` 存在“APP 修改个人名片”记录，`beforeJson` 和 `afterJson` 可对应本次修改。
- [ ] T-016 `[RT]` 上传 JPG、PNG 或 WebP 头像，文件不超过 5 MB；设置页立即展示新头像。
- [ ] T-017 `[AI]` `User.avatarUrl` 指向 `customer-assets/{storeId}/{userId}/avatar-*`，Storage 中存在新对象。
- [ ] T-018 `[RT][AI]` 再上传一张合法头像；页面展示新头像，Storage 中旧头像对象已删除。
- [ ] T-019 `[RT]` 上传非图片或大于 5 MB 文件，系统拒绝，原头像和 `User.avatarUrl` 不变。
- [ ] T-020 `[RT][AI]` 删除头像；页面回退默认头像，`User.avatarUrl is null`，Storage 旧对象已删除。

名片只读校验 SQL：

```sql
select "username", "role", "storeId", "shareCode",
       "name", "phone", "wechat", "title", "bio", "avatarUrl", "updatedAt"
from "User"
where "username" = '<员工登录账号>';

select "action", "beforeJson", "afterJson", "createdAt"
from "AuditLog"
where "actorId" = (select "id" from "User" where "username" = '<员工登录账号>')
  and "entityType" = 'User'
order by "createdAt" desc
limit 10;
```

### A4. 分享首页与密码

- [ ] T-021 `[BLOCK][RT]` 点击“查看我的名片”，URL 含新用户 `shareCode`，首页显示刚保存的姓名、电话、微信、职位、简介和头像。
- [ ] T-022 `[RT]` 保持分享页打开，再修改简介；旧页面刷新后显示最新简介，不要求实时推送。
- [ ] T-023 `[RT]` 删除 URL 中的 `ref` 并刷新，首页显示店铺默认名片，不显示员工个人名片。
- [ ] T-024 `[RT]` 使用错误当前密码修改密码，系统拒绝；原密码仍可登录。
- [ ] T-025 `[BLOCK][RT]` 使用正确当前密码设置 8–72 位新密码，退出后旧密码登录失败、新密码登录成功。

## 7. Group B：店铺管理员账号生命线

平台管理员 A 保持登录后台；受邀店铺管理员使用另一个无痕窗口。

- [ ] T-026 `[BLOCK][RT]` 平台管理员打开 `/admin/stores`，选择测试店铺并生成邀请；页面显示角色为店铺管理员的邀请入口。
- [ ] T-027 `[AI]` 邀请记录 `role=STORE_ADMIN`、`storeId` 正确，有效期约 72 小时，创建审计日志存在。
- [ ] T-028 `[BLOCK][RT]` 受邀者使用绑定手机号和独立登录账号完成注册，自动进入管理员版 `/me`。
- [ ] T-029 `[AI]` 新 `User` 的 `role=STORE_ADMIN`、`storeId`、`shareCode` 和 `isActive` 均正确，邀请已使用。
- [ ] T-030 `[RT]` 店铺管理员完成姓名、电话、微信、职位、简介、头像和密码修改，行为与 Group A 一致。
- [ ] T-031 `[RT]` 个人 `ref` 首页展示该管理员最新名片；无 `ref` 时仍展示店铺默认名片。

## 8. Group C：边界与回归

### C1. 邀请状态边界

- [ ] T-032 `[RT]` 创建一条新邀请后在后台撤销；链接再次打开显示“邀请已撤销”，无法注册。
- [ ] T-033 `[AI]` 邀请 `revokedAt` 非空，且存在“撤销员工邀请”审计日志。
- [ ] T-034 `[RT]` 再次提交已经成功兑换的邀请，系统提示“邀请已使用”，不创建第二个用户。
- [ ] T-035 `[RT]` 使用已存在的全局登录账号兑换新邀请，系统提示“登录账号已存在”，邀请仍未使用。
- [ ] T-036 `[RT]` 客户手机号与员工邀请手机号相同，但员工使用不同登录账号时可注册成功；数据库存在两个独立 `User`。
- [ ] T-037 `[RT]` 达到 `employeeLimit` 后，创建或兑换员工邀请均被拒绝；达到 `adminLimit` 后，创建或兑换管理员邀请均被拒绝。
- [ ] T-038 `[AI]` 并发提交同一个邀请时只创建一个用户，只有一个请求成功；并发提交最后一个配额的两个不同邀请时最多新增一个用户。

过期邀请优先使用自然过期记录验证。仅在隔离测试库允许通过受控 SQL 构造过期状态，禁止在生产库修改业务邀请：

```sql
-- 仅限隔离测试库，并且必须使用本次专用 invitation id。
update "StaffInvitation"
set "expiresAt" = now() - interval '1 minute'
where "id" = '<本次专用 invitation id>'
  and "usedAt" is null
  and "revokedAt" is null;
```

- [ ] T-039 `[RT]` 打开过期邀请显示“邀请已过期”，提交注册被拒绝，邀请仍未使用。

### C2. 停用与默认名片回退

- [ ] T-040 `[RT]` 停用测试员工后，该账号不能重新登录 APP。
- [ ] T-041 `[RT]` 使用该员工原 `ref` 打开店铺首页，页面回退到店铺默认名片。
- [ ] T-042 `[RT]` 重新启用员工后可再次登录，原 `ref` 恢复显示员工最新名片。
- [ ] T-043 `[RT]` 停用测试店铺后，所属员工和店铺管理员均不能登录 APP，个人 `ref` 不再展示个人名片。
- [ ] T-044 `[RT]` 重新启用店铺后账号和名片恢复，不需要重新注册或生成 `shareCode`。

### C3. 客户与前后台会话回归

- [ ] T-045 `[BLOCK][RT]` 新客户仍可从店铺页面进入 `/login`，使用手机号注册并自动登录。
- [ ] T-046 `[RT]` 客户 `/me` 仍显示店铺资料和意向单，不显示员工名片设置。
- [ ] T-047 `[RT]` 现有员工账号无需邀请或重新注册，可直接通过 `/login` 使用独立账号登录 APP。
- [ ] T-048 `[RT]` `PLATFORM_ADMIN` 和 `ENTERPRISE_ADMIN` 尝试 `/login` 均失败，仍只能使用 `/admin/login`。
- [ ] T-049 `[BLOCK][RT]` 同一浏览器先登录 APP，再登录后台；刷新两边页面后两个账号均保持登录。
- [ ] T-050 `[AI]` 浏览器 Cookie 同时存在 `authjs.customer.*` 与 `authjs.admin.*`，名称互不覆盖。
- [ ] T-051 `[RT]` APP 退出登录后后台会话仍有效；后台退出后 APP 会话仍有效。

## 9. 自动检查基线

本次实现完成时已执行以下自动检查，但它们不能替代真实 Supabase 和浏览器验收：

- [x] A-001 `npm test`：9 个测试文件、72 个测试通过。
- [x] A-002 `npm run lint`：通过。
- [x] A-003 `npx tsc --noEmit`：通过。
- [x] A-004 `npm run build`：通过。
- [x] A-005 `git diff --check`：通过。
- [x] A-006 本地 smoke：`/login` 返回 200，未登录 `/me` 重定向到 `/login?returnTo=%2Fme`，CSRF Cookie 使用 `authjs.customer.*`。

真实环境未完成前，不得写“线上已验证”：

- [ ] A-007 真实 Supabase 增量迁移已执行并通过结构校验。
- [ ] A-008 真实 Storage 头像上传、替换、删除已验证。
- [ ] A-009 PostgreSQL 并发兑换和配额竞争已验证。
- [ ] A-010 客户、员工、店铺管理员、平台管理员浏览器 E2E 已完成。

## 10. 测试记录规则

每完成一个测试点，必须在勾选后追加具体证据，不能只写“正常”或“通过”。示例：

```markdown
- [x] T-007 注册员工 -- 跳转 /me；User role=EMPLOYEE、storeId=xxx、shareCode 非空；邀请 usedAt=2026-07-29 10:20:31
- [!] T-018 替换头像 -- BUG-001；页面显示新头像，但 Storage 旧对象仍存在
- [-] T-038 并发兑换 -- 测试环境暂未提供并发请求条件
```

出现问题时另建：

```text
docs/app-staff-registration-card-bugs.md
```

BUG 只记录复现事实、实际表现、预期行为、环境和时间，不在测试文档中直接推测原因或提出修复方案。
