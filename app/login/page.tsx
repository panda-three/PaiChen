import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { auth } from "@/customer-auth";
import { AuthShell } from "@/components/auth-shell";
import { AuthEndpointProvider } from "@/components/auth-endpoint-provider";
import { CUSTOMER_AUTH_BASE_PATH } from "@/lib/auth-scope";
import { CustomerAccess } from "@/app/customer/customer-access";
import { StaffRegistration } from "@/app/login/staff-registration";
import { previewStaffInvitation, staffRoleLabel } from "@/lib/staff-invitations";

function safeReturnTo(value: string | undefined, storeSlug: string | undefined) {
  if (value?.startsWith("/") && !value.startsWith("//")) return value;
  return storeSlug ? `/s/${encodeURIComponent(storeSlug)}` : "/me";
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ store?: string; ref?: string; mode?: string; returnTo?: string; invite?: string }> }) {
  const query = await searchParams;
  const returnTo = safeReturnTo(query.returnTo, query.store);
  const session = await auth();
  if (session?.user?.role === Role.CUSTOMER || session?.user?.role === Role.EMPLOYEE || session?.user?.role === Role.STORE_ADMIN) redirect(returnTo);
  const staffInvitation = query.mode === "staff-register" && query.invite ? await previewStaffInvitation(query.invite) : null;
  if (query.mode === "staff-register") return <AuthShell eyebrow="TEAM ACCESS" title="受邀注册" description="店铺和角色已由邀请绑定，登录账号需与客户手机号账号保持独立。"><AuthEndpointProvider basePath={CUSTOMER_AUTH_BASE_PATH}>{staffInvitation ? <StaffRegistration invite={query.invite ?? ""} storeName={staffInvitation.storeName} role={staffRoleLabel(staffInvitation.role)} maskedPhone={staffInvitation.phone} unavailable={staffInvitation.unavailable}/> : <p className="auth-feedback auth-feedback-error">邀请不存在或链接不完整</p>}</AuthEndpointProvider></AuthShell>;
  return <AuthShell eyebrow="APP ACCESS" title="APP 账号" description="客户使用手机号登录；员工和店铺管理员使用独立登录账号。">
    <AuthEndpointProvider basePath={CUSTOMER_AUTH_BASE_PATH}>
      <CustomerAccess storeSlug={query.store ?? ""} refCode={query.ref ?? ""} initialMode={query.mode ?? "login"} returnTo={returnTo}/>
    </AuthEndpointProvider>
  </AuthShell>;
}
