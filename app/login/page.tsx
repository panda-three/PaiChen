import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  if ((await auth())?.user) redirect("/admin");
  return <AuthShell eyebrow="STAFF ACCESS" title="后台账号登录" description="商品展示、客户开单与门店跟进后台" footer={<p>演示账号：platform_admin、store_a_admin、employee_a<br />密码为初始化数据库时设置的 <code>SEED_PASSWORD</code>。</p>}>
    <LoginForm />
  </AuthShell>;
}
