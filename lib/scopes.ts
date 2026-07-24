import { Role } from "@prisma/client";

type Actor = { id: string; role: Role; storeId: string | null; enterpriseId?: string | null };

export function orderScope(actor: Actor) {
  if (!actor.storeId || (actor.role !== Role.STORE_ADMIN && actor.role !== Role.EMPLOYEE)) throw new Error("无权访问订单");
  return {
    storeId: actor.storeId,
    ...(actor.role === Role.EMPLOYEE ? { OR: [{ sourceEmployeeId: actor.id }, { responsibleEmployeeId: actor.id }] } : {}),
  };
}

export function customerScope(actor: Actor) {
  if (!actor.storeId || (actor.role !== Role.STORE_ADMIN && actor.role !== Role.EMPLOYEE)) throw new Error("无权访问客户");
  return {
    storeId: actor.storeId,
    ...(actor.role === Role.EMPLOYEE ? { OR: [{ latestEmployeeId: actor.id }, { orders: { some: { responsibleEmployeeId: actor.id } } }] } : {}),
  };
}

export function canOperateStore(actor: Actor, storeId: string, module: "catalog" | "business") {
  if (actor.role === Role.PLATFORM_ADMIN) return module === "catalog";
  return actor.role === Role.STORE_ADMIN && actor.storeId === storeId;
}
