import { createClient } from "@supabase/supabase-js";

export const PRODUCT_IMPORTS_BUCKET = "product-imports";
export const PRODUCT_IMAGES_BUCKET = "product-images";

export function productStorage() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("商品导入存储尚未配置");
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }).storage;
}

export function isStoreImportPath(path: string, storeId: string) {
  const parts = path.split("/");
  return parts.length === 2
    && parts[0] === storeId
    && /^[a-f0-9-]{36}\.xlsx$/i.test(parts[1]);
}
