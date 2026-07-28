import { auth } from "@/customer-auth";
import { db } from "@/lib/db";
import { getActiveCustomer } from "@/lib/customer-authz";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [customer, authSession, { id }] = await Promise.all([getActiveCustomer(), auth(), params]);
  if (!customer || !authSession?.user.customerSessionId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const result = await db.customerSession.updateMany({ where: { id, customerId: customer.id, revokedAt: null }, data: { revokedAt: new Date() } });
  if (!result.count) return Response.json({ error: "设备会话不存在" }, { status: 404 });
  return Response.json({ ok: true, current: id === authSession.user.customerSessionId });
}
