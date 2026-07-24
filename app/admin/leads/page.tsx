import Link from "next/link";
import { Role } from "@prisma/client";
import { requireActor } from "@/lib/authz";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/page-header";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const actor = await requireActor([Role.STORE_ADMIN, Role.EMPLOYEE]);
  const query = await searchParams;
  const leads = await db.lead.findMany({ where: { storeId: actor.storeId!, ...(query.q ? { OR: [{ name: { contains: query.q } }, { phone: { contains: query.q } }] } : {}), ...(actor.role === Role.EMPLOYEE ? { latestEmployeeId: actor.id } : {}) }, include: { latestEmployee: true, _count: { select: { orders: true } } }, orderBy: { lastOrderAt: "desc" } });
  return <><PageHeader title={actor.role === Role.EMPLOYEE ? "我的客户" : "客户线索"} description="同一店铺内按手机号归并，保留最近来源员工" /><form className="panel mb-5 flex gap-3 p-4"><input className="field max-w-md" name="q" defaultValue={query.q} placeholder="搜索客户姓名或手机号" /><button className="btn btn-primary">查询</button></form><section className="panel table-wrap"><table><thead><tr><th>客户</th><th>手机号</th><th>最近来源员工</th><th>首次开单</th><th>最近开单</th><th>订单数</th></tr></thead><tbody>{leads.map((lead) => <tr key={lead.id}><td><strong>{lead.name}</strong></td><td>{lead.phone}</td><td>{lead.latestEmployee?.name ?? "店铺默认"}</td><td>{formatDate(lead.firstOrderAt)}</td><td>{formatDate(lead.lastOrderAt)}</td><td><Link className="text-[#176b45] underline-offset-2 hover:underline" href={`/admin/orders?q=${encodeURIComponent(lead.phone)}`}>{lead._count.orders} 单</Link></td></tr>)}</tbody></table>{!leads.length && <div className="empty">暂无客户线索。</div>}</section></>;
}
