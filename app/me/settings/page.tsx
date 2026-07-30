import Link from "next/link";
import { redirect } from "next/navigation";
import { Store as StoreIcon } from "lucide-react";
import { getActiveCustomer } from "@/lib/customer-authz";
import { db } from "@/lib/db";
import { customerHref } from "@/lib/public-links";
import { canAccessPublicStore } from "@/lib/deployment-scope";
import { CustomerSettings } from "./settings-client";
import { getActiveAppUser } from "@/lib/app-authz";
import { Role } from "@prisma/client";
import { StaffSettings } from "./staff-settings";

export default async function CustomerSettingsPage({ searchParams }: { searchParams: Promise<{ store?: string; ref?: string }> }) {
  const query = await searchParams;
  const appUser = await getActiveAppUser();
  if (appUser && (appUser.role === Role.EMPLOYEE || appUser.role === Role.STORE_ADMIN) && appUser.store) return <StaffSettings initialProfile={{ username:appUser.username, roleLabel:appUser.role===Role.STORE_ADMIN?"店铺管理员":"员工", storeName:appUser.store.name, storeSlug:appUser.store.slug, shareCode:appUser.shareCode??"", name:appUser.name, phone:appUser.phone??"", wechat:appUser.wechat??"", title:appUser.title??"", bio:appUser.bio??"", avatarUrl:appUser.avatarUrl, wechatQrUrl:appUser.wechatQrUrl }}/>;
  const actor = await getActiveCustomer();
  const returnParams = new URLSearchParams();
  if (query.store) returnParams.set("store", query.store);
  if (query.ref) returnParams.set("ref", query.ref);
  const returnTo = `/me/settings${returnParams.size ? `?${returnParams}` : ""}`;
  if (!actor) {
    if (query.store) redirect(customerHref(query.store, query.ref, returnTo));
    redirect(`/login?${new URLSearchParams({ returnTo })}`);
  }
  if (query.store && !canAccessPublicStore(query.store)) redirect("/login");
  const profiles = await db.customerProfile.findMany({ where: { customerId: actor.id, status: "ACTIVE", store: { isActive: true } }, include: { store: true }, orderBy: { createdAt: "desc" } });
  if (!query.store && profiles.length === 1) {
    const params = new URLSearchParams({ store: profiles[0].store.slug });
    if (query.ref) params.set("ref", query.ref);
    redirect(`/me/settings?${params}`);
  }
  const profile = query.store ? profiles.find((item) => item.store.slug === query.store) : null;
  if (!profile) return <div className="public-desktop"><main className="public-phone public-settings"><header><Link href="/me">← 我的</Link><h1>选择店铺资料</h1><p>你的资料按店铺独立保存，请先选择要设置的店铺。</p></header><section className="settings-card"><h2><StoreIcon/> 我的店铺</h2>{profiles.map((item) => { const params = new URLSearchParams({ store: item.store.slug }); if (query.ref) params.set("ref", query.ref); return <Link className="public-profile" href={`/me/settings?${params}`} key={item.id}><span>{item.store.name}</span><small>进入设置</small></Link>; })}{!profiles.length&&<div className="public-empty">暂无已激活店铺</div>}</section></main></div>;
  return <CustomerSettings loginPhone={actor.phone ?? actor.username} profile={{ id: profile.id, storeSlug: profile.store.slug, storeName: profile.store.name, name: profile.name, phone: profile.phone, avatarUrl: profile.avatarUrl }} refCode={query.ref ?? ""}/>;
}
