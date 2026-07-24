import { Role } from "@prisma/client";
import { requireActor } from "@/lib/authz";
import { db } from "@/lib/db";
import { FormError, PageHeader } from "@/components/page-header";
import { decideAuthorization } from "../phase-one-actions";

export default async function AuthorizationsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const actor = await requireActor([Role.STORE_ADMIN]); const query = await searchParams;
  const items = await db.productAuthorization.findMany({ where: { storeId: actor.storeId! }, include: { enterprise: true, series: { include: { _count: { select: { products: true } } } } }, orderBy: { createdAt: "desc" } });
  return <><PageHeader title="企业商品授权" description="接受后进入未分类、未上架状态；撤销后立即下架但保留历史" /><FormError message={query.error}/><section className="panel table-wrap"><table><thead><tr><th>企业</th><th>系列</th><th>商品数</th><th>状态</th><th>操作</th></tr></thead><tbody>{items.map(item=><tr key={item.id}><td>{item.enterprise.name}</td><td>{item.series.name}</td><td>{item.series._count.products}</td><td>{item.status}</td><td>{item.status === "PENDING" && <div className="actions"><form action={decideAuthorization}><input type="hidden" name="id" value={item.id}/><input type="hidden" name="decision" value="accept"/><button className="btn btn-primary min-h-8 text-xs">接受</button></form><form action={decideAuthorization}><input type="hidden" name="id" value={item.id}/><input type="hidden" name="decision" value="reject"/><button className="btn min-h-8 text-xs">拒绝</button></form></div>}</td></tr>)}</tbody></table></section></>;
}
