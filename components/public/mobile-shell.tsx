"use client";

import Link from "next/link";
import { Bot, Grid2X2, Home, ShoppingBag, UserRound } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { usePublicCart } from "./cart-provider";
import { storeHref } from "@/lib/public-links";

export function MobileShell({ slug, children }: { slug: string; children: React.ReactNode }) {
  const pathname = usePathname(); const query = useSearchParams(); const ref = query.get("ref"); const { count } = usePublicCart();
  const items = [
    ["首页", Home, storeHref(slug, "", ref)], ["分类", Grid2X2, storeHref(slug, "category", ref)], ["AI", Bot, storeHref(slug, "ai", ref)], ["开单", ShoppingBag, storeHref(slug, "cart", ref)], ["我的", UserRound, `/me?store=${encodeURIComponent(slug)}${ref ? `&ref=${encodeURIComponent(ref)}` : ""}`],
  ] as const;
  return <div className="public-desktop"><div className="public-phone"><div className="min-h-dvh pb-[82px]">{children}</div><nav className="public-tabs">{items.map(([label, Icon, href]) => { const active = label === "首页" ? pathname === `/s/${slug}` : pathname.startsWith(href.split("?")[0]); return <Link key={label} href={href} className={active ? "active" : ""}><span className="relative"><Icon size={21}/>{label === "开单" && count > 0 && <b>{count > 99 ? "99+" : count}</b>}</span><small>{label}</small></Link>; })}</nav></div></div>;
}
