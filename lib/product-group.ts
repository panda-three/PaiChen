import type { ImageAdTarget } from "@/lib/page-config";

type Category = { id: string; name: string };
type Product = { categoryId: string | null; category?: { parentId: string | null } | null };

export function resolveProductGroup(target: Extract<ImageAdTarget, { type: "productGroup" }>, categories: Category[], products: Product[], requestedCategoryId?: string) {
  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const groups = target.groups.flatMap((group) => {
    const category = categoryMap.get(group.categoryId);
    return category ? [{ ...group, name: group.alias || category.name }] : [];
  });
  const active = groups.find((group) => group.categoryId === requestedCategoryId) ?? groups[0];
  const visibleProducts = active ? products.filter((product) => product.categoryId === active.categoryId || product.category?.parentId === active.categoryId).slice(0, active.limit ?? undefined) : [];
  return { groups, active, visibleProducts };
}

export function productNameWithCode(name: string, code: string) {
  const trimmedCode = code.trim();
  return trimmedCode && !name.toLowerCase().includes(trimmedCode.toLowerCase()) ? `${name} ${trimmedCode}` : name;
}
