# 云丞 AI 商城平台 MVP

基于 Next.js App Router、Tailwind CSS、Prisma 和 SQLite 的本地全栈 MVP，实现平台建店、门店商品管理、员工分享、H5 开单、客户线索、订单处理及 Excel/图片导出。

## 启动

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

## 本地 MVP 边界

- 图片通过 HTTP/HTTPS URL 维护，不保存上传文件。
- Excel 仅支持系统提供的 `.xlsx` 模板，导入商品默认下架。
- 不包含小程序、页面装修、企业/工厂账号、在线支付、库存、物流、客户账号和 AI 能力。
- `.env` 中的 `AUTH_SECRET` 仅用于本机演示，部署前必须更换并迁移至 PostgreSQL 和对象存储。
