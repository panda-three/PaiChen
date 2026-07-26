import { CustomerStatus, Role } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { canAccessPublicStore } from "@/lib/deployment-scope";

const schema = z.object({ productId: z.string(), storeSlug: z.string() });
export async function POST(request: Request) {
  const session = await auth();
  if (session?.user?.role !== Role.CUSTOMER) return Response.json({ error: "请先登录已激活的客户账号" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return Response.json({ error: "内容不正确" }, { status: 400 });
  if (!canAccessPublicStore(parsed.data.storeSlug)) return Response.json({ error: "Preview 仅允许测试店铺写入" }, { status: 403 });
  const product = await db.product.findFirst({ where: { id: parsed.data.productId, store: { slug: parsed.data.storeSlug, isActive: true }, isPublished: true, isDeleted: false } });
  if (!product) return Response.json({ error: "商品不可用" }, { status: 404 });
  if (!await db.customerProfile.findFirst({ where: { storeId: product.storeId, customerId: session.user.id, status: CustomerStatus.ACTIVE } })) return Response.json({ error: "客户尚未通过当前店铺审核" }, { status: 403 });
  const existing = await db.favorite.findUnique({ where: { customerId_productId: { customerId: session.user.id, productId: product.id } } });
  if (existing) await db.favorite.delete({ where: { id: existing.id } }); else await db.favorite.create({ data: { storeId: product.storeId, customerId: session.user.id, productId: product.id } });
  return Response.json({ favorite: !existing });
}
