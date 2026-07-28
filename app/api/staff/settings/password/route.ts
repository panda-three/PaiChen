import { compare, hash } from "bcryptjs";
import { db } from "@/lib/db";
import { getActiveStaff } from "@/lib/staff-settings";
import { customerPasswordSettingsSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

export async function POST(request: Request) {
  const actor = await getActiveStaff();
  if (!actor) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = customerPasswordSettingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "密码内容不正确" }, { status: 400 });
  if (!(await compare(parsed.data.currentPassword, actor.passwordHash))) return Response.json({ error: "当前密码不正确" }, { status: 400 });
  await db.user.update({ where: { id: actor.id }, data: { passwordHash: await hash(parsed.data.newPassword, 12) } });
  await writeAudit({ actorId: actor.id, storeId: actor.storeId, action: "APP 修改密码", entityType: "User", entityId: actor.id });
  return Response.json({ ok: true });
}
