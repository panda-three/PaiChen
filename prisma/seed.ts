import { PrismaClient, Role } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const furniture = {
  sofa: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=1200&q=85",
  chair: "https://images.unsplash.com/photo-1598300056393-4aac492f4344?auto=format&fit=crop&w=1200&q=85",
  table: "https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=1200&q=85",
  room: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=85",
};

async function main() {
  const seedPassword = process.env.SEED_PASSWORD;
  if (!seedPassword || seedPassword.length < 12) {
    throw new Error("SEED_PASSWORD must be set to at least 12 characters before seeding.");
  }

  await prisma.auditLog.deleteMany();
  await prisma.orderNote.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
  await prisma.store.deleteMany();

  const passwordHash = await hash(seedPassword, 12);
  await prisma.user.create({ data: { username: "platform_admin", passwordHash, role: Role.PLATFORM_ADMIN, name: "平台管理员" } });

  const storeA = await prisma.store.create({
    data: { slug: "liangchen", name: "良丞家具", logoUrl: furniture.room, phone: "400-888-1024", address: "上海市闵行区家居产业园 18 号" },
  });
  const storeB = await prisma.store.create({
    data: { slug: "yunqi", name: "云栖家居", logoUrl: furniture.sofa, phone: "400-886-2026", address: "杭州市余杭区创景路 66 号" },
  });

  await prisma.user.create({ data: { username: "store_a_admin", passwordHash, role: Role.STORE_ADMIN, name: "陈店长", phone: "13800001001", storeId: storeA.id } });
  await prisma.user.create({ data: { username: "store_b_admin", passwordHash, role: Role.STORE_ADMIN, name: "林店长", phone: "13800002001", storeId: storeB.id } });
  await prisma.user.create({ data: { username: "employee_a", passwordHash, role: Role.EMPLOYEE, name: "阮先生", phone: "13800001002", wechat: "ruan_home", title: "木作主理人", bio: "从原木定制到全屋家具，一站式整装", avatarUrl: furniture.chair, shareCode: "staff-ruan", storeId: storeA.id } });
  await prisma.user.create({ data: { username: "employee_a2", passwordHash, role: Role.EMPLOYEE, name: "周顾问", phone: "13800001003", wechat: "zhou_design", title: "空间顾问", bio: "专注客厅与餐厅空间搭配", avatarUrl: furniture.room, shareCode: "staff-zhou", storeId: storeA.id } });
  await prisma.user.create({ data: { username: "employee_b", passwordHash, role: Role.EMPLOYEE, name: "林顾问", phone: "13800002002", wechat: "lin_home", title: "软装顾问", bio: "用材质与色彩打造舒适空间", avatarUrl: furniture.sofa, shareCode: "staff-lin", storeId: storeB.id } });

  const living = await prisma.category.create({ data: { name: "客厅系列", sort: 10, storeId: storeA.id } });
  const dining = await prisma.category.create({ data: { name: "餐厅系列", sort: 20, storeId: storeA.id } });
  const otherStoreCategory = await prisma.category.create({ data: { name: "现代系列", sort: 10, storeId: storeB.id } });

  await prisma.product.createMany({ data: [
    { name: "云朵模块沙发", code: "LC-SF-001", categoryId: living.id, storeId: storeA.id, mainImageUrl: furniture.sofa, detailImageUrls: furniture.room, specification: "三人位 2200x950x820mm", price: 6999, unit: "套", description: "高回弹坐垫与可拆洗面料，适合现代客厅。", sort: 10, isPublished: true },
    { name: "白蜡木休闲椅", code: "LC-CH-002", categoryId: living.id, storeId: storeA.id, mainImageUrl: furniture.chair, specification: "单椅 720x760x810mm", price: 1899, unit: "把", description: "白蜡木框架，头层牛皮软包。", sort: 20, isPublished: true },
    { name: "岩板圆餐桌", code: "LC-TB-003", categoryId: dining.id, storeId: storeA.id, mainImageUrl: furniture.table, specification: "直径 1350mm", price: 4299, unit: "张", description: "耐磨岩板台面，可容纳六人用餐。", sort: 10, isPublished: true },
    { name: "轻奢客厅组合", code: "YQ-SF-001", categoryId: otherStoreCategory.id, storeId: storeB.id, mainImageUrl: furniture.room, specification: "四件套", price: 12800, unit: "套", description: "云栖家居专属客厅组合。", sort: 10, isPublished: true },
  ] });
}

main().finally(() => prisma.$disconnect());
