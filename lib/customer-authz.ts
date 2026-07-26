import { CustomerStatus, Role } from "@prisma/client";
import { auth } from "@/customer-auth";
import { db } from "@/lib/db";

export async function getActiveCustomer() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== Role.CUSTOMER) return null;
  const customer = await db.user.findUnique({ where: { id: session.user.id } });
  if (!customer?.isActive || customer.role !== Role.CUSTOMER || customer.customerStatus !== CustomerStatus.ACTIVE) return null;
  return customer;
}
