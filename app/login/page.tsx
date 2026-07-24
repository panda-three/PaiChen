import { redirect } from "next/navigation";
import { Store } from "lucide-react";
import { auth } from "@/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  if ((await auth())?.user) redirect("/admin");
  return <main className="grid min-h-screen place-items-center bg-[#edf1ee] p-5">
    <section className="w-full max-w-[420px] overflow-hidden rounded-lg border border-[#dce3de] bg-white shadow-[0_18px_60px_rgba(23,46,31,.12)]">
      <div className="bg-[#173f2d] px-7 py-7 text-white">
        <div className="mb-5 grid size-11 place-items-center rounded-md bg-[#d9a441] text-[#173f2d]"><Store size={24} /></div>
        <h1 className="text-2xl font-bold">云丞 AI 商城</h1>
        <p className="mt-2 text-sm text-white/70">商品展示、客户开单与门店跟进后台</p>
      </div>
      <div className="p-7"><LoginForm /><p className="mt-5 text-xs leading-5 text-[#788179]">演示账号：platform_admin、store_a_admin、employee_a<br />密码为初始化数据库时设置的 `SEED_PASSWORD`。</p></div>
    </section>
  </main>;
}
