import { AuthorizationStatus, CustomerStatus, ProductSource, Role } from "@prisma/client";
import { notFound } from "next/navigation";
import { auth } from "@/customer-auth";
import { db } from "@/lib/db";
import { canAccessPublicStore, deploymentScope } from "@/lib/deployment-scope";

export async function getPublicStore(slug: string) {
  if (!canAccessPublicStore(slug)) notFound();
  const store = await db.store.findFirst({ where: { slug, isActive: true } });
  if (!store) notFound();
  const session = await auth();
  const scope = deploymentScope();
  if (scope.isPreview && session?.user && session.user.role !== Role.CUSTOMER) notFound();
  const customerId = session?.user?.role === Role.CUSTOMER ? session.user.id : null;
  const profile = customerId ? await db.customerProfile.findFirst({ where: { storeId: store.id, customerId, status: CustomerStatus.ACTIVE } }) : null;
  if (scope.isPreview && customerId && !profile) notFound();
  return { store, customerId, customerActive: Boolean(profile) };
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
