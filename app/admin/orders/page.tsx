import Link from "next/link";
import { OrderStatus, Role } from "@prisma/client";
import { Download, Eye } from "lucide-react";
import { requireActor } from "@/lib/authz";
import { db } from "@/lib/db";
import { formatDate, statusLabel } from "@/lib/format";
import { orderScope } from "@/lib/scopes";
import { PageHeader } from "@/components/page-header";

type Params = { q?: string; status?: string; employee?: string; responsible?: string; product?: string; from?: string; to?: string };
export default async function OrdersPage({ searchParams }: { searchParams: Promise<Params> }) {
  const actor = await requireActor([Role.STORE_ADMIN, Role.EMPLOYEE]); const query = await searchParams;
  const status = Object.values(OrderStatus).includes(query.status as OrderStatus) ? query.status as OrderStatus : undefined;
  const filters = [orderScope(actor), ...(status ? [{ status }] : []), ...(query.employee && actor.role === Role.STORE_ADMIN ? [{ sourceEmployeeId: query.employee }] : []), ...(query.responsible && actor.role === Role.STORE_ADMIN ? [{ responsibleEmployeeId: query.responsible }] : []), ...(query.product ? [{ items: { some: { productName: { contains: query.product } } } }] : []), ...(query.from ? [{ createdAt: { gte: new Date(`${query.from}T00:00:00`) } }] : []), ...(query.to ? [{ createdAt: { lte: new Date(`${query.to}T23:59:59`) } }] : []), ...(query.q ? [{ OR: [{ orderNo: { contains: query.q } }, { customerName: { contains: query.q } }, { customerPhone: { contains: query.q } }] }] : [])];
  const [orders, employees] = await Promise.all([
    db.order.findMany({ where: { AND: filters }, include: { sourceEmployee: true, responsibleEmployee: true, items: true }, orderBy: { createdAt: "desc" } }),
    actor.role === Role.STORE_ADMIN ? db.user.findMany({ where: { storeId: actor.storeId, role: Role.EMPLOYEE }, orderBy: { name: "asc" } }) : [],
  ]);
  const exportParams = new URLSearchParams(); Object.entries(query).forEach(([key,val])=>{if(val)exportParams.set(key,val)});
  return <><PageHeader title={actor.role === Role.EMPLOYEE ? "我的订单" : "订单管理"} description="员工可查看本人来源或本人负责的订单" actions={<div className="actions"><Link className="btn btn-primary" href="/admin/orders/new">快速开单</Link><a className="btn" href={`/api/orders/export?${exportParams}`}><Download size={16}/>导出当前筛选</a></div>}/>
    <form className="panel mb-5 grid gap-3 p-4 md:grid-cols-4"><input className="field" name="q" defaultValue={query.q} placeholder="订单号、客户或手机号"/><input className="field" name="product" defaultValue={query.product} placeholder="商品名称"/><select className="field" name="status" defaultValue={query.status}><option value="">全部状态</option>{Object.values(OrderStatus).map(value=><option key={value} value={value}>{statusLabel[value]}</option>)}</select>{actor.role===Role.STORE_ADMIN?<><select className="field" name="employee" defaultValue={query.employee}><option value="">全部来源员工</option>{employees.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select><select className="field" name="responsible" defaultValue={query.responsible}><option value="">全部负责人</option>{employees.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></>:<span/>}<input className="field" name="from" type="date" defaultValue={query.from}/><input className="field" name="to" type="date" defaultValue={query.to}/><button className="btn btn-primary">筛选</button></form>
    <section className="panel table-wrap"><table><thead><tr><th>订单编号</th><th>客户</th><th>商品</th><th>来源 / 负责人</th><th>提交时间</th><th>状态</th><th>操作</th></tr></thead><tbody>{orders.map(order=><tr key={order.id}><td><strong className="font-mono text-xs">{order.orderNo}</strong></td><td>{order.customerName}<div className="muted text-xs">{order.customerPhone}</div></td><td>{order.items[0]?.productName}{order.items.length>1?` 等 ${order.items.length} 件`:` × ${order.items[0]?.quantity}`}</td><td>{order.sourceEmployee?.name??"店铺默认"}<div className="muted text-xs">负责：{order.responsibleEmployee?.name??"未分配"}</div></td><td>{formatDate(order.createdAt)}</td><td><span className={`badge ${order.status==="WON"?"":order.status==="LOST"?"badge-off":"badge-warn"}`}>{statusLabel[order.status]}</span></td><td><Link className="btn min-h-8 px-2 text-xs" href={`/admin/orders/${order.id}`}><Eye size={14}/>查看详情</Link></td></tr>)}</tbody></table>{!orders.length&&<div className="empty">暂无符合条件的订单。</div>}</section>
  </>;
}
