import Link from "next/link";
import { OrderStatus, Role } from "@prisma/client";
import { Download, Eye } from "lucide-react";
import { requireActor } from "@/lib/authz";
import { db } from "@/lib/db";
import { formatDate, statusLabel } from "@/lib/format";
import { PageHeader } from "@/components/page-header";

type Params = { q?: string; status?: string; employee?: string };
export default async function OrdersPage({ searchParams }: { searchParams: Promise<Params> }) {
  const actor = await requireActor([Role.STORE_ADMIN, Role.EMPLOYEE]);
  const query = await searchParams;
  const status = Object.values(OrderStatus).includes(query.status as OrderStatus) ? query.status as OrderStatus : undefined;
  const orders = await db.order.findMany({ where: { storeId: actor.storeId!, ...(actor.role === Role.EMPLOYEE ? { sourceEmployeeId: actor.id } : {}), ...(status ? { status } : {}), ...(query.employee && actor.role === Role.STORE_ADMIN ? { sourceEmployeeId: query.employee } : {}), ...(query.q ? { OR: [{ orderNo: { contains: query.q } }, { customerName: { contains: query.q } }, { customerPhone: { contains: query.q } }] } : {}) }, include: { sourceEmployee: true, items: true }, orderBy: { createdAt: "desc" } });
  const employees = actor.role === Role.STORE_ADMIN ? await db.user.findMany({ where: { storeId: actor.storeId, role: Role.EMPLOYEE }, orderBy: { name: "asc" } }) : [];
  const exportParams = new URLSearchParams(); if (query.q) exportParams.set("q", query.q); if (query.status) exportParams.set("status", query.status); if (query.employee) exportParams.set("employee", query.employee);
  return <><PageHeader title={actor.role === Role.EMPLOYEE ? "我的订单" : "订单管理"} description="订单是购买意向记录，不包含在线支付与履约流程" actions={<a className="btn" href={`/api/orders/export?${exportParams}`}><Download size={16} />导出当前筛选</a>} /><form className="panel mb-5 grid gap-3 p-4 md:grid-cols-[1fr_180px_180px_auto]"><input className="field" name="q" defaultValue={query.q} placeholder="订单编号、客户姓名或手机号" /><select className="field" name="status" defaultValue={query.status}><option value="">全部状态</option>{Object.values(OrderStatus).map((value) => <option key={value} value={value}>{statusLabel[value]}</option>)}</select>{actor.role === Role.STORE_ADMIN ? <select className="field" name="employee" defaultValue={query.employee}><option value="">全部员工</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select> : <span />}</form><section className="panel table-wrap"><table><thead><tr><th>订单编号</th><th>客户</th><th>商品</th><th>来源员工</th><th>提交时间</th><th>状态</th><th>操作</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><strong className="font-mono text-xs">{order.orderNo}</strong></td><td><div>{order.customerName}</div><div className="muted text-xs">{order.customerPhone}</div></td><td><div>{order.items[0]?.productName}{order.items.length > 1 ? ` 等 ${order.items.length} 件` : ` × ${order.items[0]?.quantity}`}</div></td><td>{order.sourceEmployee?.name ?? "店铺默认"}</td><td>{formatDate(order.createdAt)}</td><td><span className={`badge ${order.status === "WON" ? "" : order.status === "LOST" ? "badge-off" : "badge-warn"}`}>{statusLabel[order.status]}</span></td><td><Link className="btn min-h-8 px-2 text-xs" href={`/admin/orders/${order.id}`}><Eye size={14} />查看详情</Link></td></tr>)}</tbody></table>{!orders.length && <div className="empty">暂无符合条件的订单。</div>}</section></>;
}
