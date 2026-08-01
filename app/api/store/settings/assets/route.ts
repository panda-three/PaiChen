import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getActiveActor } from "@/lib/authz";
import { CUSTOMER_ASSET_MAX_SIZE, CUSTOMER_ASSET_MIME_TYPES, CUSTOMER_ASSETS_BUCKET, customerAssetPath, customerAssetStorage, storagePathFromPublicUrl } from "@/lib/customer-assets";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

async function manager() { const actor = await getActiveActor(); return actor?.role === Role.STORE_ADMIN && actor.storeId && actor.store ? actor : null; }
function card(json: string) { try { return JSON.parse(json) as Record<string, unknown>; } catch { return {}; } }

export async function POST(request: Request) {
  const actor = await manager(); if (!actor) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const storeId = actor.storeId!; const store = actor.store!;
  const form = await request.formData().catch(() => null); const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "上传内容不正确" }, { status: 400 });
  if (!(CUSTOMER_ASSET_MIME_TYPES as readonly string[]).includes(file.type)) return Response.json({ error: "仅支持 JPG、PNG、WebP 图片" }, { status: 400 });
  if (file.size <= 0 || file.size > CUSTOMER_ASSET_MAX_SIZE) return Response.json({ error: "图片必须小于或等于 5 MB" }, { status: 400 });
  const storage = customerAssetStorage(); const path = customerAssetPath(storeId, "default-card", "defaultCardWechatQr", file.type);
  const upload = await storage.from(CUSTOMER_ASSETS_BUCKET).upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
  if (upload.error) return Response.json({ error: "图片上传失败，请稍后重试" }, { status: 502 });
  const url = storage.from(CUSTOMER_ASSETS_BUCKET).getPublicUrl(path).data.publicUrl; const before = card(store.defaultCardJson); const previousUrl = typeof before.wechatQrUrl === "string" ? before.wechatQrUrl : null;
  try { await db.store.update({ where: { id: storeId }, data: { defaultCardJson: JSON.stringify({ ...before, wechatQrUrl: url }) } }); } catch (error) { await storage.from(CUSTOMER_ASSETS_BUCKET).remove([path]); throw error; }
  const previousPath = storagePathFromPublicUrl(previousUrl); if (previousPath) await storage.from(CUSTOMER_ASSETS_BUCKET).remove([previousPath]);
  await writeAudit({ actorId: actor.id, storeId, action: "修改店铺默认名片二维码", entityType: "Store", entityId: storeId, before: { wechatQrUrl: previousUrl }, after: { wechatQrUrl: url } });
  revalidatePath("/admin/store"); revalidatePath(`/s/${store.slug}`); return Response.json({ url });
}

export async function DELETE() {
  const actor = await manager(); if (!actor) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const storeId = actor.storeId!; const store = actor.store!;
  const before = card(store.defaultCardJson); const previousUrl = typeof before.wechatQrUrl === "string" ? before.wechatQrUrl : null;
  await db.store.update({ where: { id: storeId }, data: { defaultCardJson: JSON.stringify({ ...before, wechatQrUrl: null }) } });
  const previousPath = storagePathFromPublicUrl(previousUrl); if (previousPath) await customerAssetStorage().from(CUSTOMER_ASSETS_BUCKET).remove([previousPath]);
  await writeAudit({ actorId: actor.id, storeId, action: "删除店铺默认名片二维码", entityType: "Store", entityId: storeId, before: { wechatQrUrl: previousUrl }, after: { wechatQrUrl: null } });
  revalidatePath("/admin/store"); revalidatePath(`/s/${store.slug}`); return Response.json({ ok: true });
}
