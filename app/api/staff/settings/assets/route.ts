import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { CUSTOMER_ASSET_MAX_SIZE, CUSTOMER_ASSET_MIME_TYPES, CUSTOMER_ASSETS_BUCKET, customerAssetPath, customerAssetStorage, storagePathFromPublicUrl } from "@/lib/customer-assets";
import { getActiveStaff } from "@/lib/staff-settings";

export async function POST(request: Request) {
  const actor = await getActiveStaff();
  if (!actor) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const form = await request.formData().catch(() => null); const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "上传内容不正确" }, { status: 400 });
  if (!(CUSTOMER_ASSET_MIME_TYPES as readonly string[]).includes(file.type)) return Response.json({ error: "仅支持 JPG、PNG、WebP 图片" }, { status: 400 });
  if (file.size <= 0 || file.size > CUSTOMER_ASSET_MAX_SIZE) return Response.json({ error: "图片必须小于或等于 5 MB" }, { status: 400 });
  const storage = customerAssetStorage(); const path = customerAssetPath(actor.storeId!, actor.id, "avatar", file.type);
  const upload = await storage.from(CUSTOMER_ASSETS_BUCKET).upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
  if (upload.error) return Response.json({ error: "图片上传失败，请稍后重试" }, { status: 502 });
  const url = storage.from(CUSTOMER_ASSETS_BUCKET).getPublicUrl(path).data.publicUrl; const previousUrl = actor.avatarUrl;
  try { await db.user.update({ where: { id: actor.id }, data: { avatarUrl: url } }); } catch (error) { await storage.from(CUSTOMER_ASSETS_BUCKET).remove([path]); throw error; }
  const previousPath = storagePathFromPublicUrl(previousUrl); if (previousPath) await storage.from(CUSTOMER_ASSETS_BUCKET).remove([previousPath]);
  await writeAudit({ actorId: actor.id, storeId: actor.storeId, action: "APP 修改名片头像", entityType: "User", entityId: actor.id, before: { avatarUrl: previousUrl }, after: { avatarUrl: url } });
  revalidatePath(`/s/${actor.store.slug}`); return Response.json({ url });
}

export async function DELETE() {
  const actor = await getActiveStaff();
  if (!actor) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const previousPath = storagePathFromPublicUrl(actor.avatarUrl);
  await db.user.update({ where: { id: actor.id }, data: { avatarUrl: null } });
  if (previousPath) await customerAssetStorage().from(CUSTOMER_ASSETS_BUCKET).remove([previousPath]);
  await writeAudit({ actorId: actor.id, storeId: actor.storeId, action: "APP 删除名片头像", entityType: "User", entityId: actor.id, before: { avatarUrl: actor.avatarUrl }, after: { avatarUrl: null } });
  revalidatePath(`/s/${actor.store.slug}`); return Response.json({ ok: true });
}
