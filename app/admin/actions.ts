"use server";

import { OrderStatus, Role } from "@prisma/client";
import { hash } from "bcryptjs";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCatalogStore, requireActor } from "@/lib/authz";
import { db } from "@/lib/db";
import { orderScope } from "@/lib/scopes";
import { homeTemplateConfig } from "@/lib/page-config";
import { cardWechatSchema } from "@/lib/validation";

const optionalUrl = z.union([z.literal(""), z.string().url("图片必须是有效的 HTTP/HTTPS URL")]);
const phone = z.string().trim().regex(/^1\d{10}$|^[0-9+() -]{6,20}$/, "联系电话格式不正确");

function text(data: FormData, key: string) {
  return String(data.get(key) ?? "").trim();
}

function fieldError(error: z.ZodError) {
  return error.issues[0]?.message ?? "提交内容不正确";
}

function moneyInput(raw: string, label: string): string;
function moneyInput(raw: string, label: string, optional: true): string | null;
function moneyInput(raw: string, label: string, optional = false) {
  if (!raw && optional) return null;
  if (!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(raw)) throw new Error(`${label}必须是非负金额，且最多保留两位小数`);
  return raw;
}

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

async function audit(input: { actorId: string; storeId?: string | null; action: string; entityType: string; entityId: string; before?: unknown; after?: unknown }) {
  await db.auditLog.create({ data: {
    actorId: input.actorId, storeId: input.storeId ?? null, action: input.action, entityType: input.entityType, entityId: input.entityId,
    beforeJson: input.before == null ? null : JSON.stringify(input.before), afterJson: input.after == null ? null : JSON.stringify(input.after),
  } });
}

const storeCreateSchema = z.object({
  name: z.string().min(1, "请填写店铺名称"),
  slug: z.string().regex(/^[a-z0-9-]{3,30}$/, "店铺标识只能使用 3-30 位小写字母、数字和连字符"),
  phone,
  address: z.string().min(1, "请填写店铺地址"),
  managerName: z.string().min(1, "请填写管理员姓名"),
  username: z.string().min(3, "登录账号至少 3 个字符"),
  password: z.string().min(8, "初始密码至少 8 个字符"),
});

export async function createStore(data: FormData) {
  const actor = await requireActor([Role.PLATFORM_ADMIN]);
  const parsed = storeCreateSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) fail("/admin/stores", fieldError(parsed.error));
  const value = parsed.data;
  const exists = await db.user.findUnique({ where: { username: value.username } });
  if (exists) fail("/admin/stores", "登录账号已存在");
  const store = await db.$transaction(async (tx) => {
    const created = await tx.store.create({ data: { name: value.name, slug: value.slug, phone: value.phone, address: value.address } });
    await tx.user.create({ data: { username: value.username, passwordHash: await hash(value.password, 12), role: Role.STORE_ADMIN, name: value.managerName, phone: value.phone, shareCode: randomUUID(), storeId: created.id } });
    const homepage = JSON.stringify(homeTemplateConfig());
    await tx.storePage.create({ data: { storeId: created.id, title: "店铺首页", slug: "home", category: "首页", draftJson: homepage, publishedJson: homepage, isHome: true, publishedAt: new Date() } });
    return created;
  }).catch(() => null);
  if (!store) fail("/admin/stores", "店铺标识或登录账号已存在");
  await audit({ actorId: actor.id, action: "创建店铺", entityType: "Store", entityId: store.id, after: { name: store.name, slug: store.slug } });
  revalidatePath("/admin/stores");
}

export async function updateStore(data: FormData) {
  const actor = await requireActor([Role.PLATFORM_ADMIN]);
  const id = text(data, "id");
  const schema = z.object({ name: z.string().min(1, "请填写店铺名称"), phone, address: z.string().min(1, "请填写店铺地址") });
  const parsed = schema.safeParse({ name: text(data, "name"), phone: text(data, "phone"), address: text(data, "address") });
  if (!parsed.success) fail("/admin/stores", fieldError(parsed.error));
  const current = await db.store.findUnique({ where: { id } });
  if (!current) fail("/admin/stores", "店铺不存在");
  const updated = await db.store.update({ where: { id }, data: parsed.data });
  await audit({ actorId: actor.id, action: "编辑店铺", entityType: "Store", entityId: id, before: current, after: updated });
  revalidatePath("/admin/stores");
}

export async function toggleStore(data: FormData) {
  const actor = await requireActor([Role.PLATFORM_ADMIN]);
  const id = text(data, "id");
  const current = await db.store.findUnique({ where: { id } });
  if (!current) return;
  const updated = await db.store.update({ where: { id }, data: { isActive: !current.isActive } });
  await audit({ actorId: actor.id, action: updated.isActive ? "启用店铺" : "停用店铺", entityType: "Store", entityId: id, before: { isActive: current.isActive }, after: { isActive: updated.isActive } });
  revalidatePath("/admin/stores");
}

export async function resetManagerPassword(data: FormData) {
  await requireActor([Role.PLATFORM_ADMIN]);
  const storeId = text(data, "storeId");
  const password = text(data, "password");
  if (password.length < 8) fail("/admin/stores", "新密码至少 8 个字符");
  const manager = await db.user.findFirst({ where: { storeId, role: Role.STORE_ADMIN } });
  if (!manager) fail("/admin/stores", "未找到店铺管理员");
  await db.user.update({ where: { id: manager.id }, data: { passwordHash: await hash(password, 12) } });
  revalidatePath("/admin/stores");
}

export async function saveStoreProfile(data: FormData) {
  const actor = await requireActor([Role.STORE_ADMIN]);
  const schema = z.object({ name: z.string().min(1, "请填写店铺名称"), logoUrl: optionalUrl, phone, address: z.string().min(1, "请填写店铺地址") });
  const parsed = schema.safeParse({ name: text(data, "name"), logoUrl: text(data, "logoUrl"), phone: text(data, "phone"), address: text(data, "address") });
  if (!parsed.success) fail("/admin/store", fieldError(parsed.error));
  const cardWechat = cardWechatSchema.safeParse(text(data,"cardWechat"));
  if (!cardWechat.success) fail("/admin/store", fieldError(cardWechat.error));
  const defaultCardJson = JSON.stringify({ name: text(data,"cardName") || parsed.data.name, phone: text(data,"cardPhone") || parsed.data.phone, wechat: cardWechat.data, title: text(data,"cardTitle") || "店铺顾问", bio: text(data,"cardBio") || parsed.data.address, avatarUrl: text(data,"cardAvatarUrl") || parsed.data.logoUrl || null, shareCode: null });
  await db.store.update({ where: { id: actor.storeId! }, data: { ...parsed.data, logoUrl: parsed.data.logoUrl || null, defaultCardJson } });
  revalidatePath("/admin/store"); revalidatePath(`/s/${actor.store!.slug}`);
}

const employeeSchema = z.object({
  name: z.string().min(1, "请填写员工姓名"), username: z.string().min(3, "登录账号至少 3 个字符"), phone,
  wechat: cardWechatSchema, title: z.string().max(30, "职位不能超过 30 个字符"),
  bio: z.string().max(90, "名片文案不能超过 90 个字符"), avatarUrl: optionalUrl,
});

export async function saveMyCard(data:FormData){const actor=await requireActor([Role.STORE_ADMIN,Role.EMPLOYEE]);const parsed=employeeSchema.safeParse({name:text(data,"name"),username:actor.username,phone:text(data,"phone"),wechat:text(data,"wechat"),title:text(data,"title"),bio:text(data,"bio"),avatarUrl:text(data,"avatarUrl")});if(!parsed.success)fail("/admin/share",fieldError(parsed.error));await db.user.update({where:{id:actor.id},data:{name:parsed.data.name,phone:parsed.data.phone,wechat:parsed.data.wechat,title:parsed.data.title,bio:parsed.data.bio,avatarUrl:parsed.data.avatarUrl||null,shareCode:actor.shareCode??randomUUID()}});revalidatePath("/admin/share");revalidatePath(`/s/${actor.store!.slug}`)}

export async function saveEmployee(data: FormData) {
  const actor = await requireActor([Role.STORE_ADMIN]);
  const path = "/admin/employees";
  const parsed = employeeSchema.safeParse({ name: text(data, "name"), username: text(data, "username"), phone: text(data, "phone"), wechat: text(data, "wechat"), title: text(data, "title"), bio: text(data, "bio"), avatarUrl: text(data, "avatarUrl") });
  if (!parsed.success) fail(path, fieldError(parsed.error));
  const id = text(data, "id");
  if (id) {
    const current = await db.user.findFirst({ where: { id, storeId: actor.storeId, role: Role.EMPLOYEE } });
    if (!current) fail(path, "员工不存在");
    await db.user.update({ where: { id }, data: { ...parsed.data, avatarUrl: parsed.data.avatarUrl || null } }).catch(() => fail(path, "登录账号已存在"));
  } else {
    const password = text(data, "password");
    if (password.length < 8) fail(path, "初始密码至少 8 个字符");
    const [store, employeeCount] = await Promise.all([db.store.findUnique({ where: { id: actor.storeId! }, select: { employeeLimit: true } }), db.user.count({ where: { storeId: actor.storeId, role: Role.EMPLOYEE } })]);
    if (!store || employeeCount >= store.employeeLimit) fail(path, `员工账号已达到上限（${store?.employeeLimit ?? 0}）`);
    await db.user.create({ data: { ...parsed.data, avatarUrl: parsed.data.avatarUrl || null, role: Role.EMPLOYEE, passwordHash: await hash(password, 12), shareCode: randomUUID(), storeId: actor.storeId! } }).catch(() => fail(path, "登录账号已存在"));
  }
  revalidatePath(path);
}

export async function toggleEmployee(data: FormData) {
  const actor = await requireActor([Role.STORE_ADMIN]);
  const employee = await db.user.findFirst({ where: { id: text(data, "id"), storeId: actor.storeId, role: Role.EMPLOYEE } });
  if (!employee) return;
  const updated = await db.user.update({ where: { id: employee.id }, data: { isActive: !employee.isActive } });
  if (!updated.isActive) await audit({ actorId: actor.id, storeId: actor.storeId, action: "停用员工", entityType: "User", entityId: employee.id, before: { isActive: true }, after: { isActive: false } });
  revalidatePath("/admin/employees");
}

export async function saveCategory(data: FormData) {
  const actor = await requireActor([Role.STORE_ADMIN]);
  const storeId = actor.storeId!;
  const name = text(data, "name");
  const sort = Number(text(data, "sort") || 0);
  if (!name) fail("/admin/categories", "请填写分类名称");
  const id = text(data, "id");
  if (id) {
    const found = await db.category.findFirst({ where: { id, storeId } });
    if (!found) fail("/admin/categories", "分类不存在");
    await db.category.update({ where: { id }, data: { name, sort } }).catch(() => fail("/admin/categories", "分类名称已存在"));
  } else {
    await db.category.create({ data: { name, sort, storeId } }).catch(() => fail("/admin/categories", "分类名称已存在"));
  }
  revalidatePath("/admin/categories");
}

export async function toggleCategory(data: FormData) {
  const actor = await requireActor([Role.STORE_ADMIN]);
  const found = await db.category.findFirst({ where: { id: text(data, "id"), storeId: actor.storeId! } });
  if (found) await db.category.update({ where: { id: found.id }, data: { isActive: !found.isActive } });
  revalidatePath("/admin/categories");
}

export async function deleteCategory(data: FormData) {
  const actor = await requireActor([Role.STORE_ADMIN]);
  const found = await db.category.findFirst({ where: { id: text(data, "id"), storeId: actor.storeId! }, include: { _count: { select: { products: true } } } });
  if (!found) return;
  if (found._count.products) fail("/admin/categories", "分类下仍有商品，请先移动商品或停用分类");
  await db.category.delete({ where: { id: found.id } });
  revalidatePath("/admin/categories");
}

const productSchema = z.object({
  name: z.string().min(1, "请填写商品名称"), code: z.string().min(1, "请填写商品编码"), categoryId: z.string().min(1, "请选择分类"),
  mainImageUrl: z.string().url("主图必须是有效的图片 URL"), detailImageUrls: z.string(), specification: z.string().min(1, "请填写规格/型号"),
  price: z.union([z.literal(""), z.coerce.number().min(0, "价格不能小于 0")]), referenceStock: z.union([z.literal(""), z.coerce.number().int().min(0, "参考库存不能小于 0")]), unit: z.string().min(1, "请填写单位"), description: z.string(), sort: z.coerce.number().int(),
});

export async function saveProduct(data: FormData) {
  const actor = await requireActor([Role.STORE_ADMIN, Role.PLATFORM_ADMIN]);
  const storeId = await getCatalogStore(actor);
  if (!storeId) fail("/admin/products", "请先选择代运营店铺");
  const path = "/admin/products";
  const parsed = productSchema.safeParse({ name: text(data, "name"), code: text(data, "code"), categoryId: text(data, "categoryId"), mainImageUrl: text(data, "mainImageUrl"), detailImageUrls: text(data, "detailImageUrls"), specification: text(data, "specification"), price: text(data, "price"), referenceStock: text(data, "referenceStock"), unit: text(data, "unit"), description: text(data, "description"), sort: text(data, "sort") || "0" });
  if (!parsed.success) fail(path, fieldError(parsed.error));
  const category = await db.category.findFirst({ where: { id: parsed.data.categoryId, storeId } });
  if (!category) fail(path, "所选分类不存在");
  const values = { ...parsed.data, price: parsed.data.price === "" ? null : parsed.data.price, referenceStock: parsed.data.referenceStock === "" ? null : parsed.data.referenceStock };
  const id = text(data, "id");
  if (id) {
    const current = await db.product.findFirst({ where: { id, storeId } });
    if (!current) fail(path, "商品不存在");
    const update = current.source === "ENTERPRISE" ? { categoryId: values.categoryId, price: values.price, referenceStock: values.referenceStock, sort: values.sort } : values;
    await db.$transaction(async (tx) => { await tx.product.update({ where: { id }, data: update }); const variant = await tx.productVariant.findFirst({ where: { productId: id }, orderBy: { sort: "asc" } }); if (variant && current.source !== "ENTERPRISE") await tx.productVariant.update({ where: { id: variant.id }, data: { name: values.specification, price: values.price, referenceStock: values.referenceStock } }); }).catch(() => fail(path, "商品编码已存在"));
  } else {
    await db.product.create({ data: { ...values, storeId, isPublished: false, variants: { create: { name: values.specification, code: `${values.code}-DEFAULT`, price: values.price, referenceStock: values.referenceStock } } } }).catch(() => fail(path, "商品编码已存在"));
  }
  revalidatePath(path);
}

export async function toggleProduct(data: FormData) {
  const actor = await requireActor([Role.STORE_ADMIN, Role.PLATFORM_ADMIN]);
  const storeId = await getCatalogStore(actor);
  if (!storeId) fail("/admin/products", "请先选择代运营店铺");
  const product = await db.product.findFirst({ where: { id: text(data, "id"), storeId, isDeleted: false }, include: { category: true, authorization: true, store: true } });
  if (!product) return;
  if (!product.isPublished && (!product.category?.isActive || (product.source === "ENTERPRISE" && product.authorization?.status !== "ACTIVE"))) fail("/admin/products", "商品未分类、分类已停用或企业授权已失效，不能上架");
  const updated = await db.product.update({ where: { id: product.id }, data: { isPublished: !product.isPublished } });
  await audit({ actorId: actor.id, storeId, action: updated.isPublished ? "商品上架" : "商品下架", entityType: "Product", entityId: product.id, before: { isPublished: product.isPublished }, after: { isPublished: updated.isPublished } });
  revalidatePath("/admin/products"); revalidatePath(`/s/${product.store.slug}`);
}

export async function saveOrderSalesInfo(data: FormData) {
  const actor = await requireActor([Role.STORE_ADMIN]);
  const id = text(data, "id");
  const path = `/admin/orders/${id}`;
  const order = await db.order.findFirst({ where: { id, storeId: actor.storeId! }, include: { items: true } });
  if (!order) fail("/admin/orders", "订单不存在");
  let shippingFee: string;
  let installationFee: string;
  const itemValues: Array<{ id: string; salePrice: string | null; color: string; remark: string }> = [];
  try {
    shippingFee = moneyInput(text(data, "shippingFee"), "运费");
    installationFee = moneyInput(text(data, "installationFee"), "安装费");
    for (const item of order.items) {
      const salePrice = moneyInput(text(data, `salePrice:${item.id}`), `${item.productName}的成交单价`, true);
      const color = text(data, `color:${item.id}`);
      const remark = text(data, `remark:${item.id}`);
      if (color.length > 50) throw new Error("颜色不能超过 50 个字符");
      if (remark.length > 200) throw new Error("商品备注不能超过 200 个字符");
      if (order.status === OrderStatus.WON && salePrice == null) throw new Error("已成交订单的每件商品都必须填写成交单价");
      itemValues.push({ id: item.id, salePrice, color, remark });
    }
  } catch (error) {
    fail(path, error instanceof Error ? error.message : "销售单信息不正确");
  }
  const changes: Array<{ orderId: string; actorId: string; field: string; beforeValue: string | null; afterValue: string | null }> = [];
  const before = { shippingFee: order.shippingFee.toString(), installationFee: order.installationFee.toString(), items: order.items.map((item) => ({ id: item.id, salePrice: item.salePrice?.toString() ?? null, color: item.color, remark: item.remark })) };
  if (order.shippingFee.toString() !== shippingFee!) changes.push({ orderId: id, actorId: actor.id, field: "shippingFee", beforeValue: order.shippingFee.toString(), afterValue: shippingFee! });
  if (order.installationFee.toString() !== installationFee!) changes.push({ orderId: id, actorId: actor.id, field: "installationFee", beforeValue: order.installationFee.toString(), afterValue: installationFee! });
  await db.$transaction(async (tx) => {
    await tx.order.update({ where: { id }, data: { shippingFee: shippingFee!, installationFee: installationFee! } });
    for (const value of itemValues) {
      const current = order.items.find((item) => item.id === value.id)!;
      const fields = [["salePrice", current.salePrice?.toString() ?? null, value.salePrice], ["color", current.color, value.color], ["remark", current.remark, value.remark]] as const;
      for (const [field, beforeValue, afterValue] of fields) if (beforeValue !== afterValue) changes.push({ orderId: id, actorId: actor.id, field: `item.${value.id}.${field}`, beforeValue, afterValue });
      await tx.orderItem.update({ where: { id: value.id }, data: { salePrice: value.salePrice, color: value.color, remark: value.remark } });
    }
    if (changes.length) await tx.orderChange.createMany({ data: changes });
  });
  const after = { shippingFee: shippingFee!, installationFee: installationFee!, items: itemValues };
  if (changes.length) await audit({ actorId: actor.id, storeId: actor.storeId, action: "编辑销售单信息", entityType: "Order", entityId: id, before, after });
  revalidatePath(path);
}

export async function updateOrderStatus(data: FormData) {
  const actor = await requireActor([Role.STORE_ADMIN]);
  const id = text(data, "id");
  const status = z.nativeEnum(OrderStatus).safeParse(text(data, "status"));
  if (!status.success) fail(`/admin/orders/${id}`, "订单状态不正确");
  const order = await db.order.findFirst({ where: { id, storeId: actor.storeId! }, include: { items: true } });
  if (!order) fail("/admin/orders", "订单不存在");
  if (status.data === OrderStatus.WON && order.items.some((item) => item.salePrice == null)) fail(`/admin/orders/${id}`, "请先补齐每件商品的成交单价");
  if (order.status !== status.data) {
    await db.$transaction([db.order.update({ where: { id }, data: { status: status.data, ...(status.data === OrderStatus.WON && !order.soldAt ? { soldAt: new Date() } : {}) } }), db.orderChange.create({ data: { orderId: id, actorId: actor.id, field: "status", beforeValue: order.status, afterValue: status.data } })]);
    await audit({ actorId: actor.id, storeId: actor.storeId, action: "订单状态变更", entityType: "Order", entityId: id, before: { status: order.status }, after: { status: status.data } });
  }
  revalidatePath(`/admin/orders/${id}`); revalidatePath("/admin/orders");
}

export async function addOrderNote(data: FormData) {
  const actor = await requireActor([Role.STORE_ADMIN, Role.EMPLOYEE]);
  const id = text(data, "id");
  const content = text(data, "content");
  if (!content) fail(`/admin/orders/${id}`, "请填写备注内容");
  const order = await db.order.findFirst({ where: { id, ...orderScope(actor) } });
  if (!order) fail("/admin/orders", "订单不存在或无权访问");
  await db.orderNote.create({ data: { orderId: id, authorId: actor.id, content } });
  revalidatePath(`/admin/orders/${id}`);
}
