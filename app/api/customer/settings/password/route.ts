import { compare, hash } from "bcryptjs";
import { db } from "@/lib/db";
import { getActiveCustomer } from "@/lib/customer-authz";
import { customerPasswordSettingsSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const customer = await getActiveCustomer();
  if (!customer) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = customerPasswordSettingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "密码内容不正确" }, { status: 400 });
  if (!(await compare(parsed.data.currentPassword, customer.passwordHash))) return Response.json({ error: "当前密码不正确" }, { status: 400 });
  await db.user.update({ where: { id: customer.id }, data: { passwordHash: await hash(parsed.data.newPassword, 12), pendingPasswordHash: null, resetCode: null } });
  return Response.json({ ok: true });
}
