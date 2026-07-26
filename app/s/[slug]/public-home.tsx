"use client";

import Link from "next/link";
import { ChevronRight, Copy, Phone } from "lucide-react";
import type { PublicCatalog, PublicProduct } from "@/lib/public-catalog";
import type { PageConfigV3, PageComponentV3 } from "@/lib/page-config";
import { storeHref } from "@/lib/public-links";
import { ProductCard } from "@/components/public/product-card";

type Employee = { name: string; phone: string | null; wechat: string | null; title: string | null; bio: string | null; avatarUrl: string | null };
export function PublicHome({ catalog, config, employee, refCode, favoriteIds }: { catalog: PublicCatalog; config: PageConfigV3; employee: Employee; refCode?: string; favoriteIds: string[] }) {
  const favoriteSet = new Set(favoriteIds); const fallback = catalog.products[0]?.mainImageUrl || catalog.store.logoUrl || "";
  const bySource = (component: Extract<PageComponentV3, { type: "productGrid" | "newProducts" }>) => catalog.products.filter((product) => component.source.mode === "all" || (component.source.mode === "category" ? product.categoryId === component.source.categoryId : component.source.productIds.includes(product.id)));
  const productRow = (title: string, products: PublicProduct[], grid = false) => <section className="public-section"><header><h2>{title}</h2><Link href={storeHref(catalog.store.slug, "category", refCode)}>查看全部 <ChevronRight size={14}/></Link></header><div className={grid ? "public-grid" : "public-product-row"}>{products.map((product) => <ProductCard key={product.id} product={product} slug={catalog.store.slug} refCode={refCode} favorite={favoriteSet.has(product.id)} customerActive={catalog.customerActive}/>)}</div>{!products.length && <div className="public-empty">暂无可展示商品</div>}</section>;
  function block(item: PageComponentV3) {
    if (item.type === "heroCarousel") { const slides = item.slides.length ? item.slides : [{ title: catalog.store.name, subtitle: "发现理想生活的更多可能", imageUrl: fallback, href: "" }]; return <section className="public-hero"><div className="public-hero-track">{slides.map((slide, index) => { const body = <><img src={slide.imageUrl || fallback} alt={slide.title}/><span/><div><small>YUNCHENG COLLECTION</small><h1>{slide.title || catalog.store.name}</h1><p>{slide.subtitle}</p></div></>; return slide.href ? <Link key={index} href={slide.href}>{body}</Link> : <div key={index}>{body}</div>; })}</div></section>; }
    if (item.type === "employeeCard") return <section className="public-adviser"><img src={employee.avatarUrl || catalog.store.logoUrl || fallback} alt={employee.name}/><div><small>专属顾问</small><h3>{employee.name} <em>{employee.title || "家居顾问"}</em></h3><p>{employee.bio || "为你提供专业选品服务"}</p></div>{employee.phone && <a href={`tel:${employee.phone}`} aria-label="致电顾问"><Phone size={17}/></a>}{employee.wechat && <button aria-label="复制微信" onClick={() => navigator.clipboard.writeText(employee.wechat!)}><Copy size={17}/></button>}</section>;
    if (item.type === "quickNav") { const items = item.items.length ? item.items : catalog.categories.slice(0, 4).map((category) => ({ title: category.name, imageUrl: catalog.products.find((product) => product.categoryId === category.id)?.mainImageUrl || fallback, href: storeHref(catalog.store.slug, `category?category=${category.id}`, refCode) })); return <nav className="public-quick">{items.map((entry, index) => <Link href={entry.href || storeHref(catalog.store.slug, "category", refCode)} key={index}><img src={entry.imageUrl || fallback} alt=""/><span>{entry.title}</span></Link>)}</nav>; }
    if (item.type === "announcement") return <div className="public-news"><b>云丞动态</b><span>{item.messages[0] || `欢迎来到${catalog.store.name}`}</span></div>;
    if (item.type === "seriesShowcase") { const categories = (item.categoryIds.length ? catalog.categories.filter((category) => item.categoryIds.includes(category.id)) : catalog.categories.slice(0, 2)); return <section className="public-section"><header><h2>{item.title}</h2></header><div className="public-series">{categories.map((category) => <Link href={storeHref(catalog.store.slug, `category?category=${category.id}`, refCode)} key={category.id}><img src={catalog.products.find((product) => product.categoryId === category.id)?.mainImageUrl || fallback} alt=""/><span>{category.name}</span></Link>)}</div></section>; }
    if (item.type === "newProducts") return productRow(item.title, bySource(item).slice(0, 8));
    if (item.type === "productGrid") return productRow(item.title, bySource(item).slice(0, 18), true);
    if (item.type === "storeHeader") return <header className="public-store-head"><img src={catalog.store.logoUrl || fallback} alt=""/><div><h1>{catalog.store.name}</h1><p>{item.subtitle}</p></div></header>;
    if (item.type === "image") return item.link ? <a href={item.link}><img className="public-banner" src={item.url} alt={item.alt}/></a> : <img className="public-banner" src={item.url} alt={item.alt}/>;
    if (item.type === "text" || item.type === "contentCard") return <section className="public-copy">{"imageUrl" in item && item.imageUrl && <img src={item.imageUrl} alt=""/>}<h2>{item.title}</h2><p>{item.body}</p></section>;
    if (item.type === "richText") return <section className="public-copy" dangerouslySetInnerHTML={{ __html: item.html }}/>;
    if (item.type === "productSearch") return <Link className="public-search" href={storeHref(catalog.store.slug, "search", refCode)}>{item.placeholder}</Link>;
    if (item.type === "categoryNav") return <nav className="public-category-pills">{catalog.categories.map((category) => <Link key={category.id} href={storeHref(catalog.store.slug, `category?category=${category.id}`, refCode)}>{category.name}</Link>)}</nav>;
    if (item.type === "video") return <video className="public-banner" controls poster={item.poster} src={item.url}/>;
    return <hr/>;
  }
  return <main className="public-home" style={{ "--public-theme": config.themeColor } as React.CSSProperties}>{config.components.map((item) => <div key={item.id}>{block(item)}</div>)}</main>;
}
