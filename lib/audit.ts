import { db } from "@/lib/db";

export async function writeAudit(input: { actorId: string; storeId?: string | null; action: string; entityType: string; entityId: string; before?: unknown; after?: unknown }) {
  await db.auditLog.create({ data: {
    actorId: input.actorId,
    storeId: input.storeId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    beforeJson: input.before == null ? null : JSON.stringify(input.before),
    afterJson: input.after == null ? null : JSON.stringify(input.after),
  } });
}
