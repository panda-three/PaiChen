import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { auth } from "@/customer-auth";
import { AuthShell } from "@/components/auth-shell";
import { AuthEndpointProvider } from "@/components/auth-endpoint-provider";
import { CUSTOMER_AUTH_BASE_PATH } from "@/lib/auth-scope";
import { CustomerAccess } from "@/app/customer/customer-access";

function safeReturnTo(value: string | undefined, storeSlug: string | undefined) {
  if (value?.startsWith("/") && !value.startsWith("//")) return value;
  return storeSlug ? `/s/${encodeURIComponent(storeSlug)}` : "/me";
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ store?: string; ref?: string; mode?: string; returnTo?: string }> }) {
  const query = await searchParams;
  const returnTo = safeReturnTo(query.returnTo, query.store);
  const session = await auth();
  if (session?.user?.role === Role.CUSTOMER) redirect(returnTo);
  return <AuthShell eyebrow="CLIENT ACCESS" title="客户账号" description="登录后继续浏览收藏与订单；新账号需由来源员工或店铺管理员线下核验并激活。">
    <AuthEndpointProvider basePath={CUSTOMER_AUTH_BASE_PATH}>
      <CustomerAccess storeSlug={query.store ?? ""} refCode={query.ref ?? ""} initialMode={query.mode ?? "login"} returnTo={returnTo}/>
    </AuthEndpointProvider>
  </AuthShell>;
}
