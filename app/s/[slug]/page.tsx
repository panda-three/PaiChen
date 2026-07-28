import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getPublicCatalog } from "@/lib/public-catalog";
import { parsePageConfig } from "@/lib/page-config";
import { PublicHome } from "./public-home";
import { canAccessPublicStore } from "@/lib/deployment-scope";
import { resolveHomeCard } from "@/lib/home-card";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params; const store = await db.store.findFirst({ where: { slug, isActive: true }, select: { name: true, address: true, logoUrl: true } });
  if (!store || !canAccessPublicStore(slug)) return {};
  return { title: `${store.name}｜线上展厅`, description: `${store.name}商品展示与意向开单，${store.address}`, openGraph: { title: store.name, description: store.address, images: store.logoUrl ? [store.logoUrl] : [] } };
}

export default async function StorefrontPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ ref?: string }> }) {
  const [{ slug }, { ref }] = await Promise.all([params, searchParams]); const catalog = await getPublicCatalog(slug);
  const [page, profile, favorites, pages] = await Promise.all([
    db.storePage.findFirst({ where: { storeId: catalog.store.id, isHome: true, publishedAt: { not: null }, publishedJson: { not: null } } }),
    catalog.customerId ? db.customerProfile.findFirst({ where: { storeId: catalog.store.id, customerId: catalog.customerId, status: "ACTIVE" }, select: { name: true, phone: true, avatarUrl: true, servicePhone: true, serviceWechat: true, serviceQrUrl: true, cardTitle: true, cardBio: true } }) : null,
    catalog.customerId ? db.favorite.findMany({ where: { storeId: catalog.store.id, customerId: catalog.customerId }, select: { productId: true } }) : [],
    db.storePage.findMany({ where: { storeId: catalog.store.id, publishedAt: { not: null }, publishedJson: { not: null } }, select: { id: true, slug: true } }),
  ]);
  if (!page?.publishedJson) notFound();
  let defaultCard = { name: catalog.store.name, phone: catalog.store.phone, wechat: null as string | null, title: "店铺顾问", bio: catalog.store.address, avatarUrl: catalog.store.logoUrl }; try { defaultCard = { ...defaultCard, ...JSON.parse(catalog.store.defaultCardJson) }; } catch {}
  const card = resolveHomeCard(defaultCard, profile);
  return <PublicHome catalog={catalog} config={parsePageConfig(page.publishedJson)} employee={card} currentPageId={page.id} refCode={ref} favoriteIds={favorites.map((item) => item.productId)} pages={pages}/>;
}
