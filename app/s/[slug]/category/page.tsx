import { db } from "@/lib/db";
import { getPublicCatalog } from "@/lib/public-catalog";
import { CatalogPage } from "@/components/public/catalog-page";

export default async function CategoryPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ ref?: string; category?: string }> }) {
  const [{ slug }, query] = await Promise.all([params, searchParams]); const catalog = await getPublicCatalog(slug); const favorites = catalog.customerId ? await db.favorite.findMany({ where: { storeId: catalog.store.id, customerId: catalog.customerId }, select: { productId: true } }) : [];
  return <CatalogPage catalog={catalog} refCode={query.ref} initialCategory={query.category} favoriteIds={favorites.map((item) => item.productId)}/>;
}
