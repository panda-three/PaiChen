import Link from "next/link";
import { Role, User } from "@prisma/client";
import { BarChart3, Building2, ClipboardList, Contact, FileStack, FolderTree, History, Link2, LogOut, Package, Settings, Store, Users } from "lucide-react";
import { signOut } from "@/auth";

const menu = {
  [Role.PLATFORM_ADMIN]: [
    { href: "/admin/organizations", label: "组织与配额", icon: Building2 },
    { href: "/admin/stores", label: "店铺管理", icon: Store },
  ],
  [Role.ENTERPRISE_ADMIN]: [
    { href: "/admin/enterprise", label: "企业工作台", icon: Building2 },
    { href: "/admin/enterprise/products", label: "产品与授权", icon: Package },
  ],
  [Role.STORE_ADMIN]: [
    { href: "/admin/dashboard", label: "工作台", icon: BarChart3 },
    { href: "/admin/store", label: "店铺资料", icon: Settings },
    { href: "/admin/employees", label: "员工管理", icon: Users },
    { href: "/admin/categories", label: "商品分类", icon: FolderTree },
    { href: "/admin/products", label: "商品管理", icon: Package },
    { href: "/admin/authorizations", label: "商品授权", icon: Link2 },
    { href: "/admin/pages", label: "页面装修", icon: FileStack },
    { href: "/admin/leads", label: "客户线索", icon: Contact },
    { href: "/admin/customers", label: "客户档案/审核", icon: Users },
    { href: "/admin/orders", label: "订单管理", icon: ClipboardList },
    { href: "/admin/analytics", label: "经营分析", icon: BarChart3 },
    { href: "/admin/logs", label: "操作记录", icon: History },
  ],
  [Role.EMPLOYEE]: [
    { href: "/admin/dashboard", label: "工作台", icon: BarChart3 },
    { href: "/admin/share", label: "我的分享", icon: Link2 },
    { href: "/admin/leads", label: "我的客户", icon: Contact },
    { href: "/admin/customers", label: "客户审核", icon: Users },
    { href: "/admin/orders", label: "我的订单", icon: ClipboardList },
  ],
  [Role.CUSTOMER]: [],
};

export function AdminShell({ actor, children }: { actor: User & { store: { name: string } | null }; children: React.ReactNode }) {
  return <div className="min-h-screen lg:grid lg:grid-cols-[226px_1fr]">
    <aside className="bg-[#17231c] text-white lg:fixed lg:inset-y-0 lg:w-[226px]">
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5"><div className="grid size-8 place-items-center rounded bg-[#d9a441] font-black text-[#17231c]">云</div><strong>云丞商城后台</strong></div>
      <nav className="flex gap-1 overflow-x-auto p-3 lg:block lg:space-y-1">
        {(menu[actor.role] ?? []).map(({ href, label, icon: Icon }) => <Link key={href} href={href} className="flex min-w-max items-center gap-3 rounded px-3 py-2.5 text-sm text-white/75 hover:bg-white/10 hover:text-white"><Icon size={17} />{label}</Link>)}
      </nav>
    </aside>
    <div className="lg:col-start-2">
      <header className="flex h-16 items-center justify-between border-b border-[#e2e7e3] bg-white px-5 lg:px-8"><div><strong className="text-sm">{actor.store?.name ?? "平台总后台"}</strong><span className="ml-2 text-xs text-[#7c857e]">{actor.name}</span></div><form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}><button className="btn min-h-9 px-3 text-sm" title="退出登录"><LogOut size={16} />退出</button></form></header>
      <main className="p-5 lg:p-8">{children}</main>
    </div>
  </div>;
}
