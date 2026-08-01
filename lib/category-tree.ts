export type CategoryNode = { id: string; name: string; parentId: string | null; isActive?: boolean };

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
