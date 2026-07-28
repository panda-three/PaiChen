import { Prisma } from "@prisma/client";
import { compare } from "bcryptjs";
import { db } from "@/lib/db";
import { getCustomerProfileForStore } from "@/lib/customer-settings";
import { customerProfileSettingsSchema } from "@/lib/validation";

export async function PATCH(request: Request) {
  const parsed = customerProfileSettingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "资料内容不正确" }, { status: 400 });
  const context = await getCustomerProfileForStore(parsed.data.storeSlug);
  if (!context) return Response.json({ error: "无权修改该店铺资料" }, { status: 403 });
  const phoneChanged = parsed.data.phone !== context.profile.phone;
  if (phoneChanged && (!parsed.data.currentPassword || !(await compare(parsed.data.currentPassword, context.customer.passwordHash)))) {
    return Response.json({ error: "修改本店联系电话需要验证当前密码" }, { status: 400 });
  }
  try {
    const profile = await db.customerProfile.update({ where: { id: context.profile.id }, data: {
      name: parsed.data.name,
      phone: parsed.data.phone,
    } });
    return Response.json({ profile });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return Response.json({ error: "该联系电话已被本店其他客户使用" }, { status: 409 });
    throw error;
  }
}
