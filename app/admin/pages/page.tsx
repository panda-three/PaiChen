import Link from "next/link";
import { Role } from "@prisma/client";
import { cookies } from "next/headers";
import { requireActor } from "@/lib/authz";
import { db } from "@/lib/db";
import { FormError, PageHeader } from "@/components/page-header";
import { formatDate } from "@/lib/format";
import { createPage, leaveStoreSupport, setHomePage } from "../phase-one-actions";

export default async function PagesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const actor = await requireActor([Role.STORE_ADMIN, Role.PLATFORM_ADMIN]); const query = await searchParams;
  const storeId = actor.role === Role.STORE_ADMIN ? actor.storeId : (await cookies()).get("supportStoreId")?.value;
  const store = storeId ? await db.store.findUnique({ where: { id: storeId }, include: { pages: { orderBy: { updatedAt: "desc" } } } }) : null;
  if (!store) return <><PageHeader title="页面代运营" description="请从店铺管理选择一家店铺进入；平台身份始终保留且无法访问业务数据"/><Link className="btn btn-primary" href="/admin/stores">选择店铺</Link></>;
  return <><PageHeader title={`页面装修 · ${store.name}`} description="草稿与线上版本分离；发布时校验组件并清理危险富文本" actions={actor.role === Role.PLATFORM_ADMIN ? <form action={leaveStoreSupport}><button className="btn">退出代运营</button></form> : undefined}/><FormError message={query.error}/>
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]"><section><form action={createPage} className="panel mb-5 grid gap-3 p-4 md:grid-cols-2"><input className="field" name="title" placeholder="页面名称" required/><input className="field" name="slug" placeholder="页面标识，如 living-room" required/><select className="field" name="category" defaultValue="普通页面"><option>首页</option><option>普通页面</option><option>活动页面</option></select><select className="field" name="template" defaultValue="blank"><option value="blank">空白页</option><option value="home">家居店铺首页模板</option></select><button className="btn btn-primary md:col-span-2">创建页面草稿</button></form><div className="panel table-wrap"><table><thead><tr><th>页面</th><th>分类</th><th>状态</th><th>创建 / 更新</th><th>主页</th><th>操作</th></tr></thead><tbody>{store.pages.map(page=>{const status=!page.publishedAt?"草稿":page.draftJson!==page.publishedJson?"有未发布修改":"已发布";return <tr key={page.id}><td><strong>{page.title}</strong><div className="muted text-xs">/{page.slug}</div></td><td>{page.category}</td><td><span className={`badge ${status==="有未发布修改"?"badge-warn":status==="草稿"?"badge-off":""}`}>{status}</span></td><td className="whitespace-nowrap text-xs"><div>{formatDate(page.createdAt)}</div><div className="muted">{formatDate(page.updatedAt)}</div></td><td>{page.isHome ? "是" : "否"}</td><td><div className="actions"><Link className="btn min-h-8 text-xs" href={`/admin/pages/${page.id}`}>编辑</Link>{page.publishedAt&&<a className="btn min-h-8 text-xs" target="_blank" href={`/s/${store.slug}/p/${page.slug}`}>线上页</a>}{page.publishedAt&&!page.isHome&&<form action={setHomePage}><input type="hidden" name="id" value={page.id}/><button className="btn min-h-8 text-xs">设为主页</button></form>}</div></td></tr>})}</tbody></table>{!store.pages.length&&<div className="empty">还没有页面。</div>}</div></section><aside className="panel p-5"><p className="text-xs font-bold tracking-wider text-[#176b45]">第一方免费模板</p><h2 className="mt-2 text-xl font-bold">家居店铺首页</h2><p className="muted mt-3 text-sm leading-6">包含店铺头部、员工名片、搜索、分类导航与商品网格。复制后是当前店铺独立草稿。</p><p className="mt-4 text-xs">本期仅提供内置免费模板，不包含模板市场和第三方素材。</p></aside></div>
  </>;
}
