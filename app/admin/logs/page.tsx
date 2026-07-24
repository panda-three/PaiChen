import { Role } from "@prisma/client";
import { requireActor } from "@/lib/authz";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/page-header";

export default async function LogsPage() {
  const actor = await requireActor([Role.STORE_ADMIN]);
  const logs = await db.auditLog.findMany({ where: { storeId: actor.storeId }, include: { actor: true }, orderBy: { createdAt: "desc" }, take: 100 });
  return <><PageHeader title="操作记录" description="查看商品上下架、员工停用和订单状态变更记录" /><section className="panel table-wrap"><table><thead><tr><th>时间</th><th>操作人</th><th>动作</th><th>对象</th><th>变更</th></tr></thead><tbody>{logs.map((log) => <tr key={log.id}><td>{formatDate(log.createdAt)}</td><td>{log.actor.name}</td><td><span className="badge">{log.action}</span></td><td>{log.entityType} / {log.entityId.slice(-8)}</td><td className="max-w-80 text-xs text-[#6d786f]">{log.beforeJson && log.afterJson ? `${log.beforeJson} → ${log.afterJson}` : "-"}</td></tr>)}</tbody></table>{!logs.length && <div className="empty">暂无操作记录。</div>}</section></>;
}
