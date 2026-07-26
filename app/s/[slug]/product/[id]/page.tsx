import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getPublicCatalog } from "@/lib/public-catalog";
import { ProductDetail } from "./product-detail";
import { canAccessPublicStore } from "@/lib/deployment-scope";

export async function generateMetadata({ params }: { params: Promise<{ slug: string; id: string }> }): Promise<Metadata> { const { slug, id } = await params; if (!canAccessPublicStore(slug)) return {}; const product = await db.product.findFirst({ where: { id, store: { slug, isActive: true }, isPublished: true, isDeleted: false }, select: { name: true, description: true, mainImageUrl: true } }); return product ? { title: product.name, description: product.description, openGraph: { images: [product.mainImageUrl] } } : {}; }
export default async function ProductPage({ params, searchParams }: { params: Promise<{ slug: string; id: string }>; searchParams: Promise<{ ref?: string }> }) {
  const [{ slug, id }, { ref }] = await Promise.all([params, searchParams]); const catalog = await getPublicCatalog(slug); const product = catalog.products.find((item) => item.id === id); if (!product) notFound(); const favorite = catalog.customerId ? Boolean(await db.favorite.findFirst({ where: { storeId: catalog.store.id, customerId: catalog.customerId, productId: id } })) : false;
  return <ProductDetail product={product} store={catalog.store} refCode={ref} favorite={favorite} customerActive={catalog.customerActive}/>;
}
