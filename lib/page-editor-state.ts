import type { PageComponentV2 } from "@/lib/page-config";

export function insertPageComponent(
  components: PageComponentV2[],
  component: PageComponentV2,
  targetId?: string,
  position: "before" | "after" = "after",
) {
  if (!targetId) return [...components, component];
  const targetIndex = components.findIndex((item) => item.id === targetId);
  if (targetIndex < 0) return components;
  const next = [...components];
  next.splice(targetIndex + (position === "after" ? 1 : 0), 0, component);
  return next;
}

export function movePageComponent(components: PageComponentV2[], activeId: string, targetId?: string) {
  const activeIndex = components.findIndex((item) => item.id === activeId);
  if (activeIndex < 0) return components;
  const targetIndex = targetId ? components.findIndex((item) => item.id === targetId) : components.length - 1;
  if (targetIndex < 0 || targetIndex === activeIndex) return components;
  const next = [...components];
  const [component] = next.splice(activeIndex, 1);
  next.splice(targetIndex, 0, component);
  return next;
}

export function removePageComponent(components: PageComponentV2[], id: string, selectedId: string) {
  const removedIndex = components.findIndex((item) => item.id === id);
  if (removedIndex < 0) return { components, selectedId };
  const next = components.filter((item) => item.id !== id);
  if (selectedId !== id) return { components: next, selectedId };
  return { components: next, selectedId: next[removedIndex]?.id ?? next[removedIndex - 1]?.id ?? "" };
}
