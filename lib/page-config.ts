import { z } from "zod";

const id = z.string().min(1).max(100);
const httpUrl = z.string().url().refine((value) => /^https?:\/\//i.test(value), "仅支持 HTTP(S) 地址");
const templateUrl = z.string().max(500).refine((value) => /^\/templates\/(?!\/)[a-z0-9/_-]+\.(?:avif|gif|jpe?g|png|webp)$/i.test(value), "站内图片必须位于 /templates");
const imageUrl = z.union([httpUrl, templateUrl]);
const optionalUrl = z.union([imageUrl, z.literal("")]).optional();
const base = z.object({ id });
const productSource = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("all") }),
  z.object({ mode: z.literal("category"), categoryId: id }),
  z.object({ mode: z.literal("selected"), productIds: z.array(id).max(50) }),
]);
const storeHeaderImageSource = z.discriminatedUnion("type", [
  z.object({ type: z.literal("storeLogo") }),
  z.object({ type: z.literal("productMainImage"), productId: id }),
]);
const internalOrHttpUrl = z.string().max(500).refine(
  (value) => (/^\/(?!\/)/.test(value) || /^https?:\/\//i.test(value)),
  "自定义链接仅支持站内相对地址或 HTTP(S)",
);
const navIcon = z.enum(["building", "sofa", "images", "shield", "phone"]);
const navItem = z.object({ title: z.string().max(30), imageUrl: optionalUrl, href: z.string().max(300).default(""), icon: navIcon.optional(), pageId: id.optional() });
const slide = z.object({ imageUrl: optionalUrl, alt: z.string().max(100).default("") });
const productGroupTab = z.object({
  categoryId: id,
  alias: z.string().trim().max(30).optional(),
  limit: z.number().int().min(1).max(50).nullable().default(null),
});
const adTarget = z.discriminatedUnion("type", [
  z.object({ type: z.literal("product"), productId: id }),
  z.object({ type: z.literal("category"), categoryId: id }),
  z.object({ type: z.literal("page"), pageId: id }),
  z.object({ type: z.literal("productGroup"), title: z.string().max(100).optional(), groups: z.array(productGroupTab).min(1).max(15) }),
  z.object({ type: z.literal("custom"), url: internalOrHttpUrl }),
]);
const imageAdItem = z.object({
  id,
  imageUrl,
  alt: z.string().max(100).default(""),
  title: z.string().max(100).default(""),
  subtitle: z.string().max(160).default(""),
  target: adTarget.optional(),
});

export const pageComponentV4Schema = z.discriminatedUnion("type", [
  base.extend({ type: z.literal("heroCarousel"), slides: z.array(slide).max(8).default([]) }),
  base.extend({ type: z.literal("quickNav"), items: z.array(navItem).max(5).default([]) }),
  base.extend({ type: z.literal("announcement"), messages: z.array(z.string().max(100)).max(10).default([]) }),
  base.extend({ type: z.literal("seriesShowcase"), title: z.string().max(100).default("探索系列"), categoryIds: z.array(id).max(8).default([]) }),
  base.extend({ type: z.literal("newProducts"), title: z.string().max(100).default("当季新品"), source: productSource }),
  base.extend({ type: z.literal("productGroupTabs"), title: z.string().max(100).default("商品分组"), groups: z.array(productGroupTab).max(15) }),
  base.extend({ type: z.literal("imageAd"), title: z.string().max(100).default(""), subtitle: z.string().max(160).default(""), layout: z.enum(["stack", "carousel"]).default("stack"), items: z.array(imageAdItem).max(10) }),
  base.extend({ type: z.literal("storeHeader"), style: z.enum(["compact", "hero"]).default("compact"), subtitle: z.string().max(100).default("家居美学 · 意向开单"), name: z.string().min(1).max(100).optional(), imageSource: storeHeaderImageSource.optional() }),
  base.extend({ type: z.literal("employeeCard"), style: z.enum(["dark", "light", "yuncheng"]).default("dark") }),
  base.extend({ type: z.literal("text"), title: z.string().max(100), body: z.string().max(1000).default("") }),
  base.extend({ type: z.literal("richText"), html: z.string().max(20000) }),
  base.extend({ type: z.literal("productSearch"), placeholder: z.string().max(50).default("搜索商品"), style: z.enum(["default", "heroOverlay"]).default("default") }),
  base.extend({ type: z.literal("categoryNav"), title: z.string().max(100).default("商品分类") }),
  base.extend({ type: z.literal("productGrid"), title: z.string().max(100).default("精选商品"), subtitle: z.string().max(160).default(""), layout: z.enum(["default", "yuncheng"]).default("default"), limit: z.number().int().min(1).max(50).nullable().default(null), source: productSource }),
  base.extend({ type: z.literal("contentCard"), title: z.string().max(100), body: z.string().max(1000), imageUrl: imageUrl.optional() }),
  base.extend({ type: z.literal("video"), url: httpUrl, poster: httpUrl.optional() }),
  base.extend({ type: z.literal("divider") }),
]);

export const pageConfigV4Schema = z.object({ version: z.literal(4), themeColor: z.string().regex(/^#[0-9a-f]{6}$/i).default("#5f4939"), components: z.array(pageComponentV4Schema).max(100) });
export type PageComponentV4 = z.infer<typeof pageComponentV4Schema>;
export type PageConfigV4 = z.infer<typeof pageConfigV4Schema>;
export type PageComponentV3 = PageComponentV4;
export type PageConfigV3 = PageConfigV4;
export type PageComponentV2 = PageComponentV4;
export type PageConfigV2 = PageConfigV4;
export type ImageAdTarget = z.infer<typeof adTarget>;

export function sanitizeRichText(html: string) {
  return html
    .replace(/<\s*(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|style|iframe|object|embed)[^>]*\/?\s*>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*(["'])\s*(?:javascript|data|vbscript):[\s\S]*?\2/gi, '$1="#"');
}

function requiredComponent(type: "storeHeader" | "employeeCard"): PageComponentV4 {
  return type === "storeHeader"
    ? { id: "system-store-header", type, style: "compact", subtitle: "家居美学 · 意向开单" }
    : { id: "system-employee-card", type, style: "dark" };
}

function legacyComponents(input: Record<string, unknown>) {
  const raw = Array.isArray(input.components) ? input.components : [];
  const components: unknown[] = raw.map((item, index) => {
    if (!item || typeof item !== "object") return item;
    const component = item as Record<string, unknown>;
    if (component.type === "products") return { id: component.id, type: "productGrid", title: component.title ?? "精选商品", source: { mode: "selected", productIds: component.productIds ?? [] } };
    if (component.type === "productGroup") return { id: component.id, type: "productGrid", title: component.title ?? "商品分组", source: { mode: "category", categoryId: component.categoryId } };
    if (component.type === "image") return { id: component.id, type: "imageAd", items: [{ id: `${String(component.id)}-image-${index}`, imageUrl: component.url, alt: component.alt ?? "", ...(component.link ? { target: { type: "custom", url: component.link } } : {}) }] };
    if (component.type === "quickNav" && Array.isArray(component.items)) return { ...component, items: component.items.slice(0, 5) };
    return component;
  });
  if ((input.version ?? 1) === 1) {
    if (!components.some((item) => (item as { type?: string })?.type === "storeHeader")) components.unshift(requiredComponent("storeHeader"));
    if (!components.some((item) => (item as { type?: string })?.type === "employeeCard")) components.splice(1, 0, requiredComponent("employeeCard"));
  }
  return components;
}

function cleanConfig(raw: unknown): PageConfigV4 {
  const parsed = pageConfigV4Schema.parse(raw);
  return { ...parsed, components: parsed.components.map((component) => component.type === "richText" ? { ...component, html: sanitizeRichText(component.html) } : component) };
}

export function parsePageConfig(raw: unknown): PageConfigV4 {
  const input = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!input || typeof input !== "object") throw new Error("页面配置格式不正确");
  const record = input as Record<string, unknown>;
  if (record.version === 4) return cleanConfig(record);
  if (record.version === 1 || record.version === 2 || record.version === 3) return cleanConfig({ version: 4, themeColor: record.themeColor ?? "#5f4939", components: legacyComponents(record) });
  throw new Error("不支持的页面配置版本");
}

type AvailablePageAssets = { productIds: Set<string>; categoryIds: Set<string>; pageIds?: Set<string> };

export function validatePageConfigForStore(config: PageConfigV4, available: AvailablePageAssets, home = false) {
  for (const component of config.components) {
    if ((component.type === "productGrid" || component.type === "newProducts") && component.source.mode === "category" && !available.categoryIds.has(component.source.categoryId)) throw new Error("商品分类不属于当前店铺");
    if ((component.type === "productGrid" || component.type === "newProducts") && component.source.mode === "selected" && component.source.productIds.some((productId) => !available.productIds.has(productId))) throw new Error("商品不属于当前店铺");
    if (component.type === "productGroupTabs" && component.groups.some((group) => !available.categoryIds.has(group.categoryId))) throw new Error("商品分类不属于当前店铺");
    if (component.type === "productGroupTabs" && new Set(component.groups.map((group) => group.categoryId)).size !== component.groups.length) throw new Error("商品分组不能重复");
    if (component.type === "seriesShowcase" && component.categoryIds.some((categoryId) => !available.categoryIds.has(categoryId))) throw new Error("商品分类不属于当前店铺");
    if (component.type === "storeHeader" && component.imageSource?.type === "productMainImage" && !available.productIds.has(component.imageSource.productId)) throw new Error("店铺头部图片不属于当前店铺");
    if (component.type === "quickNav" && component.items.some((item) => item.pageId && !available.pageIds?.has(item.pageId))) throw new Error("快捷入口页面不属于当前店铺或尚未发布");
    if (component.type === "imageAd") for (const item of component.items) {
      if (item.target?.type === "product" && !available.productIds.has(item.target.productId)) throw new Error("广告商品不属于当前店铺");
      if (item.target?.type === "category" && !available.categoryIds.has(item.target.categoryId)) throw new Error("广告分组不属于当前店铺");
      if (item.target?.type === "page" && !available.pageIds?.has(item.target.pageId)) throw new Error("广告页面不属于当前店铺或尚未发布");
      if (item.target?.type === "productGroup") {
        if (item.target.groups.some((group) => !available.categoryIds.has(group.categoryId))) throw new Error("广告商品分组不属于当前店铺");
        if (new Set(item.target.groups.map((group) => group.categoryId)).size !== item.target.groups.length) throw new Error("广告商品分组不能重复");
      }
    }
  }
  if (home && !config.components.some((component) => component.type === "productGrid" || component.type === "productGroupTabs")) throw new Error("主页必须包含商品网格或商品分组");
  return config;
}

export function resolveImageAdHref(target: ImageAdTarget | undefined, context: { storeSlug: string; pageId?: string; itemId?: string; refCode?: string; productIds: Set<string>; categoryIds: Set<string>; pages: Map<string, string> }) {
  if (!target) return null;
  const suffix = context.refCode ? `?ref=${encodeURIComponent(context.refCode)}` : "";
  if (target.type === "product") return context.productIds.has(target.productId) ? `/s/${context.storeSlug}/product/${target.productId}${suffix}` : null;
  if (target.type === "category") return context.categoryIds.has(target.categoryId) ? `/s/${context.storeSlug}/category?category=${encodeURIComponent(target.categoryId)}${context.refCode ? `&ref=${encodeURIComponent(context.refCode)}` : ""}` : null;
  if (target.type === "page") { const slug = context.pages.get(target.pageId); return slug ? `/s/${context.storeSlug}/p/${slug}${suffix}` : null; }
  if (target.type === "productGroup") return context.pageId && context.itemId ? `/s/${context.storeSlug}/group/${context.pageId}/${context.itemId}${suffix}` : null;
  return target.url;
}

export function blankPageConfig(): PageConfigV4 {
  return { version: 4, themeColor: "#5f4939", components: [requiredComponent("storeHeader"), requiredComponent("employeeCard")] };
}

export function homeTemplateConfig(): PageConfigV4 {
  return { version: 4, themeColor: "#30302e", components: [
    { id: "template-search", type: "productSearch", placeholder: "搜索商品", style: "heroOverlay" },
    { id: "template-hero", type: "heroCarousel", slides: [] },
    { id: "template-card", type: "employeeCard", style: "yuncheng" },
    { id: "template-nav", type: "quickNav", items: ["品牌介绍", "系列产品", "空间案例", "售后保障", "专属接待"].map((title, index) => ({ title, href: "", icon: (["building", "sofa", "images", "shield", "phone"] as const)[index] })) },
    { id: "template-news", type: "announcement", messages: ["限时活动，欢迎致电咨询"] },
    { id: "template-series", type: "imageAd", title: "两大系列", subtitle: "诚邀品鉴", layout: "stack", items: [] },
    { id: "template-new", type: "imageAd", title: "新品推荐", subtitle: "空间展示 · 诚邀品鉴", layout: "carousel", items: [] },
    { id: "template-products", type: "productGrid", title: "爆款商品", subtitle: "甄选好物", layout: "yuncheng", limit: 9, source: { mode: "all" } },
  ] };
}
