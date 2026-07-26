export type DeploymentScope = { isPreview: boolean; previewStoreSlug: string | null };

export function deploymentScope(env: NodeJS.ProcessEnv = process.env): DeploymentScope {
  const isPreview = env.VERCEL_ENV === "preview";
  return { isPreview, previewStoreSlug: isPreview ? validatePreviewStoreSlug(env) : null };
}

export function canAccessPublicStore(slug: string, scope = deploymentScope()) {
  return !scope.isPreview || Boolean(scope.previewStoreSlug && scope.previewStoreSlug === slug);
}

export function assertPublicStoreWrite(slug: string, scope = deploymentScope()) {
  if (!canAccessPublicStore(slug, scope)) throw new Error("PREVIEW_STORE_FORBIDDEN");
}
import { validatePreviewStoreSlug } from "./server-env";
