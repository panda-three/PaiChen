import { Role } from "@prisma/client";
import { cookies } from "next/headers";
import { getActiveActor } from "@/lib/authz";
import { db } from "@/lib/db";
import { canUploadPageAsset, PAGE_ASSET_MAX_SIZE, PAGE_ASSET_MIME_TYPES, PAGE_ASSETS_BUCKET, pageAssetPath, pageAssetStorage } from "@/lib/page-assets";

export async function POST(request: Request) {
  const actor = await getActiveActor();
  if (!actor || (actor.role !== Role.STORE_ADMIN && actor.role !== Role.PLATFORM_ADMIN)) return Response.json({ error: "无权上传页面图片" }, { status: 401 });
  const form = await request.formData().catch(() => null);
  const pageId = form?.get("pageId");
  const file = form?.get("file");
  if (typeof pageId !== "string" || !(file instanceof File)) return Response.json({ error: "请选择页面和图片" }, { status: 400 });
  if (!PAGE_ASSET_MIME_TYPES.includes(file.type as (typeof PAGE_ASSET_MIME_TYPES)[number])) return Response.json({ error: "仅支持 JPG、PNG、WebP 图片" }, { status: 415 });
  if (file.size > PAGE_ASSET_MAX_SIZE) return Response.json({ error: "单张图片不能超过 5 MB" }, { status: 413 });
  const page = await db.storePage.findUnique({ where: { id: pageId }, select: { storeId: true } });
  const supportStoreId = actor.role === Role.PLATFORM_ADMIN ? (await cookies()).get("supportStoreId")?.value : null;
  if (!page || !canUploadPageAsset(actor, page.storeId, supportStoreId)) return Response.json({ error: "页面不存在或无权上传" }, { status: 403 });
  const path = pageAssetPath(page.storeId, pageId, file.type);
  try {
    const storage = pageAssetStorage();
    const { error } = await storage.from(PAGE_ASSETS_BUCKET).upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
    if (error) throw error;
    return Response.json({ url: storage.from(PAGE_ASSETS_BUCKET).getPublicUrl(path).data.publicUrl });
  } catch {
    return Response.json({ error: "页面图片存储尚未配置或暂不可用" }, { status: 503 });
  }
}
