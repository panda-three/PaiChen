"use client";

import Link from "next/link";
import { useState } from "react";
import { productNameWithCode } from "@/lib/product-group";
import type { ProductGroupBranch, ProductGroupEntry } from "@/lib/product-group";
import { storeHref } from "@/lib/public-links";

type Product = { id: string; name: string; code: string; mainImageUrl: string; categoryId: string | null; parentCategoryId?: string | null };

export function GroupCatalog({ slug, refCode, branches: inputBranches, groups, products }: { slug: string; refCode?: string; branches?: ProductGroupBranch[]; groups?: Array<{ categoryId: string; name: string; limit: number | null }>; products: Product[] }) {
  const branches: ProductGroupBranch[] = inputBranches ?? (groups ?? []).map((group) => ({ categoryId: group.categoryId, name: group.name, alias: undefined, children: [{ ...group, all: true }] }));
  const [activeBranchId, setActiveBranchId] = useState(branches[0]?.categoryId ?? "");
  const branch = branches.find((entry) => entry.categoryId === activeBranchId) ?? branches[0];
  const [activeId, setActiveId] = useState(branch?.children[0]?.categoryId ?? "");
  const active = branch?.children.find((entry) => entry.categoryId === activeId) ?? branch?.children[0];
  const visible = active ? products.filter((product) => active.all ? product.categoryId === branch.categoryId || product.parentCategoryId === branch.categoryId : product.categoryId === active.categoryId).slice(0, active.limit ?? undefined) : [];
  if (!branches.length) return <div className="public-group-empty">配置的商品分类已失效</div>;
  const selectBranch = (next: ProductGroupBranch) => { setActiveBranchId(next.categoryId); setActiveId(next.children[0]?.categoryId ?? ""); };
  return <><nav className="public-group-roots">{branches.map((entry) => <button type="button" className={entry.categoryId === branch?.categoryId ? "active" : ""} onClick={() => selectBranch(entry)} key={entry.categoryId}>{entry.alias || entry.name}</button>)}</nav><nav className="public-group-tabs">{branch?.children.map((entry: ProductGroupEntry) => <button type="button" className={entry.categoryId === active?.categoryId ? "active" : ""} onClick={() => setActiveId(entry.categoryId)} key={entry.categoryId}>{entry.alias || entry.name}</button>)}</nav>{visible.length ? <div className="public-group-grid">{visible.map((product) => <Link href={storeHref(slug, `product/${product.id}`, refCode)} key={product.id}><img src={product.mainImageUrl} alt={product.name}/><span>{productNameWithCode(product.name, product.code)}</span></Link>)}</div> : <div className="public-group-empty">当前分类暂无可展示商品</div>}</>;
}
