import { CustomerStatus, Role } from "@prisma/client";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { customerRegistrationSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const parsed = customerRegistrationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "注册内容不正确" }, { status: 400 });
  const input = parsed.data;
  const store = await db.store.findFirst({ where: { slug: input.storeSlug, isActive: true, customerEnabled: true }, include: { users: { where: { role: Role.EMPLOYEE, shareCode: input.ref ?? undefined, isActive: true }, take: 1 } } });
  if (!store) return Response.json({ error: "店铺暂不开放客户注册" }, { status: 404 });
  const existing = await db.user.findUnique({ where: { username: input.phone } });
  if (existing && existing.role !== Role.CUSTOMER) return Response.json({ error: "该手机号无法注册客户账号" }, { status: 409 });
  const customer = existing ?? await db.user.create({ data: { username: input.phone, phone: input.phone, name: input.name, passwordHash: await hash(input.password, 12), role: Role.CUSTOMER, customerStatus: CustomerStatus.PENDING, isActive: false } });
  const prior = await db.customerProfile.findUnique({ where: { storeId_customerId: { storeId: store.id, customerId: customer.id } } });
  if (prior) return Response.json({ status: prior.status, message: "该店铺申请已存在" });
  await db.customerProfile.create({ data: { storeId: store.id, customerId: customer.id, name: input.name, phone: input.phone, sourceEmployeeId: store.users[0]?.id, status: CustomerStatus.PENDING } });
  return Response.json({ status: "PENDING", message: "申请已提交，请等待员工线下核实手机号并审核" });
}
