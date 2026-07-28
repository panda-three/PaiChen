import { CustomerStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getActiveCustomer } from "@/lib/customer-authz";
import { canAccessPublicStore } from "@/lib/deployment-scope";

export async function getCustomerProfileForStore(storeSlug: string) {
  const customer = await getActiveCustomer();
  if (!customer) return null;
  if (!canAccessPublicStore(storeSlug)) return null;
  const profile = await db.customerProfile.findFirst({
    where: { customerId: customer.id, status: CustomerStatus.ACTIVE, store: { slug: storeSlug, isActive: true } },
    include: { store: true },
  });
  return profile ? { customer, profile } : null;
}

export function normalizedOptional(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
