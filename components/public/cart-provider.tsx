"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { cartStorageKey, normalizeCart, updateCart, type PublicCart } from "@/lib/public-cart";

type CartContextValue = { cart: PublicCart; ready: boolean; count: number; add: (productId: string, variantId: string | null) => void; change: (productId: string, variantId: string | null, amount: number) => void; remark: (productId: string, variantId: string | null, value: string) => void; clear: () => void };
const CartContext = createContext<CartContextValue | null>(null);

export function PublicCartProvider({ slug, children }: { slug: string; children: React.ReactNode }) {
  const [cart, setCart] = useState<PublicCart>({ version: 1, lines: [] });
  const [ready, setReady] = useState(false);
  useEffect(() => { try { setCart(normalizeCart(JSON.parse(localStorage.getItem(cartStorageKey(slug)) ?? "null"))); } catch { setCart({ version: 1, lines: [] }); } setReady(true); }, [slug]);
  useEffect(() => { if (ready) localStorage.setItem(cartStorageKey(slug), JSON.stringify(cart)); }, [cart, ready, slug]);
  const value = useMemo<CartContextValue>(() => ({
    cart, ready, count: cart.lines.reduce((sum, line) => sum + line.quantity, 0),
    add: (productId, variantId) => setCart((value) => updateCart(value, { productId, variantId }, 1)),
    change: (productId, variantId, amount) => setCart((value) => updateCart(value, { productId, variantId }, amount)),
    remark: (productId, variantId, value) => setCart((cartValue) => ({ ...cartValue, lines: cartValue.lines.map((line) => line.productId === productId && line.variantId === variantId ? { ...line, remark: value.slice(0, 200) } : line) })),
    clear: () => setCart({ version: 1, lines: [] }),
  }), [cart, ready]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function usePublicCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("usePublicCart must be used inside PublicCartProvider");
  return value;
}
