import { CustomerStatus, Prisma, Role } from "@prisma/client";
import { compare, hash } from "bcryptjs";
import { db } from "@/lib/db";
import { customerRegistrationSchema } from "@/lib/validation";
import { canAccessPublicStore } from "@/lib/deployment-scope";
import { customerRegistrationBlock } from "@/lib/customer-registration";

export async function POST(request: Request) {
  const parsed = customerRegistrationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "注册内容不正确" }, { status: 400 });
  const input = parsed.data;
  if (!canAccessPublicStore(input.storeSlug)) return Response.json({ error: "Preview 仅允许测试店铺写入" }, { status: 403 });
  const store = await db.store.findFirst({ where: { slug: input.storeSlug, isActive: true, customerEnabled: true } });
  if (!store) return Response.json({ error: "店铺暂不开放客户注册" }, { status: 404 });
  const sourceEmployee = input.ref ? await db.user.findFirst({ where: { storeId: store.id, role: Role.EMPLOYEE, shareCode: input.ref, isActive: true } }) : null;
  const existing = await db.user.findUnique({ where: { username: input.phone } });
  if (existing && existing.role !== Role.CUSTOMER) return Response.json({ error: "该手机号无法注册客户账号" }, { status: 409 });
  if (existing && !existing.isActive && existing.customerStatus !== CustomerStatus.PENDING) return Response.json({ error: "该客户账号已停用，请联系店铺处理" }, { status: 409 });
  if (existing && customerRegistrationBlock(existing.customerStatus)) {
    return Response.json({ error: "该客户账号当前不可通过注册恢复，请联系店铺处理" }, { status: 409 });
  }
  if (existing && !(await compare(input.password, existing.passwordHash))) {
    return Response.json({ error: "该手机号已注册，当前密码不正确" }, { status: 409 });
  }
  const passwordHash = existing ? null : await hash(input.password, 12);
  const result = await db.$transaction(async (tx) => {
    const customer = existing ? await tx.user.update({
      where: { id: existing.id },
      data: existing.customerStatus === CustomerStatus.PENDING ? { customerStatus: CustomerStatus.ACTIVE, isActive: true } : {},
    }) : await tx.user.create({ data: { username: input.phone, phone: input.phone, name: input.name, passwordHash: passwordHash!, role: Role.CUSTOMER, customerStatus: CustomerStatus.ACTIVE, isActive: true } });
    const prior = await tx.customerProfile.findUnique({ where: { storeId_customerId: { storeId: store.id, customerId: customer.id } } });
    if (prior?.status === CustomerStatus.REJECTED || prior?.status === CustomerStatus.RESET_PENDING) throw new Error("PROFILE_BLOCKED");
    if (prior) {
      await tx.customerProfile.update({ where: { id: prior.id }, data: prior.status === CustomerStatus.PENDING ? { status: CustomerStatus.ACTIVE, approvedAt: new Date() } : {} });
    } else {
      await tx.customerProfile.create({ data: { storeId: store.id, customerId: customer.id, name: input.name, phone: input.phone, sourceEmployeeId: sourceEmployee?.id, status: CustomerStatus.ACTIVE, approvedAt: new Date() } });
    }
    return customer;
  }).catch((error: unknown) => {
    if (error instanceof Error && error.message === "PROFILE_BLOCKED") return "PROFILE_BLOCKED" as const;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return "PHONE_CONFLICT" as const;
    throw error;
  });
  if (result === "PROFILE_BLOCKED") return Response.json({ error: "该店铺档案已被拒绝或正在处理密码重置" }, { status: 409 });
  if (result === "PHONE_CONFLICT") return Response.json({ error: "该手机号已被本店其他客户档案使用" }, { status: 409 });
  return Response.json({ status: "ACTIVE", message: "注册成功" });
}
