import { Role } from "@prisma/client";
import { getActiveAppUser } from "@/lib/app-authz";

export async function getActiveStaff() {
  const user = await getActiveAppUser();
  if (!user || (user.role !== Role.EMPLOYEE && user.role !== Role.STORE_ADMIN) || !user.store) return null;
  return { ...user, store: user.store };
}
