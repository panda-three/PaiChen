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
  return <AuthShell eyebrow="CLIENT ACCESS" title="客户账号" description="注册后即可登录并继续浏览店铺与意向单；忘记密码仍由店铺人工核验。">
    <AuthEndpointProvider basePath={CUSTOMER_AUTH_BASE_PATH}>
      <CustomerAccess storeSlug={query.store ?? ""} refCode={query.ref ?? ""} initialMode={query.mode ?? "login"} returnTo={returnTo}/>
    </AuthEndpointProvider>
  </AuthShell>;
}
