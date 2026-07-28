import { CustomerStatus, Role } from "@prisma/client";
import { auth } from "@/customer-auth";
import { getActiveAppUser } from "@/lib/app-authz";

export async function getActiveCustomer() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== Role.CUSTOMER) return null;
  const customer = await getActiveAppUser();
  if (!customer?.isActive || customer.role !== Role.CUSTOMER || customer.customerStatus !== CustomerStatus.ACTIVE) return null;
  return customer;
}
