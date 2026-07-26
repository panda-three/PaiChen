export function storeHref(slug: string, path = "", ref?: string | null) {
  const base = `/s/${encodeURIComponent(slug)}${path ? `/${path.replace(/^\/+/, "")}` : ""}`;
  if (!ref) return base;
  const join = base.includes("?") ? "&" : "?";
  return `${base}${join}ref=${encodeURIComponent(ref)}`;
}

export function customerHref(slug: string, ref: string | null | undefined, returnTo: string) {
  const params = new URLSearchParams({ store: slug, returnTo });
  if (ref) params.set("ref", ref);
  return `/customer?${params}`;
}
