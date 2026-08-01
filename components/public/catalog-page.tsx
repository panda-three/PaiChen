"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { PublicCatalog } from "@/lib/public-catalog";
import { ProductCard } from "./product-card";
import { categoryProductMatches } from "@/lib/category-tree";

export function CatalogPage({ catalog, refCode, initialCategory = "all", initialQuery = "", searchOnly = false, favoriteIds = [] }: { catalog: PublicCatalog; refCode?: string; initialCategory?: string; initialQuery?: string; searchOnly?: boolean; favoriteIds?: string[] }) {
  const validInitial = catalog.categories.some((item) => item.id === initialCategory) ? initialCategory : "all";
  const initialNode = catalog.categories.find((item) => item.id === validInitial);
  const [root, setRoot] = useState(initialNode?.parentId ?? validInitial); const [category, setCategory] = useState(initialNode?.parentId ? validInitial : "all"); const [query, setQuery] = useState(initialQuery); const favorites = new Set(favoriteIds);
  const roots = catalog.categories.filter((item) => !item.parentId);
  const children = root === "all" ? [] : catalog.categories.filter((item) => item.parentId === root);
  const selected = category !== "all" ? category : root;
  const products = useMemo(() => catalog.products.filter((product) => (selected === "all" || categoryProductMatches(selected, product.categoryId, product.category?.parentId ?? null)) && (!query || `${product.name} ${product.code}`.toLowerCase().includes(query.toLowerCase()))), [catalog.products, selected, query]);
  return <main className="public-catalog"><header className="public-page-head"><h1>{searchOnly ? "搜索" : "全部分类"}</h1><label><Search size={18}/><input autoFocus={searchOnly} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索商品名称或编号"/></label></header>{!searchOnly && <div className="public-category-layout"><nav className="public-category-roots"><button className={root === "all" ? "active" : ""} onClick={() => { setRoot("all"); setCategory("all"); }}>全部</button>{roots.map((item) => <button className={root === item.id ? "active" : ""} onClick={() => { setRoot(item.id); setCategory("all"); }} key={item.id}>{item.name}</button>)}</nav><section className="public-category-content">{root !== "all" && <nav className="public-category-children"><button className={category === "all" ? "active" : ""} onClick={() => setCategory("all")}>全部</button>{children.map((item) => <button className={category === item.id ? "active" : ""} onClick={() => setCategory(item.id)} key={item.id}>{item.name}</button>)}</nav>}<p className="public-result">共 {products.length} 件商品</p><div className="public-grid">{products.map((product) => <ProductCard key={product.id} product={product} slug={catalog.store.slug} refCode={refCode} favorite={favorites.has(product.id)} customerActive={catalog.customerActive}/>)}</div>{!products.length && <div className="public-empty">没有找到匹配的商品</div>}</section></div>}{searchOnly && <section className="public-section"><p className="public-result">共 {products.length} 件商品</p><div className="public-grid">{products.map((product) => <ProductCard key={product.id} product={product} slug={catalog.store.slug} refCode={refCode} favorite={favorites.has(product.id)} customerActive={catalog.customerActive}/>)}</div>{!products.length && <div className="public-empty">没有找到匹配的商品</div>}</section>}</main>;
}
