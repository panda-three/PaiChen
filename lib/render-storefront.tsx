import { notFound } from "next/navigation";
import { PublicHome } from "@/app/s/[slug]/public-home";
import { db } from "@/lib/db";
import { resolveHomeCard } from "@/lib/home-card";
import { parsePageConfig } from "@/lib/page-config";
import { getPublicCatalog } from "@/lib/public-catalog";

export async function renderStorefront(slug: string, pageSlug: string | undefined, ref: string | undefined) {
  const catalog = await getPublicCatalog(slug);
  const [page, profile, favorites, pages] = await Promise.all([
    db.storePage.findFirst({ where: { storeId: catalog.store.id, slug: pageSlug, publishedAt: { not: null }, publishedJson: { not: null } } }),
    catalog.customerId ? db.customerProfile.findFirst({ where: { storeId: catalog.store.id, customerId: catalog.customerId, status: "ACTIVE" }, select: { name: true, phone: true, avatarUrl: true, servicePhone: true, serviceWechat: true, serviceQrUrl: true, cardTitle: true, cardBio: true } }) : null,
    catalog.customerId ? db.favorite.findMany({ where: { storeId: catalog.store.id, customerId: catalog.customerId }, select: { productId: true } }) : [],
    db.storePage.findMany({ where: { storeId: catalog.store.id, publishedAt: { not: null }, publishedJson: { not: null } }, select: { id: true, slug: true } }),
  ]);
  if (!page?.publishedJson) notFound();
  let defaultCard = { name: catalog.store.name, phone: catalog.store.phone, wechat: null as string | null, title: "店铺顾问", bio: catalog.store.address, avatarUrl: catalog.store.logoUrl };
  try { defaultCard = { ...defaultCard, ...JSON.parse(catalog.store.defaultCardJson) }; } catch {}
  const card = resolveHomeCard(defaultCard, profile);
  return <PublicHome catalog={catalog} config={parsePageConfig(page.publishedJson)} employee={card} currentPageId={page.id} refCode={ref} favoriteIds={favorites.map((item) => item.productId)} pages={pages}/>;
}
