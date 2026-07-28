import { randomUUID } from "node:crypto";
import { Role } from "@prisma/client";
import { productStorage } from "./product-storage";

export const PAGE_ASSETS_BUCKET = "page-assets";
export const PAGE_ASSET_MAX_SIZE = 5 * 1024 * 1024;
export const PAGE_ASSET_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export function canUploadPageAsset(actor: { role: Role; storeId: string | null }, targetStoreId: string, supportStoreId?: string | null) {
  return (actor.role === Role.STORE_ADMIN && actor.storeId === targetStoreId) || (actor.role === Role.PLATFORM_ADMIN && supportStoreId === targetStoreId);
}

export function pageAssetPath(storeId: string, pageId: string, mimeType: string) {
  const extension = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  return `${storeId}/${pageId}/${randomUUID()}.${extension}`;
}

export function pageAssetStorage() {
  return productStorage();
}
