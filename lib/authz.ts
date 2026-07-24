import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";

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
