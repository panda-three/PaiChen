import Link from "next/link";
import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { signOut } from "@/auth";
import { requireActor } from "@/lib/authz";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";

export default async function CustomerCenter() {
  const actor = await requireActor(); if (actor.role !== Role.CUSTOMER) redirect("/admin");
  const [profiles,favorites,orders,history]=await Promise.all([
    db.customerProfile.findMany({where:{customerId:actor.id},include:{store:true},orderBy:{createdAt:"desc"}}),
    db.favorite.findMany({where:{customerId:actor.id},include:{product:{include:{store:true}}},orderBy:{createdAt:"desc"}}),
    db.order.findMany({where:{customerId:actor.id},include:{store:true,items:true},orderBy:{createdAt:"desc"}}),
    db.behaviorEvent.findMany({where:{customerId:actor.id,type:"PRODUCT_VIEW",productId:{not:null}},include:{product:{include:{store:true}}},orderBy:{createdAt:"desc"},take:50}),
  ]);
  return <main className="mx-auto min-h-screen max-w-4xl bg-[#f7f6f2] p-5"><header className="flex items-center justify-between"><div><h1 className="text-2xl font-bold">我的</h1><p className="muted mt-1 text-sm">{actor.name} · {actor.phone}</p></div><form action={async()=>{"use server";await signOut({redirectTo:"/customer"});}}><button className="btn">退出登录</button></form></header>
    <section className="mt-6 grid gap-3 md:grid-cols-3">{profiles.map(item=><div className="panel p-4" key={item.id}><strong>{item.store.name}</strong><p className="muted mt-2 text-sm">档案状态：{item.status}</p><Link className="mt-3 inline-block text-sm text-[#176b45]" href={`/s/${item.store.slug}`}>进入店铺 →</Link></div>)}</section>
    <h2 className="mt-8 text-lg font-bold">我的订单</h2><section className="panel table-wrap mt-3"><table><thead><tr><th>订单</th><th>店铺</th><th>商品</th><th>状态</th><th>时间</th></tr></thead><tbody>{orders.map(item=><tr key={item.id}><td>{item.orderNo}</td><td>{item.store.name}</td><td>{item.items.map(x=>`${x.productName} × ${x.quantity}`).join("、")}</td><td>{item.status}</td><td>{formatDate(item.createdAt)}</td></tr>)}</tbody></table>{!orders.length&&<div className="empty">暂无订单</div>}</section>
    <h2 className="mt-8 text-lg font-bold">我的收藏</h2><div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">{favorites.map(item=><Link href={`/s/${item.product.store.slug}`} className="panel overflow-hidden" key={item.id}><img src={item.product.mainImageUrl} alt="" className="aspect-square w-full object-cover"/><div className="p-3 text-sm font-bold">{item.product.name}</div></Link>)}</div>
    <h2 className="mt-8 text-lg font-bold">浏览记录</h2><div className="mt-3 grid gap-2">{history.map(item=><div className="panel flex items-center gap-3 p-3" key={item.id}><img src={item.product?.mainImageUrl} alt="" className="size-12 rounded object-cover"/><div><strong className="text-sm">{item.product?.name??"已失效商品"}</strong><p className="muted text-xs">{item.product?.store.name} · {formatDate(item.createdAt)}</p></div></div>)}</div>
  </main>;
}
