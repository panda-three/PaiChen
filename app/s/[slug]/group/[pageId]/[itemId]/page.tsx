import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { parsePageConfig } from "@/lib/page-config";
import { resolveProductGroup } from "@/lib/product-group";
import { getPublicCatalog } from "@/lib/public-catalog";
import { GroupCatalog } from "./group-catalog";

export default async function ProductGroupPage({ params, searchParams }: { params: Promise<{ slug: string; pageId: string; itemId: string }>; searchParams: Promise<{ ref?: string }> }) {
  const [{ slug, pageId, itemId }, { ref }] = await Promise.all([params, searchParams]);
  const catalog = await getPublicCatalog(slug);
  const page = await db.storePage.findFirst({ where: { id: pageId, storeId: catalog.store.id, publishedAt: { not: null }, publishedJson: { not: null } }, select: { publishedJson: true } });
  if (!page?.publishedJson) notFound();
  const config = parsePageConfig(page.publishedJson);
  const item = config.components.flatMap((component) => component.type === "imageAd" ? component.items : []).find((entry) => entry.id === itemId && entry.target?.type === "productGroup");
  if (!item || item.target?.type !== "productGroup") notFound();
  const resolved = resolveProductGroup(item.target, catalog.categories, catalog.products);
  return <main className="public-group-page"><img className="public-group-cover" src={item.imageUrl} alt={item.alt}/><header><p>{item.subtitle}</p><h1>{item.target.title || item.title || "商品系列"}</h1></header><GroupCatalog slug={slug} refCode={ref} branches={resolved.branches} products={catalog.products.map((product) => ({ id: product.id, name: product.name, code: product.code, mainImageUrl: product.mainImageUrl, categoryId: product.categoryId, parentCategoryId: product.category?.parentId ?? null }))}/></main>;
}
