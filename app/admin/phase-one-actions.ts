"use server";

import { AuthorizationStatus, CustomerStatus, ProductSource, Role } from "@prisma/client";
import { hash } from "bcryptjs";
import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActor } from "@/lib/authz";
import { db } from "@/lib/db";
import { parsePageConfig, blankPageConfig, homeTemplateConfig, validatePageConfigForStore, type PageConfigV2 } from "@/lib/page-config";
import { buildPageCopyData, publicPagePath } from "@/lib/page-management";
import { canApplyLiangchenHomeTemplate, LIANGCHEN_CONTENT_PAGES, liangchenContentPageConfig, liangchenHomeConfig, missingLiangchenContentPages } from "@/lib/liangchen-template";

const value = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const fail = (path: string, message: string): never => redirect(`${path}?error=${encodeURIComponent(message)}`);

async function audit(actorId: string, action: string, entityType: string, entityId: string, storeId?: string | null, after?: unknown) {
  await db.auditLog.create({ data: { actorId, action, entityType, entityId, storeId: storeId ?? null, afterJson: after ? JSON.stringify(after) : null } });
}

export async function createEnterprise(data: FormData) {
  const actor = await requireActor([Role.PLATFORM_ADMIN]);
  const parsed = z.object({ name: z.string().min(1), code: z.string().regex(/^[a-z0-9-]{3,30}$/), managerName: z.string().min(1), username: z.string().min(3), password: z.string().min(8) }).safeParse(Object.fromEntries(data));
  if (!parsed.success) fail("/admin/organizations", parsed.error.issues[0]?.message ?? "内容不正确");
  const input = parsed.data!;
  const created = await db.$transaction(async (tx) => {
    const enterprise = await tx.enterprise.create({ data: { name: input.name, code: input.code } });
    await tx.user.create({ data: { name: input.managerName, username: input.username, passwordHash: await hash(input.password, 12), role: Role.ENTERPRISE_ADMIN, enterpriseId: enterprise.id } });
    return enterprise;
  }).catch(() => null);
  if (!created) fail("/admin/organizations", "企业编码或账号已存在");
  await audit(actor.id, "创建企业", "Enterprise", created!.id, null, { name: created!.name });
  revalidatePath("/admin/organizations");
}

export async function configureStore(data: FormData) {
  const actor = await requireActor([Role.PLATFORM_ADMIN]);
  const id = value(data, "id");
  const parsed = z.object({ adminLimit: z.coerce.number().int().min(1).max(20), employeeLimit: z.coerce.number().int().min(1).max(1000) }).safeParse({ adminLimit: value(data, "adminLimit"), employeeLimit: value(data, "employeeLimit") });
  if (!parsed.success) fail("/admin/organizations", "账号配额不正确");
  const updated = await db.store.update({ where: { id }, data: { ...parsed.data, pageEnabled: data.get("pageEnabled") === "on", authorizationEnabled: data.get("authorizationEnabled") === "on", customerEnabled: data.get("customerEnabled") === "on", analyticsEnabled: data.get("analyticsEnabled") === "on" } }).catch(() => null);
  if (!updated) fail("/admin/organizations", "店铺不存在");
  await audit(actor.id, "配置店铺配额与功能", "Store", id, id, parsed.data);
  revalidatePath("/admin/organizations");
}

export async function createStoreAdmin(data:FormData){await requireActor([Role.PLATFORM_ADMIN]);const storeId=value(data,"storeId");const store=await db.store.findUnique({where:{id:storeId}});if(!store)fail("/admin/organizations","店铺不存在");const limit=store!.adminLimit;const count=await db.user.count({where:{storeId,role:Role.STORE_ADMIN}});if(count>=limit)fail("/admin/organizations",`店铺管理员已达到上限（${limit}）`);const name=value(data,"name");const username=value(data,"username");const password=value(data,"password");if(!name||username.length<3||password.length<8)fail("/admin/organizations","管理员信息不正确");await db.user.create({data:{storeId,role:Role.STORE_ADMIN,name,username,passwordHash:await hash(password,12)}}).catch(()=>fail("/admin/organizations","登录账号已存在"));revalidatePath("/admin/organizations")}

export async function toggleManagedUser(data:FormData){const actor=await requireActor([Role.PLATFORM_ADMIN]);const id=value(data,"id");const user=await db.user.findFirst({where:{id,role:{in:[Role.ENTERPRISE_ADMIN,Role.STORE_ADMIN,Role.EMPLOYEE]}}});if(!user)return;await db.user.update({where:{id},data:{isActive:!user.isActive}});await audit(actor.id,user.isActive?"停用账号":"启用账号","User",id,user.storeId);revalidatePath("/admin/organizations")}

export async function enterStoreSupport(data: FormData) {
  const actor = await requireActor([Role.PLATFORM_ADMIN]);
  const id = value(data, "id");
  const store = await db.store.findFirst({ where: { id, isActive: true } });
  if (!store) fail("/admin/stores", "店铺不存在或已停用");
  (await cookies()).set("supportStoreId", id, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 2 });
  await audit(actor.id, "进入店铺代运营", "Store", id, id);
  redirect("/admin/pages");
}

export async function leaveStoreSupport() {
  const actor = await requireActor([Role.PLATFORM_ADMIN]);
  (await cookies()).delete("supportStoreId");
  await audit(actor.id, "退出店铺代运营", "Store", "support");
  redirect("/admin/stores");
}

export async function saveEnterpriseSeries(data: FormData) {
  const actor = await requireActor([Role.ENTERPRISE_ADMIN]);
  const name = value(data, "name");
  if (!name) fail("/admin/enterprise/products", "请填写系列名称");
  await db.enterpriseSeries.create({ data: { enterpriseId: actor.enterpriseId!, name } }).catch(() => fail("/admin/enterprise/products", "系列名称已存在"));
  revalidatePath("/admin/enterprise/products");
}

export async function saveEnterpriseProduct(data: FormData) {
  const actor = await requireActor([Role.ENTERPRISE_ADMIN]);
  const path = "/admin/enterprise/products";
  const parsed = z.object({ seriesId: z.string().min(1), name: z.string().min(1), code: z.string().min(1), mainImageUrl: z.string().url(), description: z.string(), unit: z.string().min(1), suggestedPrice: z.union([z.literal(""), z.coerce.number().min(0)]), variantName: z.string().min(1), variantCode: z.string().min(1) }).safeParse({ seriesId: value(data, "seriesId"), name: value(data, "name"), code: value(data, "code"), mainImageUrl: value(data, "mainImageUrl"), description: value(data, "description"), unit: value(data, "unit"), suggestedPrice: value(data, "suggestedPrice"), variantName: value(data, "variantName"), variantCode: value(data, "variantCode") });
  if (!parsed.success) fail(path, parsed.error.issues[0]?.message ?? "商品内容不正确");
  const input = parsed.data!; const enterpriseId = actor.enterpriseId!;
  const series = await db.enterpriseSeries.findFirst({ where: { id: input.seriesId, enterpriseId } });
  if (!series) fail(path, "系列不存在");
  await db.enterpriseProduct.create({ data: { seriesId: series!.id, name: input.name, code: input.code, mainImageUrl: input.mainImageUrl, description: input.description, unit: input.unit, suggestedPrice: input.suggestedPrice === "" ? null : input.suggestedPrice, variants: { create: { name: input.variantName, code: input.variantCode, suggestedPrice: input.suggestedPrice === "" ? null : input.suggestedPrice } } } }).catch(() => fail(path, "产品或规格编码已存在"));
  revalidatePath(path);
}

export async function createAuthorization(data: FormData) {
  const actor = await requireActor([Role.ENTERPRISE_ADMIN]);
  const seriesId = value(data, "seriesId"); const storeId = value(data, "storeId");
  const enterpriseId = actor.enterpriseId!;
  const [series, store] = await Promise.all([db.enterpriseSeries.findFirst({ where: { id: seriesId, enterpriseId, isActive: true } }), db.store.findFirst({ where: { id: storeId, isActive: true, authorizationEnabled: true } })]);
  if (!series || !store) fail("/admin/enterprise/products", "系列或目标店铺不可用");
  await db.productAuthorization.upsert({ where: { seriesId_storeId: { seriesId, storeId } }, create: { enterpriseId, seriesId, storeId }, update: { status: AuthorizationStatus.PENDING } });
  revalidatePath("/admin/enterprise/products");
}

export async function decideAuthorization(data: FormData) {
  const actor = await requireActor([Role.STORE_ADMIN]);
  const id = value(data, "id"); const decision = value(data, "decision");
  const storeId = actor.storeId!;
  const authorization = await db.productAuthorization.findFirst({ where: { id, storeId }, include: { series: { include: { products: { where: { isActive: true }, include: { variants: true } } } } } });
  if (!authorization || authorization.status !== AuthorizationStatus.PENDING) fail("/admin/authorizations", "授权申请不存在");
  if (decision === "reject") {
    await db.productAuthorization.update({ where: { id }, data: { status: AuthorizationStatus.REJECTED } });
  } else {
    await db.$transaction(async (tx) => {
      await tx.productAuthorization.update({ where: { id }, data: { status: AuthorizationStatus.ACTIVE } });
      for (const source of authorization!.series.products) {
        const product = await tx.product.create({ data: { storeId, authorizationId: id, enterpriseProductId: source.id, source: ProductSource.ENTERPRISE, name: source.name, code: source.code, mainImageUrl: source.mainImageUrl, detailImageUrls: source.detailImageUrls, specification: source.variants[0]?.name ?? "默认规格", price: source.suggestedPrice, unit: source.unit, description: source.description, variants: { create: source.variants.map((variant) => ({ name: variant.name, code: variant.code, price: variant.suggestedPrice, enterpriseVariantId: variant.id })) } } });
        await tx.productSyncLog.create({ data: { authorizationId: id, action: "ACCEPT_CREATE", detailJson: JSON.stringify({ productId: product.id, sourceId: source.id }) } });
      }
    }).catch(() => fail("/admin/authorizations", "接受失败：店铺中可能已有相同商品编码"));
  }
  await audit(actor.id, decision === "reject" ? "拒绝商品授权" : "接受商品授权", "ProductAuthorization", id, actor.storeId);
  revalidatePath("/admin/authorizations"); revalidatePath("/admin/products");
}

export async function revokeAuthorization(data: FormData) {
  const actor = await requireActor([Role.ENTERPRISE_ADMIN]);
  const id = value(data, "id");
  const authorization = await db.productAuthorization.findFirst({ where: { id, enterpriseId: actor.enterpriseId! } });
  if (!authorization) return;
  await db.$transaction([
    db.productAuthorization.update({ where: { id }, data: { status: AuthorizationStatus.REVOKED } }),
    db.product.updateMany({ where: { authorizationId: id }, data: { isPublished: false } }),
    db.productSyncLog.create({ data: { authorizationId: id, action: "REVOKE", detailJson: "{}" } }),
  ]);
  revalidatePath("/admin/enterprise/products");
}

export async function syncEnterpriseCatalog() {
  const actor=await requireActor([Role.ENTERPRISE_ADMIN]);const enterpriseId=actor.enterpriseId!;
  const authorizations=await db.productAuthorization.findMany({where:{enterpriseId,status:AuthorizationStatus.ACTIVE},include:{series:{include:{products:{include:{variants:true}}}},products:{include:{variants:true}}}});
  for(const authorization of authorizations){await db.$transaction(async tx=>{for(const source of authorization.series.products){const target=authorization.products.find(item=>item.enterpriseProductId===source.id);if(!target){await tx.product.create({data:{storeId:authorization.storeId,authorizationId:authorization.id,enterpriseProductId:source.id,source:ProductSource.ENTERPRISE,name:source.name,code:source.code,mainImageUrl:source.mainImageUrl,detailImageUrls:source.detailImageUrls,specification:source.variants[0]?.name??"默认规格",price:source.suggestedPrice,unit:source.unit,description:source.description,isPublished:false,variants:{create:source.variants.map(v=>({name:v.name,code:v.code,price:v.suggestedPrice,enterpriseVariantId:v.id}))}}});continue}await tx.product.update({where:{id:target.id},data:{name:source.name,mainImageUrl:source.mainImageUrl,detailImageUrls:source.detailImageUrls,description:source.description,unit:source.unit,specification:source.variants[0]?.name??target.specification,...(!source.isActive?{isPublished:false}:{})}});for(const variant of source.variants){const storeVariant=target.variants.find(v=>v.enterpriseVariantId===variant.id);if(storeVariant)await tx.productVariant.update({where:{id:storeVariant.id},data:{name:variant.name,code:variant.code}});else await tx.productVariant.create({data:{productId:target.id,name:variant.name,code:variant.code,price:variant.suggestedPrice,enterpriseVariantId:variant.id}})}}await tx.productSyncLog.create({data:{authorizationId:authorization.id,action:"SYNC",detailJson:JSON.stringify({at:new Date().toISOString()})}})}).catch(()=>null)}
  revalidatePath("/admin/enterprise/products");
}

export async function createPage(data: FormData) {
  const actor = await requireActor([Role.STORE_ADMIN, Role.PLATFORM_ADMIN]);
  const storeId = actor.role === Role.STORE_ADMIN ? actor.storeId! : (await cookies()).get("supportStoreId")?.value;
  if (!storeId) fail("/admin/pages", "请先选择代运营店铺");
  const title = value(data, "title"); const slug = value(data, "slug"); const category = value(data, "category") || "普通页面";
  if (!title || !/^[a-z0-9-]{2,40}$/.test(slug)) fail("/admin/pages", "页面名称或标识不正确");
  const targetStoreId = storeId!;
  const config = value(data, "template") === "home" ? homeTemplateConfig() : blankPageConfig();
  await db.storePage.create({ data: { storeId: targetStoreId, title, slug, category, draftJson: JSON.stringify(config) } }).catch(() => fail("/admin/pages", "页面标识已存在"));
  await audit(actor.id, "创建页面草稿", "StorePage", slug, targetStoreId);
  revalidatePath("/admin/pages");
}

export async function duplicatePage(data: FormData) {
  const actor = await requireActor([Role.STORE_ADMIN, Role.PLATFORM_ADMIN]);
  const id = value(data, "id");
  const storeId = actor.role === Role.STORE_ADMIN ? actor.storeId : (await cookies()).get("supportStoreId")?.value;
  if (!storeId) fail("/admin/pages", "请先选择代运营店铺");
  const targetStoreId = storeId!;
  const page = await db.storePage.findFirst({ where: { id, storeId: targetStoreId } });
  if (!page) fail("/admin/pages", "页面不存在");
  const pages = await db.storePage.findMany({ where: { storeId: targetStoreId }, select: { slug: true } });
  const copy = buildPageCopyData(page!, new Set(pages.map((item) => item.slug)));
  const created = await db.storePage.create({ data: { storeId: targetStoreId, ...copy } }).catch(() => null);
  if (!created) fail("/admin/pages", "复制失败，请重试");
  await audit(actor.id, "复制页面草稿", "StorePage", created!.id, targetStoreId, { sourcePageId: page!.id, title: created!.title, slug: created!.slug });
  revalidatePath("/admin/pages");
}

export async function deletePage(data: FormData) {
  const actor = await requireActor([Role.STORE_ADMIN, Role.PLATFORM_ADMIN]);
  const id = value(data, "id");
  const storeId = actor.role === Role.STORE_ADMIN ? actor.storeId : (await cookies()).get("supportStoreId")?.value;
  if (!storeId) fail("/admin/pages", "请先选择代运营店铺");
  const targetStoreId = storeId!;
  const page = await db.storePage.findFirst({ where: { id, storeId: targetStoreId }, include: { store: { select: { slug: true } } } });
  if (!page) fail("/admin/pages", "页面不存在");
  if (page!.isHome) fail("/admin/pages", "当前主页不能删除，请先将其他已发布页面设为主页");
  const deleted = await db.storePage.deleteMany({ where: { id, storeId: targetStoreId, isHome: false } });
  if (!deleted.count) fail("/admin/pages", "页面状态已变化，请刷新后重试");
  await audit(actor.id, "删除页面", "StorePage", id, targetStoreId, { title: page!.title, slug: page!.slug });
  revalidatePath("/admin/pages");
  revalidatePath(publicPagePath(page!.store.slug, page!.slug, false));
}

async function checkedPageConfig(raw: unknown, storeId: string, home: boolean, publishing = false) {
  const config = parsePageConfig(raw);
  const [products, categories, pages] = await Promise.all([
    db.product.findMany({ where: { storeId }, select: { id: true } }),
    db.category.findMany({ where: { storeId }, select: { id: true } }),
    db.storePage.findMany({ where: { storeId, ...(publishing ? { publishedAt: { not: null }, publishedJson: { not: null } } : {}) }, select: { id: true, title: true } }),
  ]);
  if (publishing) {
    const availablePageIds = new Set(pages.map((item) => item.id));
    const referenced = config.components.flatMap((component) => component.type === "quickNav" ? component.items.map((item) => item.pageId).filter((pageId): pageId is string => Boolean(pageId)) : component.type === "imageAd" ? component.items.flatMap((item) => item.target?.type === "page" ? [item.target.pageId] : []) : []);
    const missingIds = [...new Set(referenced.filter((pageId) => !availablePageIds.has(pageId)))];
    if (missingIds.length) {
      const missing = await db.storePage.findMany({ where: { storeId, id: { in: missingIds } }, select: { title: true } });
      throw new Error(`请先发布快捷入口页面：${missing.map((item) => item.title).join("、") || "目标页面"}`);
    }
  }
  return validatePageConfigForStore(config, { productIds: new Set(products.map((item) => item.id)), categoryIds: new Set(categories.map((item) => item.id)), pageIds: new Set(pages.map((item) => item.id)) }, home);
}

export async function savePageDraft(data: FormData) {
  const actor = await requireActor([Role.STORE_ADMIN, Role.PLATFORM_ADMIN]);
  const id = value(data, "id"); const path = `/admin/pages/${id}`;
  const storeId = actor.role === Role.STORE_ADMIN ? actor.storeId : (await cookies()).get("supportStoreId")?.value;
  const page = await db.storePage.findFirst({ where: { id, storeId: storeId ?? "" } });
  if (!page) fail("/admin/pages", "页面不存在");
  let config;
  try { config = await checkedPageConfig(value(data, "config"), page!.storeId, page!.isHome); } catch (error) { fail(path, error instanceof Error ? error.message : "页面组件配置格式不正确"); }
  await db.storePage.update({ where: { id }, data: { draftJson: JSON.stringify(config) } });
  await audit(actor.id, "保存页面草稿", "StorePage", id, storeId);
  revalidatePath(path);
  redirect(`${path}?notice=${encodeURIComponent("草稿已保存")}`);
}

export async function publishPage(data: FormData) {
  const actor = await requireActor([Role.STORE_ADMIN, Role.PLATFORM_ADMIN]);
  const id = value(data, "id"); const makeHome = value(data, "makeHome") === "true";
  const storeId = actor.role === Role.STORE_ADMIN ? actor.storeId : (await cookies()).get("supportStoreId")?.value;
  const page = await db.storePage.findFirst({ where: { id, storeId: storeId ?? "" }, include: { store: { select: { slug: true } } } });
  if (!page) fail("/admin/pages", "页面不存在");
  const activePage = page!; const submitted = value(data, "config") || activePage.draftJson;
  let clean: PageConfigV2;
  try { clean = await checkedPageConfig(submitted, activePage.storeId, makeHome || activePage.isHome, true); } catch (error) { fail(`/admin/pages/${id}`, error instanceof Error ? error.message : "页面组件配置格式不正确"); }
  await db.$transaction(async (tx) => {
    if (makeHome) await tx.storePage.updateMany({ where: { storeId: activePage.storeId }, data: { isHome: false } });
    await tx.storePage.update({ where: { id }, data: { draftJson: JSON.stringify(clean), publishedJson: JSON.stringify(clean), publishedAt: new Date(), isHome: makeHome || activePage.isHome } });
  });
  await audit(actor.id, "发布页面", "StorePage", id, storeId, { isHome: makeHome || activePage.isHome });
  revalidatePath("/admin/pages");
  revalidatePath(`/admin/pages/${id}`);
  revalidatePath(`/s/${activePage.store.slug}`);
  revalidatePath(publicPagePath(activePage.store.slug, activePage.slug, false));
  redirect(`/admin/pages/${id}?notice=${encodeURIComponent(makeHome ? "当前版本已发布并设为主页" : "当前版本已发布")}`);
}

export async function applyLiangchenHomeTemplate(data: FormData) {
  const actor = await requireActor([Role.STORE_ADMIN, Role.PLATFORM_ADMIN]);
  const id = value(data, "id");
  const storeId = actor.role === Role.STORE_ADMIN ? actor.storeId : (await cookies()).get("supportStoreId")?.value;
  const page = await db.storePage.findFirst({ where: { id, storeId: storeId ?? "" }, include: { store: { select: { slug: true } } } });
  if (!page) fail("/admin/pages", "页面不存在");
  const activePage = page!;
  if (!canApplyLiangchenHomeTemplate(activePage)) fail(`/admin/pages/${id}`, "请在当前主页上应用良丞首页模板");
  const categories = await db.category.findMany({ where: { storeId: activePage.storeId, isActive: true }, orderBy: { sort: "asc" }, select: { id: true } });
  if (!categories.length) fail(`/admin/pages/${id}`, "请先创建至少一个有效商品分类");
  await db.$transaction(async (tx) => {
    const slugs = LIANGCHEN_CONTENT_PAGES.map((definition) => definition.slug);
    const existing = await tx.storePage.findMany({ where: { storeId: activePage.storeId, slug: { in: [...slugs] } }, select: { id: true, slug: true } });
    const bySlug = new Map(existing.map((item) => [item.slug, item.id]));
    for (const definition of missingLiangchenContentPages(bySlug.keys())) {
      const created = await tx.storePage.create({ data: { storeId: activePage.storeId, title: definition.title, slug: definition.slug, category: "品牌内容", draftJson: JSON.stringify(liangchenContentPageConfig(definition)) } });
      bySlug.set(created.slug, created.id);
    }
    const config = liangchenHomeConfig(categories.map((category) => category.id), bySlug);
    await tx.storePage.update({ where: { id: activePage.id }, data: { draftJson: JSON.stringify(config) } });
  });
  await audit(actor.id, "应用良丞首页模板", "StorePage", activePage.id, activePage.storeId);
  revalidatePath("/admin/pages");
  revalidatePath(`/admin/pages/${activePage.id}`);
  redirect(`/admin/pages/${activePage.id}?notice=${encodeURIComponent("良丞模板已应用到草稿，请先发布五个内容页，再发布首页")}`);
}

export async function setHomePage(data: FormData) {
  const actor = await requireActor([Role.STORE_ADMIN, Role.PLATFORM_ADMIN]);
  const id = value(data, "id");
  const storeId = actor.role === Role.STORE_ADMIN ? actor.storeId : (await cookies()).get("supportStoreId")?.value;
  const page = await db.storePage.findFirst({ where: { id, storeId: storeId ?? "", publishedAt: { not: null }, publishedJson: { not: null } } });
  if (!page) fail("/admin/pages", "只有已发布页面可以设为主页");
  await checkedPageConfig(page!.publishedJson!, page!.storeId, true).catch((error) => fail("/admin/pages", error instanceof Error ? error.message : "主页配置不完整"));
  await db.$transaction([
    db.storePage.updateMany({ where: { storeId: page!.storeId }, data: { isHome: false } }),
    db.storePage.update({ where: { id }, data: { isHome: true } }),
  ]);
  await audit(actor.id, "设为店铺主页", "StorePage", id, storeId);
  revalidatePath("/admin/pages");
  revalidatePath(`/s/${(await db.store.findUnique({ where: { id: page!.storeId }, select: { slug: true } }))?.slug}`);
}

export async function approveCustomer(data: FormData) {
  const actor = await requireActor([Role.STORE_ADMIN, Role.EMPLOYEE]);
  const id = value(data, "id"); const approve = value(data, "decision") === "approve";
  const profile = await db.customerProfile.findFirst({ where: { id, storeId: actor.storeId!, status: { in: [CustomerStatus.PENDING, CustomerStatus.RESET_PENDING] }, ...(actor.role === Role.EMPLOYEE ? { sourceEmployeeId: actor.id } : {}) } });
  if (!profile) fail("/admin/customers", "申请不存在或无权审核");
  const activeProfile = profile!; const resetRequest = activeProfile.status === CustomerStatus.RESET_PENDING; const resetApproved = resetRequest && approve;
  const customer = resetRequest ? await db.user.findUnique({ where: { id: activeProfile.customerId }, select: { pendingPasswordHash: true } }) : null;
  await db.$transaction([
    db.customerProfile.update({ where: { id }, data: { status: resetRequest ? CustomerStatus.ACTIVE : approve ? CustomerStatus.ACTIVE : CustomerStatus.REJECTED, approvedById: actor.id, approvedAt: new Date() } }),
    db.user.update({ where: { id: activeProfile.customerId }, data: resetRequest ? { ...(resetApproved && customer?.pendingPasswordHash ? { passwordHash: customer.pendingPasswordHash } : {}), pendingPasswordHash: null, resetCode: null } : { customerStatus: approve ? CustomerStatus.ACTIVE : CustomerStatus.REJECTED, isActive: approve } }),
    ...(approve && !resetRequest ? [db.order.updateMany({ where: { customerPhone: activeProfile.phone, customerId: null }, data: { customerId: activeProfile.customerId } })] : []),
  ]);
  await audit(actor.id, approve ? "审核激活客户" : "拒绝客户申请", "CustomerProfile", id, actor.storeId);
  revalidatePath("/admin/customers");
}

export async function assignOrder(data: FormData) {
  const actor = await requireActor([Role.STORE_ADMIN]);
  const storeId = actor.storeId!;
  const id = value(data, "id"); const employeeId = value(data, "employeeId") || null;
  if (employeeId && !await db.user.findFirst({ where: { id: employeeId, storeId, role: Role.EMPLOYEE, isActive: true } })) fail(`/admin/orders/${id}`, "负责人不可用");
  const order = await db.order.findFirst({ where: { id, storeId } });
  if (!order) fail("/admin/orders", "订单不存在");
  await db.$transaction([
    db.order.update({ where: { id }, data: { responsibleEmployeeId: employeeId } }),
    db.orderChange.create({ data: { orderId: id, actorId: actor.id, field: "responsibleEmployeeId", beforeValue: order!.responsibleEmployeeId, afterValue: employeeId } }),
  ]);
  revalidatePath(`/admin/orders/${id}`);
}

export async function bulkProducts(data: FormData) {
  const actor = await requireActor([Role.STORE_ADMIN]);
  const storeId = actor.storeId!;
  const ids = [...new Set(data.getAll("ids").map(String).flatMap((item) => item.split(",")).filter(Boolean))]; const action = value(data, "operation"); const categoryId = value(data, "categoryId") || null;
  if (!ids.length) fail("/admin/products", "请选择商品");
  if (action === "publish") await db.product.updateMany({ where: { id: { in: ids }, storeId, isDeleted: false, categoryId: { not: null } }, data: { isPublished: true } });
  else if (action === "unpublish") await db.product.updateMany({ where: { id: { in: ids }, storeId }, data: { isPublished: false } });
  else if (action === "delete") await db.product.updateMany({ where: { id: { in: ids }, storeId, source: { not: ProductSource.ENTERPRISE } }, data: { isPublished: false, isDeleted: true } });
  else if (action === "category") {
    if (!categoryId || !await db.category.findFirst({ where: { id: categoryId, storeId, isActive: true } })) fail("/admin/products", "所选分类不可用");
    await db.product.updateMany({ where: { id: { in: ids }, storeId, isDeleted: false }, data: { categoryId, isPublished: false } });
  }
  revalidatePath("/admin/products");
}

export async function quickOrder(data: FormData) {
  const actor = await requireActor([Role.STORE_ADMIN, Role.EMPLOYEE]);
  const storeId = actor.storeId!;
  const productId = value(data, "productId"); const variantId = value(data, "variantId") || null; const phone = value(data, "phone"); const name = value(data, "name"); const quantity = Number(value(data, "quantity") || 1);
  if (!/^1\d{10}$/.test(phone) || !name || !Number.isInteger(quantity) || quantity < 1) fail("/admin/orders/new", "客户或数量信息不正确");
  const product = await db.product.findFirst({ where: { id: productId, storeId, isDeleted: false }, include: { variants: true } });
  if (!product) fail("/admin/orders/new", "商品不存在");
  const activeProduct = product!; const variant = activeProduct.variants.find((item) => item.id === variantId) ?? activeProduct.variants[0];
  const now = new Date(); const orderNo = `YC${now.toISOString().slice(0, 10).replaceAll("-", "")}${String(Date.now()).slice(-6)}`;
  const order = await db.$transaction(async (tx) => {
    const lead = await tx.lead.upsert({ where: { storeId_phone: { storeId: actor.storeId!, phone } }, create: { storeId: actor.storeId!, phone, name, latestEmployeeId: actor.role === Role.EMPLOYEE ? actor.id : null, firstOrderAt: now, lastOrderAt: now }, update: { name, lastOrderAt: now } });
    const snapshotPrice = variant?.price ?? activeProduct.price;
    return tx.order.create({ data: { orderNo, idempotencyKey: randomUUID(), storeId: actor.storeId!, leadId: lead.id, customerName: name, customerPhone: phone, sourceEmployeeId: actor.role === Role.EMPLOYEE ? actor.id : null, responsibleEmployeeId: actor.role === Role.EMPLOYEE ? actor.id : null, items: { create: { productId: activeProduct.id, variantId: variant?.id, productName: activeProduct.name, productCode: activeProduct.code, imageUrl: variant?.imageUrl || activeProduct.mainImageUrl, specification: variant ? [variant.name, variant.specification].filter(Boolean).join(" · ") : activeProduct.specification, variantCode: variant?.code, price: snapshotPrice, salePrice: snapshotPrice, unit: activeProduct.unit, quantity } } } });
  });
  redirect(`/admin/orders/${order.id}`);
}
