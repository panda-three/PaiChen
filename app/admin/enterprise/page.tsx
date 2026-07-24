import Link from "next/link";
import { Role } from "@prisma/client";
import { requireActor } from "@/lib/authz";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/page-header";

export default async function EnterpriseDashboard() {
  const actor = await requireActor([Role.ENTERPRISE_ADMIN]);
  const enterpriseId=actor.enterpriseId!;const [series, products, authorizationCount] = await Promise.all([db.enterpriseSeries.count({ where: { enterpriseId } }), db.enterpriseProduct.count({ where: { series: { enterpriseId } } }), db.productAuthorization.count({ where: { enterpriseId } })]);
  return <><PageHeader title="企业工作台" description="只展示企业产品与授权数据，不包含经销商客户、订单或经营明细" /><div className="grid gap-4 md:grid-cols-3">{[["产品系列",series],["企业产品",products],["授权关系",authorizationCount]].map(([label,n]) => <div className="panel p-6" key={String(label)}><p className="muted text-sm">{label}</p><strong className="mt-2 block text-3xl">{n}</strong></div>)}</div><Link className="btn btn-primary mt-5" href="/admin/enterprise/products">维护产品与授权</Link></>;
}
