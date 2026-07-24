import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Storefront } from "./storefront";

export default async function StorefrontPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ ref?: string }> }) {
  const { slug } = await params; const { ref } = await searchParams;
  const store = await db.store.findUnique({ where: { slug } });
  if (!store) notFound();
  if (!store.isActive) return <main className="grid min-h-screen place-items-center bg-[#f7f6f2] p-6 text-center"><div><div className="text-4xl">暂</div><h1 className="mt-4 text-xl font-bold">店铺暂不可用</h1><p className="mt-2 text-sm text-[#81786f]">请稍后再来，或联系店铺管理员。</p></div></main>;
  const [categories, products, employee] = await Promise.all([
    db.category.findMany({ where: { storeId: store.id, isActive: true }, orderBy: { sort: "asc" }, select: { id: true, name: true } }),
    db.product.findMany({ where: { storeId: store.id, isPublished: true, category: { isActive: true } }, orderBy: [{ sort: "asc" }, { createdAt: "desc" }] }),
    ref ? db.user.findFirst({ where: { storeId: store.id, shareCode: ref, role: "EMPLOYEE", isActive: true }, select: { name: true, phone: true, wechat: true, title: true, bio: true, avatarUrl: true, shareCode: true } }) : null,
  ]);
  return <Storefront store={store} categories={categories} employee={employee} products={products.map((product) => ({ ...product, price: product.price?.toString() ?? null }))} />;
}
