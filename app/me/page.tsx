import Link from "next/link";
import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { Heart, History, LogOut, PackageCheck, Store as StoreIcon, UserRound } from "lucide-react";
import { signOut } from "@/auth";
import { requireActor } from "@/lib/authz";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { canAccessPublicStore } from "@/lib/deployment-scope";

export default async function CustomerCenter({ searchParams }: { searchParams: Promise<{ store?: string; ref?: string }> }) {
  const query = await searchParams; const actor = await requireActor(); if (actor.role !== Role.CUSTOMER) redirect("/admin");
  if (query.store && !canAccessPublicStore(query.store)) redirect("/customer");
  const selectedStore = query.store ? await db.store.findFirst({ where: { slug: query.store, isActive: true }, select: { id: true, slug: true, name: true } }) : null; const storeId = selectedStore?.id;
  const [profiles, favorites, orders, history] = await Promise.all([
    db.customerProfile.findMany({ where: { customerId: actor.id, ...(storeId ? { storeId } : {}) }, include: { store: true }, orderBy: { createdAt: "desc" } }),
    db.favorite.findMany({ where: { customerId: actor.id, ...(storeId ? { storeId } : {}) }, include: { product: { include: { store: true } } }, orderBy: { createdAt: "desc" } }),
    db.order.findMany({ where: { customerId: actor.id, ...(storeId ? { storeId } : {}) }, include: { store: true, items: true }, orderBy: { createdAt: "desc" } }),
    db.behaviorEvent.findMany({ where: { customerId: actor.id, type: "PRODUCT_VIEW", productId: { not: null }, ...(storeId ? { storeId } : {}) }, include: { product: { include: { store: true } } }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  const back = selectedStore ? `/s/${selectedStore.slug}${query.ref ? `?ref=${encodeURIComponent(query.ref)}` : ""}` : profiles[0] ? `/s/${profiles[0].store.slug}` : "/customer";
  return <div className="public-desktop"><main className="public-phone public-me"><header><div className="public-avatar"><UserRound/></div><div><h1>{actor.name}</h1><p>{actor.phone}</p></div><form action={async () => { "use server"; await signOut({ redirectTo: "/customer" }); }}><button aria-label="退出登录"><LogOut/></button></form></header><nav className="public-me-summary"><a href="#orders"><PackageCheck/><b>{orders.length}</b><span>意向单</span></a><a href="#favorites"><Heart/><b>{favorites.length}</b><span>收藏</span></a><a href="#history"><History/><b>{history.length}</b><span>足迹</span></a></nav><section><h2><StoreIcon/> 我的店铺</h2>{profiles.map((item) => <Link className="public-profile" href={`/s/${item.store.slug}`} key={item.id}><span>{item.store.name}</span><small>{item.status === "ACTIVE" ? "已激活" : "审核中"}</small></Link>)}</section><section id="orders"><h2>我的意向单</h2>{orders.map((order) => <article className="public-order" key={order.id}><header><b>{order.store.name}</b><span>{order.status}</span></header><p>{order.items.map((item) => `${item.productName} × ${item.quantity}`).join("、")}</p><small>{order.orderNo} · {formatDate(order.createdAt)}</small></article>)}{!orders.length && <div className="public-empty">暂无意向单</div>}</section><section id="favorites"><h2>我的收藏</h2><div className="public-grid">{favorites.map((item) => <Link className="public-product" href={`/s/${item.product.store.slug}/product/${item.product.id}`} key={item.id}><img src={item.product.mainImageUrl} alt=""/><div><h3>{item.product.name}</h3></div></Link>)}</div>{!favorites.length && <div className="public-empty">暂无收藏</div>}</section><section id="history"><h2>最近浏览</h2>{history.map((item) => <Link className="public-history" href={item.product ? `/s/${item.product.store.slug}/product/${item.product.id}` : back} key={item.id}><img src={item.product?.mainImageUrl} alt=""/><span>{item.product?.name || "商品已失效"}</span><small>{formatDate(item.createdAt)}</small></Link>)}</section><Link className="public-back-store" href={back}>返回店铺</Link></main></div>;
}
