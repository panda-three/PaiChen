"use client";

import Link from "next/link";
import { Role } from "@prisma/client";
import { usePathname } from "next/navigation";
import { BarChart3, Building2, ClipboardList, Contact, FileStack, FolderTree, History, Link2, Package, Settings, Store, Users } from "lucide-react";

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

export function AdminNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = menu[role] ?? [];
  const currentHref = findCurrentHref(pathname, items.map(({ href }) => href));

  return <nav className="admin-nav" aria-label="后台主导航">
    {items.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className="admin-nav-item" aria-current={href === currentHref ? "page" : undefined}>
      <Icon size={17} aria-hidden="true" />
      <span>{label}</span>
    </Link>)}
  </nav>;
}

export function findCurrentHref(pathname: string, hrefs: string[]) {
  return hrefs
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];
}
