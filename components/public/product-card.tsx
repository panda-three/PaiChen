"use client";

import Link from "next/link";
import { Heart, Plus } from "lucide-react";
import { usePublicCart } from "./cart-provider";
import { storeHref, customerHref } from "@/lib/public-links";
import type { PublicProduct } from "@/lib/public-catalog";

export type ProductCardProduct = Pick<PublicProduct, "id" | "name" | "mainImageUrl" | "price" | "specification"> & {
  variants: Array<Pick<PublicProduct["variants"][number], "id" | "name">>;
};

export function ProductCard({ product, slug, refCode, favorite = false, customerActive = false }: { product: ProductCardProduct; slug: string; refCode?: string; favorite?: boolean; customerActive?: boolean }) {
  const { add } = usePublicCart();
  async function toggleFavorite() { if (!customerActive) { location.href = customerHref(slug, refCode, location.pathname + location.search); return; } await fetch("/api/favorites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeSlug: slug, productId: product.id }) }); location.reload(); }
  return <article className="public-product"><Link href={storeHref(slug, `product/${product.id}`, refCode)}><img src={product.mainImageUrl} alt={product.name}/></Link><div><div className="flex items-start justify-between gap-2"><Link href={storeHref(slug, `product/${product.id}`, refCode)}><h3>{product.name}</h3></Link><button aria-label="收藏" onClick={() => void toggleFavorite()}><Heart size={17} fill={favorite ? "currentColor" : "none"}/></button></div><p>{product.variants[0]?.name || product.specification}</p><footer><strong>{product.price ? `¥${Number(product.price).toLocaleString()}` : "价格面议"}</strong><button aria-label="加入开单" onClick={() => add(product.id, product.variants[0]?.id ?? null)}><Plus size={16}/></button></footer></div></article>;
}
