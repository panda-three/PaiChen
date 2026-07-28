import { createHash, randomBytes, randomUUID } from "crypto";
import { Prisma, Role } from "@prisma/client";
import { hash } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";

export const STAFF_INVITATION_TTL_MS = 72 * 60 * 60 * 1000;
export const staffRoleLabel = (role: Role) => role === Role.EMPLOYEE ? "员工" : role === Role.STORE_ADMIN ? "店铺管理员" : "不支持的角色";
export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
export const maskPhone = (phone: string) => phone.replace(/^(\d{3})\d{4}(\d{4})$/, "$1****$2");

export const invitationCreateSchema = z.object({
  storeId: z.string().min(1),
  inviteePhone: z.string().trim().regex(/^1\d{10}$/, "请输入正确的邀请手机号"),
});

export const staffRegistrationSchema = z.object({
  invite: z.string().min(32),
  name: z.string().trim().min(1, "姓名不能为空").max(50),
  username: z.string().trim().min(3, "登录账号至少 3 个字符").max(50),
  phone: z.string().trim().regex(/^1\d{10}$/, "请输入正确的手机号"),
  password: z.string().min(8, "密码至少 8 个字符").max(72),
}).strict();

export function invitationUnavailable(invitation: { expiresAt: Date; usedAt: Date | null; revokedAt: Date | null }, now = new Date()) {
  if (invitation.revokedAt) return "邀请已撤销";
  if (invitation.usedAt) return "邀请已使用";
  if (invitation.expiresAt <= now) return "邀请已过期";
  return null;
}

export function invitedRoleForActor(role: Role) {
  if (role === Role.STORE_ADMIN) return Role.EMPLOYEE;
  if (role === Role.PLATFORM_ADMIN) return Role.STORE_ADMIN;
  return null;
}

export async function previewStaffInvitation(token: string) {
  if (!token) return null;
  const invitation = await db.staffInvitation.findUnique({ where: { tokenHash: tokenHash(token) }, include: { store: true } });
  if (!invitation) return null;
  return { id: invitation.id, storeName: invitation.store.name, role: invitation.role, phone: maskPhone(invitation.inviteePhone), unavailable: invitationUnavailable(invitation) };
}

export async function createStaffInvitation(input: { actor: { id: string; role: Role; storeId: string | null }; storeId: string; inviteePhone: string }) {
  const role = invitedRoleForActor(input.actor.role);
  if (!role || (input.actor.role === Role.STORE_ADMIN && input.actor.storeId !== input.storeId)) throw new Error("无权签发该邀请");
  const store = await db.store.findFirst({ where: { id: input.storeId, isActive: true }, select: { id: true, employeeLimit: true, adminLimit: true } });
  if (!store) throw new Error("店铺不存在或已停用");
  const count = await db.user.count({ where: { storeId: store.id, role } });
  const limit = role === Role.EMPLOYEE ? store.employeeLimit : store.adminLimit;
  if (count >= limit) throw new Error(`${staffRoleLabel(role)}账号已达到上限（${limit}）`);
  const token = randomBytes(32).toString("base64url");
  const invitation = await db.staffInvitation.create({ data: { storeId: store.id, role, inviteePhone: input.inviteePhone, tokenHash: tokenHash(token), createdById: input.actor.id, expiresAt: new Date(Date.now() + STAFF_INVITATION_TTL_MS) } });
  return { invitation, token };
}

export async function redeemStaffInvitation(raw: unknown) {
  const parsed = staffRegistrationSchema.safeParse(raw);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "注册内容不正确");
  const value = parsed.data;
  const passwordHash = await hash(value.password, 12);
  return db.$transaction(async (tx) => {
    const invitation = await tx.staffInvitation.findUnique({ where: { tokenHash: tokenHash(value.invite) }, include: { store: true } });
    if (!invitation) throw new Error("邀请不存在");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${invitation.storeId}:${invitation.role}`}))`;
    const locked = await tx.staffInvitation.findUnique({ where: { id: invitation.id }, include: { store: true } });
    if (!locked) throw new Error("邀请不存在");
    const unavailable = invitationUnavailable(locked);
    if (unavailable) throw new Error(unavailable);
    if (!locked.store.isActive) throw new Error("店铺已停用");
    if (locked.inviteePhone !== value.phone) throw new Error("手机号与邀请不一致");
    if (locked.role !== Role.EMPLOYEE && locked.role !== Role.STORE_ADMIN) throw new Error("邀请角色无效");
    const limit = locked.role === Role.EMPLOYEE ? locked.store.employeeLimit : locked.store.adminLimit;
    const count = await tx.user.count({ where: { storeId: locked.storeId, role: locked.role } });
    if (count >= limit) throw new Error(`${staffRoleLabel(locked.role)}账号已达到上限（${limit}）`);
    const user = await tx.user.create({ data: { id: randomUUID(), username: value.username, passwordHash, role: locked.role, name: value.name, phone: value.phone, storeId: locked.storeId, shareCode: randomUUID() } }).catch((error) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new Error("登录账号已存在");
      throw error;
    });
    const consumed = await tx.staffInvitation.updateMany({ where: { id: locked.id, usedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
    if (consumed.count !== 1) throw new Error("邀请已失效");
    await tx.auditLog.create({ data: { actorId: locked.createdById, storeId: locked.storeId, action: "兑换员工邀请", entityType: "StaffInvitation", entityId: locked.id, afterJson: JSON.stringify({ userId: user.id, role: user.role }) } });
    return user;
  });
}
