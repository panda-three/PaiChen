"use client";

import Link from "next/link";
import { useState } from "react";
import { productNameWithCode } from "@/lib/product-group";
import { storeHref } from "@/lib/public-links";

type Group = { categoryId: string; name: string; limit: number | null };
type Product = { id: string; name: string; code: string; mainImageUrl: string; categoryId: string | null; parentCategoryId?: string | null };

export function GroupCatalog({ slug, refCode, groups, products }: { slug: string; refCode?: string; groups: Group[]; products: Product[] }) {
  const [activeId, setActiveId] = useState(groups[0]?.categoryId ?? "");
  const active = groups.find((group) => group.categoryId === activeId) ?? groups[0];
  const visible = active ? products.filter((product) => product.categoryId === active.categoryId || product.parentCategoryId === active.categoryId).slice(0, active.limit ?? undefined) : [];
  if (!groups.length) return <div className="public-group-empty">配置的商品分类已失效</div>;
  return <><nav className="public-group-tabs">{groups.map((group) => <button type="button" className={group.categoryId === active?.categoryId ? "active" : ""} onClick={() => setActiveId(group.categoryId)} key={group.categoryId}>{group.name}</button>)}</nav>{visible.length ? <div className="public-group-grid">{visible.map((product) => <Link href={storeHref(slug, `product/${product.id}`, refCode)} key={product.id}><img src={product.mainImageUrl} alt={product.name}/><span>{productNameWithCode(product.name, product.code)}</span></Link>)}</div> : <div className="public-group-empty">当前分类暂无可展示商品</div>}</>;
}
