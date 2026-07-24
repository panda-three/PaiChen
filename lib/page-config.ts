import { z } from "zod";

const id = z.string().min(1).max(100);
const httpUrl = z.string().url().refine((value) => /^https?:\/\//i.test(value), "仅支持 HTTP(S) 地址");
const base = z.object({ id });
const productSource = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("all") }),
  z.object({ mode: z.literal("category"), categoryId: id }),
  z.object({ mode: z.literal("selected"), productIds: z.array(id).max(50) }),
]);

export const pageComponentV2Schema = z.discriminatedUnion("type", [
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

export const pageConfigV2Schema = z.object({ version: z.literal(2), components: z.array(pageComponentV2Schema).max(100) });
export type PageComponentV2 = z.infer<typeof pageComponentV2Schema>;
export type PageConfigV2 = z.infer<typeof pageConfigV2Schema>;

export function sanitizeRichText(html: string) {
  return html
    .replace(/<\s*(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|style|iframe|object|embed)[^>]*\/?\s*>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*(["'])\s*(?:javascript|data|vbscript):[\s\S]*?\2/gi, '$1="#"');
}

function requiredComponent(type: "storeHeader" | "employeeCard"): PageComponentV2 {
  return type === "storeHeader"
    ? { id: "system-store-header", type, style: "compact", subtitle: "家居美学 · 意向开单" }
    : { id: "system-employee-card", type, style: "dark" };
}

function fromV1(input: Record<string, unknown>): PageConfigV2 {
  const raw = Array.isArray(input.components) ? input.components : [];
  const components: unknown[] = raw.map((item) => {
    if (!item || typeof item !== "object") return item;
    const component = item as Record<string, unknown>;
    if (component.type === "products") return { id: component.id, type: "productGrid", title: component.title ?? "精选商品", source: { mode: "selected", productIds: component.productIds ?? [] } };
    if (component.type === "productGroup") return { id: component.id, type: "productGrid", title: component.title ?? "商品分组", source: { mode: "category", categoryId: component.categoryId } };
    return component;
  });
  if (!components.some((item) => (item as { type?: string })?.type === "storeHeader")) components.unshift(requiredComponent("storeHeader"));
  if (!components.some((item) => (item as { type?: string })?.type === "employeeCard")) components.splice(1, 0, requiredComponent("employeeCard"));
  return cleanConfig({ version: 2, components });
}

function cleanConfig(raw: unknown): PageConfigV2 {
  const parsed = pageConfigV2Schema.parse(raw);
  return {
    ...parsed,
    components: parsed.components.map((component) => component.type === "richText" ? { ...component, html: sanitizeRichText(component.html) } : component),
  };
}

export function parsePageConfig(raw: unknown): PageConfigV2 {
  const input = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!input || typeof input !== "object") throw new Error("页面配置格式不正确");
  return (input as { version?: number }).version === 1 ? fromV1(input as Record<string, unknown>) : cleanConfig(input);
}

export function validatePageConfigForStore(config: PageConfigV2, available: { productIds: Set<string>; categoryIds: Set<string> }, home = false) {
  for (const component of config.components) {
    if (component.type !== "productGrid") continue;
    if (component.source.mode === "category" && !available.categoryIds.has(component.source.categoryId)) throw new Error("商品分类不属于当前店铺");
    if (component.source.mode === "selected" && component.source.productIds.some((productId) => !available.productIds.has(productId))) throw new Error("商品不属于当前店铺");
  }
  if (home) {
    const types = new Set(config.components.map((component) => component.type));
    if (!types.has("storeHeader") || !types.has("employeeCard") || !types.has("productGrid")) throw new Error("主页必须包含店铺头部、员工名片和商品网格");
  }
  return config;
}

export function blankPageConfig(): PageConfigV2 {
  return { version: 2, components: [requiredComponent("storeHeader"), requiredComponent("employeeCard")] };
}

export function homeTemplateConfig(): PageConfigV2 {
  return { version: 2, components: [
    { id: "template-header", type: "storeHeader", style: "hero", subtitle: "用材质与光线，塑造理想之家" },
    { id: "template-card", type: "employeeCard", style: "dark" },
    { id: "template-search", type: "productSearch", placeholder: "搜索商品" },
    { id: "template-categories", type: "categoryNav", title: "空间分类" },
    { id: "template-products", type: "productGrid", title: "精选商品", source: { mode: "all" } },
  ] };
}
