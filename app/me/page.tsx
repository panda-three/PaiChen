import Link from "next/link";
import { redirect } from "next/navigation";
import { PackageCheck, Settings, Store as StoreIcon, UserRound } from "lucide-react";
import { getActiveCustomer } from "@/lib/customer-authz";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { canAccessPublicStore } from "@/lib/deployment-scope";
import { customerHref } from "@/lib/public-links";
import { getActiveAppUser } from "@/lib/app-authz";
import { StaffCenter } from "@/app/me/staff-center";
import { Role } from "@prisma/client";

export default async function CustomerCenter({ searchParams }: { searchParams: Promise<{ store?: string; ref?: string }> }) {
  const query = await searchParams;
  const meParams = new URLSearchParams();
  if (query.store) meParams.set("store", query.store);
  if (query.ref) meParams.set("ref", query.ref);
  const returnTo = `/me${meParams.size ? `?${meParams}` : ""}`;
  const appUser = await getActiveAppUser();
  if (appUser && (appUser.role === Role.EMPLOYEE || appUser.role === Role.STORE_ADMIN) && appUser.store) return <StaffCenter user={{ ...appUser, store: appUser.store }}/>;
  const actor = appUser?.role === Role.CUSTOMER ? await getActiveCustomer() : null;
  if (!actor) {
    if (query.store) redirect(customerHref(query.store, query.ref, returnTo));
    redirect(`/login?${new URLSearchParams({ returnTo })}`);
  }
  if (query.store && !canAccessPublicStore(query.store)) redirect("/login");
  const selectedStore = query.store ? await db.store.findFirst({ where: { slug: query.store, isActive: true }, select: { id: true, slug: true, name: true } }) : null;
  const [profiles, orders] = await Promise.all([
    db.customerProfile.findMany({ where: { customerId: actor.id, ...(selectedStore ? { storeId: selectedStore.id } : {}) }, include: { store: true }, orderBy: { createdAt: "desc" } }),
    db.order.findMany({ where: { customerId: actor.id, ...(selectedStore ? { storeId: selectedStore.id } : {}) }, include: { store: true, items: true }, orderBy: { createdAt: "desc" } }),
  ]);
  const currentProfile = selectedStore ? profiles[0] : null;
  const settingsParams = new URLSearchParams();
  if (selectedStore) settingsParams.set("store", selectedStore.slug);
  if (query.ref) settingsParams.set("ref", query.ref);
  const back = selectedStore ? `/s/${selectedStore.slug}${query.ref ? `?ref=${encodeURIComponent(query.ref)}` : ""}` : profiles[0] ? `/s/${profiles[0].store.slug}` : "/login";
  return <div className="public-desktop"><main className="public-phone public-me"><header>{currentProfile?.avatarUrl?<img className="public-avatar-image" src={currentProfile.avatarUrl} alt="个人头像"/>:<div className="public-avatar"><UserRound/></div>}<div><h1>{currentProfile?.name ?? actor.name}</h1><p>登录手机号 {actor.phone}</p></div></header><nav className="public-me-summary"><a href="#orders"><PackageCheck/><b>{orders.length}</b><span>意向单</span></a><Link href={`/me/settings${settingsParams.size ? `?${settingsParams}` : ""}`}><Settings/><b>账号</b><span>设置</span></Link></nav><section><h2><StoreIcon/> 我的店铺</h2>{profiles.map((item) => <Link className="public-profile" href={`/s/${item.store.slug}${query.ref ? `?ref=${encodeURIComponent(query.ref)}` : ""}`} key={item.id}><span>{item.store.name}</span><small>{item.status === "ACTIVE" ? "已激活" : item.status}</small></Link>)}</section><section id="orders"><h2>我的意向单</h2>{orders.map((order) => <article className="public-order" key={order.id}><header><b>{order.store.name}</b><span>{order.status}</span></header><p>{order.items.map((item) => `${item.productName} × ${item.quantity}`).join("、")}</p><small>{order.orderNo} · {formatDate(order.createdAt)}</small></article>)}{!orders.length && <div className="public-empty">暂无意向单</div>}</section><Link className="public-back-store" href={back}>返回店铺</Link></main></div>;
}
