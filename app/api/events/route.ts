import { BehaviorType, Role } from "@prisma/client";
import { auth } from "@/customer-auth";
import { db } from "@/lib/db";
import { behaviorEventSchema } from "@/lib/validation";
import { canAccessPublicStore, deploymentScope } from "@/lib/deployment-scope";

export async function POST(request: Request) {
  const parsed = behaviorEventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "事件不正确" }, { status: 400 });
  const input = parsed.data; const session = await auth();
  if (!canAccessPublicStore(input.storeSlug)) return Response.json({ error: "Preview 仅允许测试店铺写入" }, { status: 403 });
  if (deploymentScope().isPreview && session?.user && session.user.role !== Role.CUSTOMER) return Response.json({ error: "Preview 不允许后台账号写入前台事件" }, { status: 403 });
  const store = await db.store.findUnique({ where: { slug: input.storeSlug } });
  if (!store?.isActive) return Response.json({ error: "店铺不存在" }, { status: 404 });
  if (input.productId && !await db.product.findFirst({ where: { id: input.productId, storeId: store.id, isDeleted: false } })) return Response.json({ error: "商品不属于店铺" }, { status: 400 });
  const customerId = session?.user?.role === Role.CUSTOMER ? session.user.id : null;
  await db.behaviorEvent.create({ data: { storeId: store.id, sessionId: input.sessionId, dedupeKey: `${input.sessionId}:${input.eventId}`, type: input.type as BehaviorType, customerId, productId: input.productId, pageSlug: input.pageSlug } }).catch(() => null);
  if (customerId && input.ref && ["FAVORITE","CART_ADD","ORDER_SUBMIT"].includes(input.type)) {
    const employee = await db.user.findFirst({ where: { storeId: store.id, role: Role.EMPLOYEE, shareCode: input.ref, isActive: true } });
    if (employee) await db.$transaction([db.customerAttribution.updateMany({ where: { storeId: store.id, customerId, isCurrent: true }, data: { isCurrent: false } }), db.customerAttribution.create({ data: { storeId: store.id, customerId, employeeId: employee.id, reason: input.type, isCurrent: true } })]);
  }
  return Response.json({ ok: true });
}
