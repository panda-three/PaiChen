import type { ImageAdTarget } from "@/lib/page-config";

type Category = { id: string; name: string; parentId?: string | null };
type Product = { categoryId: string | null; category?: { parentId: string | null } | null };

export type ProductGroupEntry = { categoryId: string; name: string; alias?: string; limit: number | null; all?: boolean };
export type ProductGroupBranch = { categoryId: string; name: string; alias?: string; children: ProductGroupEntry[] };

export function resolveProductGroup(target: Extract<ImageAdTarget, { type: "productGroup" }>, categories: Category[], products: Product[], requestedCategoryId?: string) {
  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const groups = target.groups.flatMap((group) => {
    const category = categoryMap.get(group.categoryId);
    return category ? [{ ...group, name: group.alias || category.name }] : [];
  });
  const branches: ProductGroupBranch[] = [];
  const branchMap = new Map<string, ProductGroupBranch>();
  for (const group of groups) {
    const category = categoryMap.get(group.categoryId)!;
    const root = category.parentId && categoryMap.has(category.parentId) ? categoryMap.get(category.parentId)! : category;
    let branch = branchMap.get(root.id);
    if (!branch) {
      branch = { categoryId: root.id, name: root.name, children: [] };
      branchMap.set(root.id, branch);
      branches.push(branch);
    }
    if (category.id === root.id) {
      branch.alias = group.alias;
      branch.children.unshift({ categoryId: root.id, name: "全部", alias: group.alias, limit: group.limit ?? null, all: true });
    } else {
      branch.children.push({ categoryId: category.id, name: category.name, alias: group.alias, limit: group.limit ?? null });
    }
  }
  const active = groups.find((group) => group.categoryId === requestedCategoryId) ?? groups[0];
  const activeCategory = active ? categoryMap.get(active.categoryId) : undefined;
  const visibleProducts = active ? products.filter((product) => activeCategory?.parentId ? product.categoryId === active.categoryId : product.categoryId === active.categoryId || product.category?.parentId === active.categoryId).slice(0, active.limit ?? undefined) : [];
  return { groups, branches, active, visibleProducts };
}

export function productNameWithCode(name: string, code: string) {
  const trimmedCode = code.trim();
  return trimmedCode && !name.toLowerCase().includes(trimmedCode.toLowerCase()) ? `${name} ${trimmedCode}` : name;
}
