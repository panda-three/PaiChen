import { auth } from "@/customer-auth";
import { db } from "@/lib/db";
import { getActiveCustomer } from "@/lib/customer-authz";

export async function GET() {
  const [customer, authSession] = await Promise.all([getActiveCustomer(), auth()]);
  if (!customer || !authSession?.user.customerSessionId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const now = new Date();
  const sessions = await db.customerSession.findMany({ where: { customerId: customer.id, revokedAt: null, expiresAt: { gt: now } }, orderBy: { lastActiveAt: "desc" } });
  return Response.json({ sessions: sessions.map((item) => ({ ...item, current: item.id === authSession.user.customerSessionId })) });
}
