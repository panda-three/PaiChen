import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { cookies } from "next/headers";

export async function getActiveActor() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const actor = await db.user.findUnique({ where: { id: session.user.id }, include: { store: true } });
  if (!actor?.isActive || (actor.store && !actor.store.isActive)) return null;
  return actor;
}

export async function requireActor(roles?: Role[]) {
  const actor = await getActiveActor();
  if (!actor) redirect("/login");
  if (roles && !roles.includes(actor.role)) redirect("/admin");
  return actor;
}

export function assertStore(actor: { role: Role; storeId: string | null }, storeId: string) {
  if (actor.role === Role.PLATFORM_ADMIN || actor.storeId !== storeId) throw new Error("无权访问该店铺数据");
}

export async function getCatalogStore(actor: { id: string; role: Role; storeId: string | null }) {
  if (actor.role === Role.STORE_ADMIN) return actor.storeId;
  if (actor.role !== Role.PLATFORM_ADMIN) return null;
  const storeId = (await cookies()).get("supportStoreId")?.value;
  if (!storeId) return null;
  return (await db.store.findFirst({ where: { id: storeId, isActive: true }, select: { id: true } }))?.id ?? null;
}

export function assertBusinessRole(actor: { role: Role }) {
  if (actor.role !== Role.STORE_ADMIN && actor.role !== Role.EMPLOYEE) throw new Error("平台代运营和企业账号无权访问客户、订单或导出数据");
}
