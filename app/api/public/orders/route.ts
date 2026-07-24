import { db } from "@/lib/db";
import { publicOrderSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const raw = await request.json().catch(() => null);
  const parsed = publicOrderSchema.safeParse(raw);
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "提交内容不正确" }, { status: 400 });
  const input = parsed.data;
  const store = await db.store.findUnique({ where: { slug: input.storeSlug }, include: { users: { where: { shareCode: input.ref, role: "EMPLOYEE", isActive: true }, take: 1 } } });
  if (!store || !store.isActive) return Response.json({ error: "店铺暂不可用" }, { status: 404 });
  const sourceEmployee = store.users[0] ?? null;
  const existing = await db.order.findUnique({ where: { idempotencyKey: input.clientRequestId } });
  if (existing) return Response.json({ orderNo: existing.orderNo, storePhone: store.phone });
  const products = await db.product.findMany({ where: { id: { in: input.items.map((item) => item.productId) }, storeId: store.id, isPublished: true, category: { isActive: true } }, include: { category: true } });
  const productMap = new Map(products.map((product) => [product.id, product]));
  if (products.length !== new Set(input.items.map((item) => item.productId)).size) return Response.json({ error: "部分商品已下架，请刷新后重试" }, { status: 400 });
  const now = new Date();
  const orderNo = `YC${now.toISOString().slice(0, 10).replaceAll("-", "")}${String(Date.now()).slice(-6)}`;
  const order = await db.$transaction(async (tx) => {
    const lead = await tx.lead.upsert({ where: { storeId_phone: { storeId: store.id, phone: input.customerPhone } }, create: { storeId: store.id, name: input.customerName, phone: input.customerPhone, latestEmployeeId: sourceEmployee?.id, firstOrderAt: now, lastOrderAt: now }, update: { name: input.customerName, latestEmployeeId: sourceEmployee?.id, lastOrderAt: now } });
    return tx.order.create({ data: { orderNo, idempotencyKey: input.clientRequestId, storeId: store.id, leadId: lead.id, sourceEmployeeId: sourceEmployee?.id, customerName: input.customerName, customerPhone: input.customerPhone, customerAddress: input.customerAddress, customerRemark: input.customerRemark, items: { create: input.items.map((item) => { const product = productMap.get(item.productId)!; return { productId: product.id, productName: product.name, productCode: product.code, imageUrl: product.mainImageUrl, specification: product.specification, price: product.price, unit: product.unit, quantity: item.quantity }; }) } } });
  });
  return Response.json({ orderNo: order.orderNo, storePhone: store.phone });
}
