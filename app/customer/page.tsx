import { CustomerAccess } from "./customer-access";

export default async function CustomerPage({ searchParams }: { searchParams: Promise<{ store?: string; ref?: string; mode?: string }> }) {
  const query = await searchParams;
  return <main className="grid min-h-screen place-items-center bg-[#f5f2ec] p-5"><section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"><h1 className="text-2xl font-bold">客户账号</h1><p className="muted mt-2 text-sm">注册后由来源员工或店铺管理员线下核验手机号并激活。</p><CustomerAccess storeSlug={query.store ?? ""} refCode={query.ref ?? ""} initialMode={query.mode ?? "login"}/></section></main>;
}
