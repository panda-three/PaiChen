export type CartLine = { productId: string; variantId: string | null; quantity: number; remark: string };
export type PublicCart = { version: 1; lines: CartLine[] };

export const cartStorageKey = (slug: string) => `yc-cart:${slug}:v1`;

export function normalizeCart(input: unknown): PublicCart {
  if (!input || typeof input !== "object" || (input as { version?: unknown }).version !== 1 || !Array.isArray((input as { lines?: unknown }).lines)) return { version: 1, lines: [] };
  const lines = (input as PublicCart).lines.filter((line) => line && typeof line.productId === "string" && line.productId && (line.variantId === null || typeof line.variantId === "string") && Number.isInteger(line.quantity) && line.quantity > 0 && line.quantity <= 999 && typeof line.remark === "string").map((line) => ({ ...line, remark: line.remark.slice(0, 200) }));
  return { version: 1, lines };
}

export function updateCart(cart: PublicCart, line: Omit<CartLine, "quantity" | "remark">, change: number) {
  const key = `${line.productId}:${line.variantId ?? ""}`;
  const current = cart.lines.find((item) => `${item.productId}:${item.variantId ?? ""}` === key);
  const quantity = Math.min(999, (current?.quantity ?? 0) + change);
  const lines = cart.lines.filter((item) => `${item.productId}:${item.variantId ?? ""}` !== key);
  if (quantity > 0) lines.push({ ...line, quantity, remark: current?.remark ?? "" });
  return { version: 1 as const, lines };
}
