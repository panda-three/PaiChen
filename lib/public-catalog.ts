import { AuthorizationStatus, CustomerStatus, ProductSource, Role } from "@prisma/client";
import { notFound } from "next/navigation";
import { auth } from "@/customer-auth";
import { db } from "@/lib/db";
import { canAccessPublicStore } from "@/lib/deployment-scope";
import { resolveOrderAccess } from "@/lib/public-order-access";

export async function getPublicStore(slug: string) {
  if (!canAccessPublicStore(slug)) notFound();
  const store = await db.store.findFirst({ where: { slug, isActive: true } });
  if (!store) notFound();
  const session = await auth();
  const user = session?.user?.id ? await db.user.findFirst({ where: { id: session.user.id, isActive: true }, select: { id: true, role: true, storeId: true, customerStatus: true } }) : null;
  const customerId = user?.role === Role.CUSTOMER ? user.id : null;
  const profile = customerId ? await db.customerProfile.findFirst({ where: { storeId: store.id, customerId, status: CustomerStatus.ACTIVE } }) : null;
  const customerActive = Boolean(profile) && user?.customerStatus === CustomerStatus.ACTIVE;
  return {
    store,
    customerId,
    customerActive,
    orderAccess: resolveOrderAccess(user ?? null, store.id, customerActive, Boolean(session?.user?.id)),
    customerProfile: profile ? { name: profile.name, phone: profile.phone } : null,
  };
}

export async function getPublicCatalog(slug: string) {
  const context = await getPublicStore(slug);
  const [categories, products] = await Promise.all([
    db.category.findMany({ where: { storeId: context.store.id, isActive: true }, orderBy: { sort: "asc" }, select: { id: true, name: true } }),
    db.product.findMany({ where: { storeId: context.store.id, isPublished: true, isDeleted: false, category: { isActive: true }, OR: [{ source: { not: ProductSource.ENTERPRISE } }, { authorization: { status: AuthorizationStatus.ACTIVE } }] }, include: { variants: { orderBy: { sort: "asc" } }, category: { select: { name: true } } }, orderBy: [{ sort: "asc" }, { createdAt: "desc" }] }),
  ]);
  return { ...context, categories, products: products.map((product) => ({ ...product, price: product.price?.toString() ?? null, variants: product.variants.map((variant) => ({ ...variant, price: variant.price?.toString() ?? null })) })) };
}

export type PublicCatalog = Awaited<ReturnType<typeof getPublicCatalog>>;
export type PublicProduct = PublicCatalog["products"][number];
