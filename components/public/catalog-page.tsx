"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { PublicCatalog } from "@/lib/public-catalog";
import { ProductCard } from "./product-card";

export function CatalogPage({ catalog, refCode, initialCategory = "all", initialQuery = "", searchOnly = false, favoriteIds = [] }: { catalog: PublicCatalog; refCode?: string; initialCategory?: string; initialQuery?: string; searchOnly?: boolean; favoriteIds?: string[] }) {
  const [category, setCategory] = useState(initialCategory); const [query, setQuery] = useState(initialQuery); const favorites = new Set(favoriteIds);
  const products = useMemo(() => catalog.products.filter((product) => (category === "all" || product.categoryId === category) && (!query || `${product.name} ${product.code}`.toLowerCase().includes(query.toLowerCase()))), [catalog.products, category, query]);
  return <main className="public-catalog"><header className="public-page-head"><h1>{searchOnly ? "搜索" : "全部分类"}</h1><label><Search size={18}/><input autoFocus={searchOnly} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索商品名称或编号"/></label></header>{!searchOnly && <nav className="public-category-tabs"><button className={category === "all" ? "active" : ""} onClick={() => setCategory("all")}>全部</button>{catalog.categories.map((item) => <button className={category === item.id ? "active" : ""} onClick={() => setCategory(item.id)} key={item.id}>{item.name}</button>)}</nav>}<section className="public-section"><p className="public-result">共 {products.length} 件商品</p><div className="public-grid">{products.map((product) => <ProductCard key={product.id} product={product} slug={catalog.store.slug} refCode={refCode} favorite={favorites.has(product.id)} customerActive={catalog.customerActive}/>)}</div>{!products.length && <div className="public-empty">没有找到匹配的商品</div>}</section></main>;
}
