import { db } from "@/lib/db";
import { getCustomerProfileForStore } from "@/lib/customer-settings";
import { CUSTOMER_ASSET_MAX_SIZE, CUSTOMER_ASSET_MIME_TYPES, CUSTOMER_ASSETS_BUCKET, customerAssetPath, customerAssetStorage, customerAssetType, storagePathFromPublicUrl } from "@/lib/customer-assets";

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const storeSlug = form?.get("storeSlug");
  const file = form?.get("file");
  const type = customerAssetType(form?.get("type") ?? null);
  if (typeof storeSlug !== "string" || !(file instanceof File) || !type) return Response.json({ error: "上传内容不正确" }, { status: 400 });
  if (!(CUSTOMER_ASSET_MIME_TYPES as readonly string[]).includes(file.type)) return Response.json({ error: "仅支持 JPG、PNG、WebP 图片" }, { status: 400 });
  if (file.size <= 0 || file.size > CUSTOMER_ASSET_MAX_SIZE) return Response.json({ error: "图片必须小于或等于 5 MB" }, { status: 400 });
  const context = await getCustomerProfileForStore(storeSlug);
  if (!context) return Response.json({ error: "无权修改该店铺资料" }, { status: 403 });
  const storage = customerAssetStorage();
  const path = customerAssetPath(context.profile.storeId, context.customer.id, type, file.type);
  const upload = await storage.from(CUSTOMER_ASSETS_BUCKET).upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
  if (upload.error) return Response.json({ error: "图片上传失败，请稍后重试" }, { status: 502 });
  const publicUrl = storage.from(CUSTOMER_ASSETS_BUCKET).getPublicUrl(path).data.publicUrl;
  const field = type === "avatar" ? "avatarUrl" : "serviceQrUrl";
  const previousUrl = context.profile[field];
  try {
    await db.customerProfile.update({ where: { id: context.profile.id }, data: { [field]: publicUrl } });
  } catch (error) {
    await storage.from(CUSTOMER_ASSETS_BUCKET).remove([path]);
    throw error;
  }
  const previousPath = storagePathFromPublicUrl(previousUrl);
  if (previousPath) await storage.from(CUSTOMER_ASSETS_BUCKET).remove([previousPath]);
  return Response.json({ url: publicUrl });
}

export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null) as { storeSlug?: unknown; type?: unknown } | null;
  const type = customerAssetType(typeof body?.type === "string" ? body.type : null);
  if (typeof body?.storeSlug !== "string" || !type) return Response.json({ error: "删除内容不正确" }, { status: 400 });
  const context = await getCustomerProfileForStore(body.storeSlug);
  if (!context) return Response.json({ error: "无权修改该店铺资料" }, { status: 403 });
  const field = type === "avatar" ? "avatarUrl" : "serviceQrUrl";
  const previousPath = storagePathFromPublicUrl(context.profile[field]);
  await db.customerProfile.update({ where: { id: context.profile.id }, data: { [field]: null } });
  if (previousPath) await customerAssetStorage().from(CUSTOMER_ASSETS_BUCKET).remove([previousPath]);
  return Response.json({ ok: true });
}
