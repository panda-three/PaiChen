import { randomUUID } from "crypto";
import { productStorage } from "./product-storage";

export const CUSTOMER_ASSETS_BUCKET = "customer-assets";
export const CUSTOMER_ASSET_MAX_SIZE = 5 * 1024 * 1024;
export const CUSTOMER_ASSET_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type CustomerAssetType = "avatar";
export type StaffAssetType = "avatar" | "wechatQr";
export type StoreAssetType = "defaultCardWechatQr";

export function customerAssetType(value: FormDataEntryValue | null): CustomerAssetType | null {
  return value === "avatar" ? value : null;
}

export function staffAssetType(value: FormDataEntryValue | null): StaffAssetType | null {
  return value === "avatar" || value === "wechatQr" ? value : null;
}

export function customerAssetPath(storeId: string, customerId: string, type: CustomerAssetType | StaffAssetType | StoreAssetType, mimeType: string) {
  const extension = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  return `${storeId}/${customerId}/${type}-${randomUUID()}.${extension}`;
}

export function customerAssetStorage() {
  return productStorage();
}

export function storagePathFromPublicUrl(url: string | null) {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${CUSTOMER_ASSETS_BUCKET}/`;
  const index = url.indexOf(marker);
  return index < 0 ? null : decodeURIComponent(url.slice(index + marker.length));
}
