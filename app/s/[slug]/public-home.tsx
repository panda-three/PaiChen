"use client";

import Link from "next/link";
import { Building2, ChevronRight, Images, MessageCircle, Phone, PhoneCall, Search, ShieldCheck, Sofa } from "lucide-react";
import type { ReactNode } from "react";
import { useRef, useState } from "react";
import type { PageConfigV4, PageComponentV4 } from "@/lib/page-config";
import { resolveImageAdHref } from "@/lib/page-config";
import { storeHref } from "@/lib/public-links";
import { ProductCard, type ProductCardProduct } from "@/components/public/product-card";
import { scrollCarouselTo } from "@/lib/carousel";

export type HomeProduct = ProductCardProduct & { categoryId: string | null };
export type HomeCatalog = {
  store: { slug: string; name: string; logoUrl: string | null };
  categories: Array<{ id: string; name: string }>;
  products: HomeProduct[];
  customerActive: boolean;
};
export type Employee = { name: string; phone: string | null; wechat: string | null; title: string | null; bio: string | null; avatarUrl: string | null };
type StorePageLink = { id: string; slug: string };

export function PublicHome({ catalog, config, employee, currentPageId, refCode, favoriteIds, pages = [], renderComponent }: { catalog: HomeCatalog; config: PageConfigV4; employee: Employee; currentPageId?: string; refCode?: string; favoriteIds: string[]; pages?: StorePageLink[]; renderComponent?: (component: PageComponentV4, content: ReactNode) => ReactNode }) {
  const favoriteSet = new Set(favoriteIds);
  const fallback = catalog.products[0]?.mainImageUrl || catalog.store.logoUrl || "";
  const [activeGroups, setActiveGroups] = useState<Record<string, string>>({});
  const [activeSlides, setActiveSlides] = useState<Record<string, number>>({});
  const heroRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const bySource = (component: Extract<PageComponentV4, { type: "productGrid" | "newProducts" }>) => catalog.products.filter((product) => component.source.mode === "all" || (component.source.mode === "category" ? product.categoryId === component.source.categoryId : component.source.productIds.includes(product.id)));
  const productRow = (component: Extract<PageComponentV4, { type: "productGrid" | "newProducts" }>, products: HomeProduct[], grid = false) => <section className={`public-section ${component.type === "productGrid" && component.layout === "yuncheng" ? "public-yuncheng-products" : ""}`}><header><div><h2>{component.title}</h2>{"subtitle" in component && component.subtitle && <p>{component.subtitle}</p>}</div><Link href={storeHref(catalog.store.slug, "category", refCode)}>查看全部 <ChevronRight size={14}/></Link></header>{component.type === "productGrid" && component.layout === "yuncheng" ? <div className="public-picture-grid">{products.map((product) => <Link href={storeHref(catalog.store.slug, `product/${product.id}`, refCode)} key={product.id}><img src={product.mainImageUrl} alt={product.name}/><span>{product.name}</span></Link>)}</div> : <div className={grid ? "public-grid" : "public-product-row"}>{products.map((product) => <ProductCard key={product.id} product={product} slug={catalog.store.slug} refCode={refCode} favorite={favoriteSet.has(product.id)} customerActive={catalog.customerActive}/>)}</div>}{!products.length && <div className="public-empty">暂无可展示商品</div>}</section>;

  function block(item: PageComponentV4) {
    if (item.type === "heroCarousel") {
      const slides = item.slides.length ? item.slides : [{ imageUrl: fallback, alt: "" }];
      const active = activeSlides[item.id] ?? 0;
      return <section className="public-hero"><div className="public-hero-track" ref={(node)=>{heroRefs.current[item.id]=node}} onScroll={(event)=>{const width=event.currentTarget.clientWidth;if(width)setActiveSlides((current)=>({...current,[item.id]:Math.round(event.currentTarget.scrollLeft/width)}))}}>{slides.map((slide, index) => <div key={index}><img src={slide.imageUrl || fallback} alt={slide.alt}/><i>{index + 1} / {slides.length}</i></div>)}</div><nav className="public-hero-dots" aria-label="轮播切换">{slides.map((_,index)=><button type="button" className={active===index?"active":""} aria-label={`第 ${index+1} 张`} onClick={()=>scrollCarouselTo(heroRefs.current[item.id],index)} key={index}/>)}</nav></section>;
    }
    if (item.type === "employeeCard") return <section className={`public-adviser public-adviser-${item.style}`}><img src={employee.avatarUrl || catalog.store.logoUrl || fallback} alt={employee.name}/><div><strong>{employee.title || "店铺顾问"}</strong><h3>{employee.name}</h3><p>{employee.bio || "为你提供专业选品服务"}</p></div><nav>{employee.phone && <a href={`tel:${employee.phone}`} aria-label={`致电 ${employee.phone}`}><Phone size={17}/><span>电话</span><small className="public-contact-tip" role="tooltip">{employee.phone}</small></a>}{employee.wechat && <button aria-label={`复制微信号 ${employee.wechat}`} onClick={() => navigator.clipboard.writeText(employee.wechat!)}><MessageCircle size={17}/><span>微信</span><small className="public-contact-tip" role="tooltip">{employee.wechat}</small></button>}</nav></section>;
    if (item.type === "quickNav") { const iconMap={building:Building2,sofa:Sofa,images:Images,shield:ShieldCheck,phone:PhoneCall}; const pageMap=new Map(pages.map((page)=>[page.id,page.slug])); const entries = item.items.length ? item.items.slice(0, 5) : catalog.categories.slice(0, 5).map((category) => ({ title: category.name, imageUrl: "", href: storeHref(catalog.store.slug, `category?category=${category.id}`, refCode) })); return <nav className="public-quick">{entries.map((entry, index) => {const Icon="icon" in entry&&entry.icon?iconMap[entry.icon]:ChevronRight;const pageSlug="pageId" in entry&&entry.pageId?pageMap.get(entry.pageId):undefined;const href=pageSlug?storeHref(catalog.store.slug,`p/${pageSlug}`,refCode):entry.href||storeHref(catalog.store.slug,"category",refCode);return <Link href={href} key={index}><span className="public-quick-icon">{entry.imageUrl ? <img src={entry.imageUrl} alt=""/> : <Icon size={20}/>}</span><b>{entry.title}</b></Link>})}</nav>; }
    if (item.type === "announcement") return <div className="public-news"><b>限时活动</b><span>{item.messages[0] || `欢迎来到${catalog.store.name}`}</span></div>;
    if (item.type === "seriesShowcase") { const categories = (item.categoryIds.length ? catalog.categories.filter((category) => item.categoryIds.includes(category.id)) : catalog.categories.slice(0, 2)); return <section className="public-section"><header><h2>{item.title}</h2></header><div className="public-series">{categories.map((category) => <Link href={storeHref(catalog.store.slug, `category?category=${category.id}`, refCode)} key={category.id}><img src={catalog.products.find((product) => product.categoryId === category.id)?.mainImageUrl || fallback} alt=""/><span>{category.name}</span></Link>)}</div></section>; }
    if (item.type === "newProducts") return productRow(item, bySource(item).slice(0, 8));
    if (item.type === "productGrid") return productRow(item, bySource(item).slice(0, item.limit ?? 18), true);
    if (item.type === "productGroupTabs") {
      const first = item.groups[0]?.categoryId ?? "";
      const active = activeGroups[item.id] || first;
      const group = item.groups.find((entry) => entry.categoryId === active);
      const category = catalog.categories.find((entry) => entry.id === active);
      const visible = catalog.products.filter((product) => product.categoryId === active).slice(0, group?.limit ?? undefined);
      return <section className="public-section public-groups"><header><h2>{item.title}</h2></header><nav>{item.groups.map((entry) => <button className={active === entry.categoryId ? "active" : ""} onClick={() => setActiveGroups((current) => ({ ...current, [item.id]: entry.categoryId }))} key={entry.categoryId}>{entry.alias || catalog.categories.find((value) => value.id === entry.categoryId)?.name || "已失效分组"}</button>)}</nav>{group && category ? <div className="public-grid">{visible.map((product) => <ProductCard key={product.id} product={product} slug={catalog.store.slug} refCode={refCode} favorite={favoriteSet.has(product.id)} customerActive={catalog.customerActive}/>)}</div> : <div className="public-empty">暂无可展示商品</div>}</section>;
    }
    if (item.type === "imageAd") {
      const context = { storeSlug: catalog.store.slug, refCode, productIds: new Set(catalog.products.map((product) => product.id)), categoryIds: new Set(catalog.categories.map((category) => category.id)), pages: new Map(pages.map((page) => [page.id, page.slug])) };
      return <section className={`public-image-ads public-image-ads-${item.layout} ${item.title||item.subtitle?"public-image-ads-section":"public-image-ads-content"}`}>{(item.title||item.subtitle)&&<header><p>{item.subtitle}</p><h2>{item.title}</h2></header>}<div>{item.items.map((entry) => { const href = resolveImageAdHref(entry.target, { ...context, pageId: currentPageId, itemId: entry.id }); const picture = <><img src={entry.imageUrl} alt={entry.alt}/>{(entry.title||entry.subtitle)&&<span><b>{entry.title}</b><small>{entry.subtitle}</small></span>}</>; if (!href) return <div key={entry.id}>{picture}</div>; const external = /^https?:\/\//i.test(href); return <a href={href} key={entry.id} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{picture}</a>; })}</div></section>;
    }
    if (item.type === "storeHeader") { const imageSource = item.imageSource; const image = imageSource?.type === "productMainImage" ? catalog.products.find((product) => product.id === imageSource.productId)?.mainImageUrl : catalog.store.logoUrl; return <header className="public-store-head"><img src={image || fallback} alt=""/><div><h1>{item.name ?? catalog.store.name}</h1><p>{item.subtitle}</p></div></header>; }
    if (item.type === "text" || item.type === "contentCard") return <section className="public-copy">{"imageUrl" in item && item.imageUrl && <img src={item.imageUrl} alt=""/>}<h2>{item.title}</h2><p>{item.body}</p></section>;
    if (item.type === "richText") return <section className="public-copy" dangerouslySetInnerHTML={{ __html: item.html }}/>; // sanitized while parsing
    if (item.type === "productSearch") return <Link className={`public-search public-search-${item.style}`} href={storeHref(catalog.store.slug, "search", refCode)}><Search size={16}/><span>{item.placeholder}</span></Link>;
    if (item.type === "categoryNav") return <nav className="public-category-pills">{catalog.categories.map((category) => <Link key={category.id} href={storeHref(catalog.store.slug, `category?category=${category.id}`, refCode)}>{category.name}</Link>)}</nav>;
    if (item.type === "video") return <video className="public-banner" controls poster={item.poster} src={item.url}/>;
    return <hr/>;
  }
  return <main className="public-home" style={{ "--public-theme": config.themeColor } as React.CSSProperties}>{config.components.map((item) => { const content = block(item); return renderComponent ? renderComponent(item, content) : <div key={item.id}>{content}</div>; })}</main>;
}
