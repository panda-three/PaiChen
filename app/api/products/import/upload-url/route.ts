import { randomUUID } from "node:crypto";
import { Role } from "@prisma/client";
import { getActiveActor } from "@/lib/authz";
import { PRODUCT_IMPORTS_BUCKET, productStorage } from "@/lib/product-storage";

export async function POST() {
  const actor = await getActiveActor();
  if (!actor || actor.role !== Role.STORE_ADMIN || !actor.storeId) return Response.json({ error: "无权导入商品" }, { status: 401 });
  const path = `${actor.storeId}/${randomUUID()}.xlsx`;
  try {
    const { data, error } = await productStorage().from(PRODUCT_IMPORTS_BUCKET).createSignedUploadUrl(path);
    if (error || !data) throw error ?? new Error("无法创建上传地址");
    return Response.json({ path, token: data.token, uploadUrl: data.signedUrl });
  } catch {
    return Response.json({ error: "商品导入存储尚未配置或暂不可用" }, { status: 503 });
  }
}
