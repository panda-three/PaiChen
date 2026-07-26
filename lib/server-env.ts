export function defaultPublicStoreSlug(env: NodeJS.ProcessEnv = process.env) {
  const slug = env.DEFAULT_PUBLIC_STORE_SLUG?.trim();
  if (!slug) throw new Error("Missing required server environment variable: DEFAULT_PUBLIC_STORE_SLUG");
  return slug;
}

export function validatePreviewStoreSlug(env: NodeJS.ProcessEnv = process.env) {
  if (env.VERCEL_ENV !== "preview") return null;
  const slug = env.PREVIEW_STORE_SLUG?.trim();
  if (!slug) throw new Error("Missing required server environment variable: PREVIEW_STORE_SLUG");
  return slug;
}
