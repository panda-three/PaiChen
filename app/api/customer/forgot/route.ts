import { CustomerStatus, Role } from "@prisma/client";
import { hash } from "bcryptjs";
import { randomUUID } from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";

const schema = z.object({ storeSlug: z.string(), phone: z.string().regex(/^1\d{10}$/), newPassword: z.string().min(8).max(72) });
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "信息格式不正确" }, { status: 400 });
  const [store, customer] = await Promise.all([db.store.findUnique({ where: { slug: parsed.data.storeSlug } }), db.user.findFirst({ where: { username: parsed.data.phone, role: Role.CUSTOMER } })]);
  if (!store || !customer) return Response.json({ error: "未找到客户账号" }, { status: 404 });
  const profile = await db.customerProfile.findUnique({ where: { storeId_customerId: { storeId: store.id, customerId: customer.id } } });
  if (!profile) return Response.json({ error: "请向已加入的店铺申请重置" }, { status: 403 });
  const resetCode = randomUUID().slice(0, 8).toUpperCase();
  await db.$transaction([db.user.update({ where: { id: customer.id }, data: { pendingPasswordHash: await hash(parsed.data.newPassword, 12), resetCode } }), db.customerProfile.update({ where: { id: profile.id }, data: { status: CustomerStatus.RESET_PENDING } })]);
  return Response.json({ resetCode, message: "请将申请码提供给店铺，审核后新密码生效" });
}
