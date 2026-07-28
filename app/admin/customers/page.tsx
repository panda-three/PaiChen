import { CustomerStatus, Role } from "@prisma/client";
import { requireActor } from "@/lib/authz";
import { db } from "@/lib/db";
import { FormError, PageHeader } from "@/components/page-header";
import { approveCustomer } from "../phase-one-actions";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ error?:string; status?:string }> }) {
  const actor=await requireActor([Role.STORE_ADMIN,Role.EMPLOYEE]);const query=await searchParams;const status=Object.values(CustomerStatus).includes(query.status as CustomerStatus)?query.status as CustomerStatus:undefined;
  const profiles=await db.customerProfile.findMany({where:{storeId:actor.storeId!,...(actor.role===Role.EMPLOYEE?{sourceEmployeeId:actor.id}:{}),...(status?{status}:{})},include:{sourceEmployee:true,customer:{include:{_count:{select:{favorites:true,customerOrders:true,events:true}}}}},orderBy:{createdAt:"desc"}});
  return <><PageHeader title="客户档案与密码重置" description="注册账号无需审核；此处维护本店客户档案，并人工处理忘记密码申请"/><FormError message={query.error}/><section className="panel table-wrap"><table><thead><tr><th>客户</th><th>来源员工</th><th>状态</th><th>行为/订单</th><th>密码重置</th></tr></thead><tbody>{profiles.map(item=><tr key={item.id}><td><strong>{item.name}</strong><div className="muted text-xs">{item.phone}</div>{item.customer.resetCode&&<div className="mt-1 text-xs text-amber-700">重置申请码：{item.customer.resetCode}</div>}</td><td>{item.sourceEmployee?.name??"店铺默认"}</td><td>{item.status}</td><td>{item.customer._count.events} 行为 / {item.customer._count.favorites} 收藏 / {item.customer._count.customerOrders} 订单</td><td>{item.status==="RESET_PENDING"&&<div className="actions"><form action={approveCustomer}><input type="hidden" name="id" value={item.id}/><input type="hidden" name="decision" value="approve"/><button className="btn btn-primary min-h-8 text-xs">核实并启用新密码</button></form><form action={approveCustomer}><input type="hidden" name="id" value={item.id}/><input type="hidden" name="decision" value="reject"/><button className="btn min-h-8 text-xs">拒绝重置</button></form></div>}</td></tr>)}</tbody></table>{!profiles.length&&<div className="empty">暂无客户档案。</div>}</section></>;
}
