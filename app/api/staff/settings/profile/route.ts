import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getActiveStaff } from "@/lib/staff-settings";
import { staffProfileSettingsSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

export async function PATCH(request: Request) {
  const actor = await getActiveStaff();
  if (!actor) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = staffProfileSettingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "资料内容不正确" }, { status: 400 });
  const before = { name: actor.name, phone: actor.phone, wechat: actor.wechat, title: actor.title, bio: actor.bio };
  const profile = await db.user.update({ where: { id: actor.id }, data: parsed.data, select: { name: true, phone: true, wechat: true, title: true, bio: true, avatarUrl: true } });
  await writeAudit({ actorId: actor.id, storeId: actor.storeId, action: "APP 修改个人名片", entityType: "User", entityId: actor.id, before, after: profile });
  revalidatePath(`/s/${actor.store.slug}`);
  return Response.json({ profile });
}
