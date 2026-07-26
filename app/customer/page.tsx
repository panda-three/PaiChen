import { CustomerAccess } from "./customer-access";
import { AuthShell } from "@/components/auth-shell";

export default async function CustomerPage({ searchParams }: { searchParams: Promise<{ store?: string; ref?: string; mode?: string; returnTo?: string }> }) {
  const query = await searchParams;
  const returnTo = query.returnTo?.startsWith("/") && !query.returnTo.startsWith("//") ? query.returnTo : query.store ? `/s/${encodeURIComponent(query.store)}` : "/me";
  return <AuthShell eyebrow="CLIENT ACCESS" title="客户账号" description="登录后继续浏览收藏与订单；新账号需由来源员工或店铺管理员线下核验并激活。">
    <CustomerAccess storeSlug={query.store ?? ""} refCode={query.ref ?? ""} initialMode={query.mode ?? "login"} returnTo={returnTo}/>
  </AuthShell>;
}
