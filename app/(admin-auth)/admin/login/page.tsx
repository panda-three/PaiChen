import { redirect } from "next/navigation";
import { auth } from "@/admin-auth";
import { AdminLoginForm } from "@/components/admin-login-form";
import { AuthEndpointProvider } from "@/components/auth-endpoint-provider";
import { AuthShell } from "@/components/auth-shell";
import { ADMIN_AUTH_BASE_PATH } from "@/lib/auth-scope";

export default async function AdminLoginPage() {
  if ((await auth())?.user) redirect("/admin");
  return <AuthShell eyebrow="STAFF ACCESS" title="后台账号登录" description="商品展示、客户开单与门店跟进后台" footer={<p>演示账号：platform_admin、store_a_admin、employee_a<br />密码为初始化数据库时设置的 <code>SEED_PASSWORD</code>。</p>}>
    <AuthEndpointProvider basePath={ADMIN_AUTH_BASE_PATH}>
      <AdminLoginForm />
    </AuthEndpointProvider>
  </AuthShell>;
}
