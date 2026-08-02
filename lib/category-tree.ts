export type CategoryNode = { id: string; name: string; parentId: string | null; isActive?: boolean };
export type CategoryBranch<T extends CategoryNode = CategoryNode> = { root: T; children: T[] };

export function categoryProductMatches(categoryId: string, productCategoryId: string | null, productParentId: string | null) {
  return productCategoryId === categoryId || productParentId === categoryId;
}

export function categoryPath(category: CategoryNode, categories: CategoryNode[]) {
  if (!category.parentId) return category.name;
  const parent = categories.find((item) => item.id === category.parentId);
  return parent ? `${parent.name} / ${category.name}` : category.name;
}

export function activeSecondLevelCategories(categories: CategoryNode[]) {
  const activeRoots = new Set(categories.filter((item) => !item.parentId && item.isActive !== false).map((item) => item.id));
  return categories.filter((item) => item.parentId && item.isActive !== false && activeRoots.has(item.parentId));
}

export function buildCategoryBranches<T extends CategoryNode>(categories: T[], query = ""): CategoryBranch<T>[] {
  const byParent = new Map<string | null, T[]>();
  for (const category of categories) byParent.set(category.parentId, [...(byParent.get(category.parentId) ?? []), category]);
  const needle = query.trim().toLowerCase();
  return (byParent.get(null) ?? [])
    .map((root) => {
      const children = byParent.get(root.id) ?? [];
      const rootMatches = !needle || root.name.toLowerCase().includes(needle);
      return { root, children: rootMatches ? children : children.filter((child) => child.name.toLowerCase().includes(needle)) };
    })
    .filter(({ root, children }) => !needle || root.name.toLowerCase().includes(needle) || children.length > 0);
}

export function paginateCategoryBranches<T extends CategoryNode>(branches: CategoryBranch<T>[], page: number, pageSize: number) {
  return branches.slice(Math.max(0, page) * pageSize, Math.max(0, page) * pageSize + pageSize);
}
