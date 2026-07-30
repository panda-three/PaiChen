import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { CUSTOMER_ASSET_MAX_SIZE, CUSTOMER_ASSET_MIME_TYPES, CUSTOMER_ASSETS_BUCKET, customerAssetPath, customerAssetStorage, staffAssetType, storagePathFromPublicUrl } from "@/lib/customer-assets";
import { getActiveStaff } from "@/lib/staff-settings";

export async function POST(request: Request) {
  const actor = await getActiveStaff();
  if (!actor) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const form = await request.formData().catch(() => null); const file = form?.get("file");
  const type = staffAssetType(form?.get("type") ?? "avatar");
  if (!(file instanceof File) || !type) return Response.json({ error: "上传内容不正确" }, { status: 400 });
  if (!(CUSTOMER_ASSET_MIME_TYPES as readonly string[]).includes(file.type)) return Response.json({ error: "仅支持 JPG、PNG、WebP 图片" }, { status: 400 });
  if (file.size <= 0 || file.size > CUSTOMER_ASSET_MAX_SIZE) return Response.json({ error: "图片必须小于或等于 5 MB" }, { status: 400 });
  const storage = customerAssetStorage(); const path = customerAssetPath(actor.storeId!, actor.id, type, file.type);
  const upload = await storage.from(CUSTOMER_ASSETS_BUCKET).upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
  if (upload.error) return Response.json({ error: "图片上传失败，请稍后重试" }, { status: 502 });
  const field = type === "avatar" ? "avatarUrl" : "wechatQrUrl"; const label = type === "avatar" ? "名片头像" : "微信二维码";
  const url = storage.from(CUSTOMER_ASSETS_BUCKET).getPublicUrl(path).data.publicUrl; const previousUrl = actor[field];
  try { await db.user.update({ where: { id: actor.id }, data: { [field]: url } }); } catch (error) { await storage.from(CUSTOMER_ASSETS_BUCKET).remove([path]); throw error; }
  const previousPath = storagePathFromPublicUrl(previousUrl); if (previousPath) await storage.from(CUSTOMER_ASSETS_BUCKET).remove([previousPath]);
  await writeAudit({ actorId: actor.id, storeId: actor.storeId, action: `APP 修改${label}`, entityType: "User", entityId: actor.id, before: { [field]: previousUrl }, after: { [field]: url } });
  revalidatePath(`/s/${actor.store.slug}`); return Response.json({ url });
}

export async function DELETE(request: Request) {
  const actor = await getActiveStaff();
  if (!actor) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { type?: unknown } | null;
  const type = staffAssetType(body?.type == null ? "avatar" : typeof body.type === "string" ? body.type : null);
  if (!type) return Response.json({ error: "删除内容不正确" }, { status: 400 });
  const field = type === "avatar" ? "avatarUrl" : "wechatQrUrl"; const label = type === "avatar" ? "名片头像" : "微信二维码";
  const previousUrl = actor[field]; const previousPath = storagePathFromPublicUrl(previousUrl);
  await db.user.update({ where: { id: actor.id }, data: { [field]: null } });
  if (previousPath) await customerAssetStorage().from(CUSTOMER_ASSETS_BUCKET).remove([previousPath]);
  await writeAudit({ actorId: actor.id, storeId: actor.storeId, action: `APP 删除${label}`, entityType: "User", entityId: actor.id, before: { [field]: previousUrl }, after: { [field]: null } });
  revalidatePath(`/s/${actor.store.slug}`); return Response.json({ ok: true });
}
