import { AuthorizationStatus, CustomerStatus, ProductSource, Role } from "@prisma/client";
import { auth } from "@/customer-auth";
import { db } from "@/lib/db";
import { canAccessPublicStore } from "@/lib/deployment-scope";
import { publicOrderSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "请先登录 APP 账号" }, { status: 401 });

  const parsed = publicOrderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "提交内容不正确" }, { status: 400 });
  const input = parsed.data;
  if (!canAccessPublicStore(input.storeSlug)) return Response.json({ error: "Preview 仅允许测试店铺写入" }, { status: 403 });

  const currentUser = await db.user.findFirst({ where: { id: session.user.id, isActive: true } });
  if (!currentUser || (currentUser.role !== Role.CUSTOMER && currentUser.role !== Role.EMPLOYEE && currentUser.role !== Role.STORE_ADMIN)) {
    return Response.json({ error: "当前 APP 账号不可开单" }, { status: 403 });
  }
  if (currentUser.role === Role.CUSTOMER && currentUser.customerStatus !== CustomerStatus.ACTIVE) {
    return Response.json({ error: "客户账号不可用" }, { status: 403 });
  }
  const store = await db.store.findUnique({ where: { slug: input.storeSlug } });
  if (!store?.isActive || (currentUser.role === Role.CUSTOMER && !store.customerEnabled)) return Response.json({ error: "店铺暂不可用" }, { status: 404 });

  const assisted = currentUser.role === Role.EMPLOYEE || currentUser.role === Role.STORE_ADMIN;
  if (assisted && currentUser.storeId !== store.id) return Response.json({ error: "当前账号不属于此店铺" }, { status: 403 });
  if (assisted && (!input.customerName || !/^1\d{10}$/.test(input.customerPhone))) {
    return Response.json({ error: !input.customerName ? "请填写客户姓名" : "请输入正确的客户手机号" }, { status: 400 });
  }

  const profile = currentUser.role === Role.CUSTOMER
    ? await db.customerProfile.findFirst({ where: { storeId: store.id, customerId: currentUser.id, status: CustomerStatus.ACTIVE } })
    : null;
  if (currentUser.role === Role.CUSTOMER && !profile) return Response.json({ error: "客户尚未加入当前店铺" }, { status: 403 });

  const sourceEmployee = currentUser.role === Role.CUSTOMER && input.ref
    ? await db.user.findFirst({ where: { storeId: store.id, shareCode: input.ref, role: { in: [Role.STORE_ADMIN, Role.EMPLOYEE] }, isActive: true } })
    : currentUser.role === Role.EMPLOYEE ? currentUser : null;
  const customerId = currentUser.role === Role.CUSTOMER ? currentUser.id : null;
  const customerName = profile?.name ?? input.customerName;
  const customerPhone = profile?.phone ?? input.customerPhone;

  const existing = await db.order.findUnique({ where: { idempotencyKey: input.clientRequestId } });
  if (existing) {
    if (existing.storeId !== store.id || existing.appSubmitterId !== currentUser.id) {
      return Response.json({ error: "重复请求标识冲突" }, { status: 409 });
    }
    return Response.json({ orderNo: existing.orderNo, storePhone: store.phone });
  }

  const products = await db.product.findMany({
    where: {
      id: { in: input.items.map((item) => item.productId) },
      storeId: store.id,
      isPublished: true,
      isDeleted: false,
      category: { isActive: true },
      OR: [{ source: { not: ProductSource.ENTERPRISE } }, { authorization: { status: AuthorizationStatus.ACTIVE } }],
    },
    include: { variants: true },
  });
  const productMap = new Map(products.map((product) => [product.id, product]));
  if (products.length !== new Set(input.items.map((item) => item.productId)).size) {
    return Response.json({ error: "部分商品已下架，请刷新后重试" }, { status: 400 });
  }
  for (const item of input.items) {
    const product = productMap.get(item.productId)!;
    if (item.variantId && !product.variants.some((variant) => variant.id === item.variantId)) {
      return Response.json({ error: "商品规格已失效" }, { status: 400 });
    }
  }

  const now = new Date();
  const orderNo = `YC${now.toISOString().slice(0, 10).replaceAll("-", "")}${String(Date.now()).slice(-6)}`;
  const logisticsRemark = [
    input.logisticsName && `物流名称：${input.logisticsName}`,
    input.logisticsAddress && `物流发货地址：${input.logisticsAddress}`,
    input.logisticsPhone && `物流联系电话：${input.logisticsPhone}`,
  ].filter(Boolean).join("\n");

  const order = await db.$transaction(async (tx) => {
    const lead = await tx.lead.upsert({
      where: { storeId_phone: { storeId: store.id, phone: customerPhone } },
      create: {
        storeId: store.id,
        name: customerName,
        phone: customerPhone,
        ...(sourceEmployee ? { latestEmployeeId: sourceEmployee.id } : {}),
        firstOrderAt: now,
        lastOrderAt: now,
      },
      update: {
        name: customerName,
        ...(sourceEmployee ? { latestEmployeeId: sourceEmployee.id } : {}),
        lastOrderAt: now,
      },
    });
    if (currentUser.role === Role.CUSTOMER && sourceEmployee) {
      await tx.customerAttribution.updateMany({ where: { storeId: store.id, customerId: currentUser.id, isCurrent: true }, data: { isCurrent: false } });
      await tx.customerAttribution.create({ data: { storeId: store.id, customerId: currentUser.id, employeeId: sourceEmployee.id, reason: "ORDER_SUBMIT", isCurrent: true } });
    }
    const created = await tx.order.create({
      data: {
        orderNo,
        idempotencyKey: input.clientRequestId,
        storeId: store.id,
        leadId: lead.id,
        customerId,
        appSubmitterId: currentUser.id,
        sourceEmployeeId: sourceEmployee?.id ?? null,
        responsibleEmployeeId: sourceEmployee?.id ?? null,
        customerName,
        customerPhone,
        customerAddress: input.customerAddress,
        customerRemark: [input.customerRemark, logisticsRemark].filter(Boolean).join("\n"),
        shippingFee: input.shippingFee,
        installationFee: input.installationFee,
        items: {
          create: input.items.map((item) => {
            const product = productMap.get(item.productId)!;
            const variant = product.variants.find((candidate) => candidate.id === item.variantId) ?? product.variants[0];
            const snapshotPrice = variant?.price ?? product.price;
            return {
              productId: product.id,
              variantId: variant?.id,
              productName: product.name,
              productCode: product.code,
              imageUrl: variant?.imageUrl || product.mainImageUrl,
              specification: variant ? [variant.name, variant.specification].filter(Boolean).join(" · ") : product.specification,
              variantCode: variant?.code,
              price: snapshotPrice,
              salePrice: snapshotPrice,
              unit: product.unit,
              quantity: item.quantity,
              remark: item.remark,
            };
          }),
        },
      },
    });
    await tx.behaviorEvent.create({ data: { storeId: store.id, sessionId: input.clientRequestId, dedupeKey: `order:${input.clientRequestId}`, type: "ORDER_SUBMIT", customerId } });
    return created;
  });
  return Response.json({ orderNo: order.orderNo, storePhone: store.phone });
}
