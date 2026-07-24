import { Role } from "@prisma/client";
import { requireActor } from "@/lib/authz";
import { db } from "@/lib/db";
import { FormError, PageHeader } from "@/components/page-header";
import { quickOrder } from "../../phase-one-actions";

export default async function NewOrderPage({searchParams}:{searchParams:Promise<{error?:string}>}){
  const actor=await requireActor([Role.STORE_ADMIN,Role.EMPLOYEE]);const query=await searchParams;
  const products=await db.product.findMany({where:{storeId:actor.storeId!,isDeleted:false},include:{variants:true},orderBy:{name:"asc"}});
  return <><PageHeader title="后台快速开单" description="可为未注册客户按手机号创建或复用本店客户线索"/><FormError message={query.error}/><form action={quickOrder} className="panel form-grid p-5"><label className="label">客户姓名<input className="field" name="name" required/></label><label className="label">手机号<input className="field" name="phone" pattern="1[0-9]{10}" required/></label><label className="label">商品<select className="field" name="productId" required>{products.map(p=><option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}</select></label><label className="label">规格 ID（可选）<select className="field" name="variantId"><option value="">默认规格</option>{products.flatMap(p=>p.variants.map(v=><option key={v.id} value={v.id}>{p.name} / {v.name}</option>))}</select></label><label className="label">数量<input className="field" name="quantity" type="number" min="1" defaultValue="1"/></label><div className="self-end"><button className="btn btn-primary">创建意向订单</button></div></form></>;
}
