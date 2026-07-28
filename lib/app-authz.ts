import { CustomerStatus, Role } from "@prisma/client";
import { auth } from "@/customer-auth";
import { db } from "@/lib/db";

export async function getActiveAppUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await db.user.findUnique({ where: { id: session.user.id }, include: { store: true } });
  if (!user?.isActive) return null;
  if (user.role === Role.CUSTOMER) return user.customerStatus === CustomerStatus.ACTIVE ? user : null;
  if ((user.role === Role.EMPLOYEE || user.role === Role.STORE_ADMIN) && user.store?.isActive) return user;
  return null;
}
