import { notFound } from "next/navigation";
import { PublicHome } from "@/app/s/[slug]/public-home";
import { db } from "@/lib/db";
import { resolveHomeCard } from "@/lib/home-card";
import { parsePageConfig } from "@/lib/page-config";
import { getPublicCatalog } from "@/lib/public-catalog";
import { Role } from "@prisma/client";

export async function renderStorefront(slug: string, pageSlug: string | undefined, ref: string | undefined) {
  const catalog = await getPublicCatalog(slug);
  const [page, referredUser, favorites, pages] = await Promise.all([
    db.storePage.findFirst({ where: { storeId: catalog.store.id, slug: pageSlug, publishedAt: { not: null }, publishedJson: { not: null } } }),
    ref ? db.user.findFirst({ where: { storeId: catalog.store.id, shareCode: ref, role: { in: [Role.STORE_ADMIN, Role.EMPLOYEE] }, isActive: true, store: { isActive: true } }, select: { name: true, phone: true, wechat: true, title: true, bio: true, avatarUrl: true, role: true } }) : null,
    catalog.customerId ? db.favorite.findMany({ where: { storeId: catalog.store.id, customerId: catalog.customerId }, select: { productId: true } }) : [],
    db.storePage.findMany({ where: { storeId: catalog.store.id, publishedAt: { not: null }, publishedJson: { not: null } }, select: { id: true, slug: true } }),
  ]);
  if (!page?.publishedJson) notFound();
  let defaultCard = { name: catalog.store.name, phone: catalog.store.phone, wechat: null as string | null, title: "店铺顾问", bio: catalog.store.address, avatarUrl: catalog.store.logoUrl };
  try { defaultCard = { ...defaultCard, ...JSON.parse(catalog.store.defaultCardJson) }; } catch {}
  const card = resolveHomeCard(defaultCard, referredUser);
  return <PublicHome catalog={catalog} config={parsePageConfig(page.publishedJson)} employee={card} currentPageId={page.id} refCode={ref} favoriteIds={favorites.map((item) => item.productId)} pages={pages}/>;
}
