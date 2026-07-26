import { z } from "zod";

const id = z.string().min(1).max(100);
const httpUrl = z.string().url().refine((value) => /^https?:\/\//i.test(value), "仅支持 HTTP(S) 地址");
const optionalUrl = z.union([httpUrl, z.literal("")]).optional();
const base = z.object({ id });
const productSource = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("all") }),
  z.object({ mode: z.literal("category"), categoryId: id }),
  z.object({ mode: z.literal("selected"), productIds: z.array(id).max(50) }),
]);
const navItem = z.object({ title: z.string().max(30), imageUrl: optionalUrl, href: z.string().max(300).default("") });
const slide = z.object({ title: z.string().max(80).default(""), subtitle: z.string().max(120).default(""), imageUrl: optionalUrl, href: z.string().max(300).default("") });

export const pageComponentV3Schema = z.discriminatedUnion("type", [
  base.extend({ type: z.literal("heroCarousel"), slides: z.array(slide).max(8).default([]) }),
  base.extend({ type: z.literal("quickNav"), items: z.array(navItem).max(8).default([]) }),
  base.extend({ type: z.literal("announcement"), messages: z.array(z.string().max(100)).max(10).default([]) }),
  base.extend({ type: z.literal("seriesShowcase"), title: z.string().max(100).default("探索系列"), categoryIds: z.array(id).max(8).default([]) }),
  base.extend({ type: z.literal("newProducts"), title: z.string().max(100).default("当季新品"), source: productSource }),
  base.extend({ type: z.literal("storeHeader"), style: z.enum(["compact", "hero"]).default("compact"), subtitle: z.string().max(100).default("家居美学 · 意向开单") }),
  base.extend({ type: z.literal("employeeCard"), style: z.enum(["dark", "light"]).default("dark") }),
  base.extend({ type: z.literal("image"), url: httpUrl, alt: z.string().max(100).default(""), link: httpUrl.optional() }),
  base.extend({ type: z.literal("text"), title: z.string().max(100), body: z.string().max(1000).default("") }),
  base.extend({ type: z.literal("richText"), html: z.string().max(20000) }),
  base.extend({ type: z.literal("productSearch"), placeholder: z.string().max(50).default("搜索商品") }),
  base.extend({ type: z.literal("categoryNav"), title: z.string().max(100).default("商品分类") }),
  base.extend({ type: z.literal("productGrid"), title: z.string().max(100).default("精选商品"), source: productSource }),
  base.extend({ type: z.literal("contentCard"), title: z.string().max(100), body: z.string().max(1000), imageUrl: httpUrl.optional() }),
  base.extend({ type: z.literal("video"), url: httpUrl, poster: httpUrl.optional() }),
  base.extend({ type: z.literal("divider") }),
]);

export const pageConfigV3Schema = z.object({ version: z.literal(3), themeColor: z.string().regex(/^#[0-9a-f]{6}$/i).default("#5f4939"), components: z.array(pageComponentV3Schema).max(100) });
export type PageComponentV3 = z.infer<typeof pageComponentV3Schema>;
export type PageConfigV3 = z.infer<typeof pageConfigV3Schema>;
// Compatibility names used by the existing editor while it transitions to V3.
export type PageComponentV2 = PageComponentV3;
export type PageConfigV2 = PageConfigV3;

export function sanitizeRichText(html: string) {
  return html
    .replace(/<\s*(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|style|iframe|object|embed)[^>]*\/?\s*>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*(["'])\s*(?:javascript|data|vbscript):[\s\S]*?\2/gi, '$1="#"');
}

function requiredComponent(type: "storeHeader" | "employeeCard"): PageComponentV3 {
  return type === "storeHeader"
    ? { id: "system-store-header", type, style: "compact", subtitle: "家居美学 · 意向开单" }
    : { id: "system-employee-card", type, style: "dark" };
}

function legacyComponents(input: Record<string, unknown>) {
  const raw = Array.isArray(input.components) ? input.components : [];
  const components: unknown[] = raw.map((item) => {
    if (!item || typeof item !== "object") return item;
    const component = item as Record<string, unknown>;
    if (component.type === "products") return { id: component.id, type: "productGrid", title: component.title ?? "精选商品", source: { mode: "selected", productIds: component.productIds ?? [] } };
    if (component.type === "productGroup") return { id: component.id, type: "productGrid", title: component.title ?? "商品分组", source: { mode: "category", categoryId: component.categoryId } };
    return component;
  });
  if ((input.version ?? 1) === 1) {
    if (!components.some((item) => (item as { type?: string })?.type === "storeHeader")) components.unshift(requiredComponent("storeHeader"));
    if (!components.some((item) => (item as { type?: string })?.type === "employeeCard")) components.splice(1, 0, requiredComponent("employeeCard"));
  }
  return components;
}

function cleanConfig(raw: unknown): PageConfigV3 {
  const parsed = pageConfigV3Schema.parse(raw);
  return { ...parsed, components: parsed.components.map((component) => component.type === "richText" ? { ...component, html: sanitizeRichText(component.html) } : component) };
}

export function parsePageConfig(raw: unknown): PageConfigV3 {
  const input = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!input || typeof input !== "object") throw new Error("页面配置格式不正确");
  const record = input as Record<string, unknown>;
  if (record.version === 3) return cleanConfig(record);
  if (record.version === 1 || record.version === 2) return cleanConfig({ version: 3, themeColor: "#5f4939", components: legacyComponents(record) });
  throw new Error("不支持的页面配置版本");
}

export function validatePageConfigForStore(config: PageConfigV3, available: { productIds: Set<string>; categoryIds: Set<string> }, home = false) {
  for (const component of config.components) {
    if ((component.type === "productGrid" || component.type === "newProducts") && component.source.mode === "category" && !available.categoryIds.has(component.source.categoryId)) throw new Error("商品分类不属于当前店铺");
    if ((component.type === "productGrid" || component.type === "newProducts") && component.source.mode === "selected" && component.source.productIds.some((productId) => !available.productIds.has(productId))) throw new Error("商品不属于当前店铺");
    if (component.type === "seriesShowcase" && component.categoryIds.some((categoryId) => !available.categoryIds.has(categoryId))) throw new Error("商品分类不属于当前店铺");
  }
  if (home && !config.components.some((component) => component.type === "productGrid")) throw new Error("主页必须包含商品网格");
  return config;
}

export function blankPageConfig(): PageConfigV3 {
  return { version: 3, themeColor: "#5f4939", components: [requiredComponent("storeHeader"), requiredComponent("employeeCard")] };
}

export function homeTemplateConfig(): PageConfigV3 {
  return { version: 3, themeColor: "#5f4939", components: [
    { id: "template-hero", type: "heroCarousel", slides: [] },
    { id: "template-card", type: "employeeCard", style: "dark" },
    { id: "template-nav", type: "quickNav", items: [] },
    { id: "template-news", type: "announcement", messages: ["欢迎来到我们的线上展厅"] },
    { id: "template-series", type: "seriesShowcase", title: "探索系列", categoryIds: [] },
    { id: "template-new", type: "newProducts", title: "当季新品", source: { mode: "all" } },
    { id: "template-products", type: "productGrid", title: "精选商品", source: { mode: "all" } },
  ] };
}
