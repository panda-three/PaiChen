import { Role } from "@prisma/client";

export type OrderAccess = "anonymous" | "customer" | "employee" | "storeAdmin" | "forbidden";

export function resolveOrderAccess(user: { role: Role; storeId: string | null } | null, storeId: string, customerActive: boolean, authenticated = Boolean(user)): OrderAccess {
  if (!user) return authenticated ? "forbidden" : "anonymous";
  if (user.role === Role.CUSTOMER) return customerActive ? "customer" : "forbidden";
  if (user.storeId !== storeId) return "forbidden";
  if (user.role === Role.EMPLOYEE) return "employee";
  if (user.role === Role.STORE_ADMIN) return "storeAdmin";
  return "forbidden";
}
