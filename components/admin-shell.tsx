import Link from "next/link";
import { Role, User } from "@prisma/client";
import { LogOut } from "lucide-react";
import { signOut } from "@/admin-auth";
import { AdminNav } from "@/components/admin-nav";

export function AdminShell({ actor, children }: { actor: User & { store: { name: string } | null }; children: React.ReactNode }) {
  return <div className="admin-app">
    <aside className="admin-sidebar">
      <Link href="/admin" className="admin-logo"><span>YC</span><div><strong>云丞</strong><small>RETAIL CONSOLE</small></div></Link>
      <AdminNav role={actor.role as Role} />
      <p className="admin-sidebar-note">YUNCHENG COMMERCE</p>
    </aside>
    <div className="admin-workspace">
      <header className="admin-topbar"><div><strong>{actor.store?.name ?? "平台总后台"}</strong><span>{actor.name}</span></div><form action={async () => { "use server"; await signOut({ redirectTo: "/admin/login" }); }}><button className="admin-logout" title="退出登录" aria-label="退出登录"><LogOut size={17} /></button></form></header>
      <main className="admin-main">{children}</main>
    </div>
  </div>;
}
