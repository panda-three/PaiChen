import { AuthorizationStatus, ProductSource, Role } from "@prisma/client";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { requireActor } from "@/lib/authz";
import { db } from "@/lib/db";
import { PageEditor } from "./page-editor";
import { parsePageConfig } from "@/lib/page-config";
import { FormError } from "@/components/page-header";

export default async function PageEdit({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; notice?: string }> }) {
  const actor = await requireActor([Role.STORE_ADMIN, Role.PLATFORM_ADMIN]);
  const { id } = await params;
  const query = await searchParams;
  const storeId = actor.role === Role.STORE_ADMIN ? actor.storeId : (await cookies()).get("supportStoreId")?.value;
  const page = await db.storePage.findFirst({ where: { id, storeId: storeId ?? "" }, include: { store: true } });
  if (!page) notFound();
  const [categories, products, storePages] = await Promise.all([
    db.category.findMany({ where: { storeId: page.storeId, isActive: true, OR: [{ parentId: null }, { parent: { isActive: true } }] }, orderBy: [{ parentId: "asc" }, { sort: "asc" }], select: { id: true, name: true, parentId: true, createdAt: true, _count: { select: { products: { where: { isPublished: true, isDeleted: false } } } } } }),
    db.product.findMany({ where: { storeId: page.storeId, isPublished: true, isDeleted: false, category: { isActive: true, OR: [{ parentId: null }, { parent: { isActive: true } }] }, OR: [{ source: { not: ProductSource.ENTERPRISE } }, { authorization: { status: AuthorizationStatus.ACTIVE } }] }, include: { variants: { orderBy: { sort: "asc" } }, category: { select: { name: true, parentId: true } } }, orderBy: [{ sort: "asc" }, { createdAt: "desc" }] }),
    db.storePage.findMany({ where: { storeId: page.storeId }, orderBy: { createdAt: "asc" }, select: { id: true, title: true, slug: true, publishedAt: true, publishedJson: true } }),
  ]);
  let card = { name: page.store.name, phone: page.store.phone, wechat: null, wechatQrUrl: null, title: "店铺顾问", bio: page.store.address, avatarUrl: page.store.logoUrl, shareCode: null } as { name: string; phone: string | null; wechat: string | null; wechatQrUrl: string | null; title: string | null; bio: string | null; avatarUrl: string | null; shareCode: string | null };
  try { card = { ...card, ...JSON.parse(page.store.defaultCardJson) }; } catch {}
  return <>
    <FormError message={query.error}/>
    {query.notice && <div className="mb-5 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">{query.notice}</div>}
    <PageEditor
      page={{ id: page.id, title: page.title, slug: page.slug, config: parsePageConfig(page.draftJson), published: Boolean(page.publishedAt), isHome: page.isHome }}
      publicUrl={`/s/${page.store.slug}${page.isHome ? "" : `/p/${page.slug}`}`}
      store={{ slug: page.store.slug, name: page.store.name, logoUrl: page.store.logoUrl, phone: page.store.phone, address: page.store.address }}
      categories={categories.map((category) => ({ id: category.id, name: category.name, parentId: category.parentId, createdAt: category.createdAt.toISOString(), productCount: category.parentId ? category._count.products : products.filter((product) => product.category?.parentId === category.id || product.categoryId === category.id).length }))}
      pages={storePages.map((target) => ({ id: target.id, title: target.title, slug: target.slug, published: Boolean(target.publishedAt && target.publishedJson) }))}
      employee={card}
      products={products.map((product) => ({ id: product.id, name: product.name, code: product.code, mainImageUrl: product.mainImageUrl, galleryImageUrls: product.galleryImageUrls, detailImageUrls: product.detailImageUrls, specification: product.specification, price: product.price?.toString() ?? null, unit: product.unit, description: product.description, categoryId: product.categoryId, category: product.category, variants: product.variants.map((variant) => ({ id: variant.id, name: variant.name, code: variant.code, price: variant.price?.toString() ?? null, imageUrl: variant.imageUrl, specification: variant.specification })) }))}
    />
  </>;
}
