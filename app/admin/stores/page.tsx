import Link from "next/link";
import { Role } from "@prisma/client";
import { KeyRound, Pencil, Power, Store as StoreIcon } from "lucide-react";
import { requireActor } from "@/lib/authz";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { FormError, PageHeader } from "@/components/page-header";
import { createStore, issueStaffInvitation, resetManagerPassword, revokeStaffInvitation, toggleStore, updateStore } from "../actions";
import { CopyLink } from "@/components/copy-link";
import { enterStoreSupport } from "../phase-one-actions";

export default async function StoresPage({ searchParams }: { searchParams: Promise<{ edit?: string; error?: string; inviteLink?: string }> }) {
  await requireActor([Role.PLATFORM_ADMIN]);
  const query = await searchParams;
  const [stores, editing, invitations] = await Promise.all([
    db.store.findMany({ include: { users: { where: { role: Role.STORE_ADMIN }, take: 1 }, _count: { select: { products: true, orders: true } } }, orderBy: { createdAt: "desc" } }),
    query.edit ? db.store.findUnique({ where: { id: query.edit } }) : null,
    db.staffInvitation.findMany({ where: { role: Role.STORE_ADMIN, usedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, include: { store: true }, orderBy: { createdAt: "desc" } }),
  ]);
  return <>
    <PageHeader title="店铺管理" description="创建和维护入驻店铺及店铺管理员账号" />
    <FormError message={query.error} />
    <section className="panel mb-6 p-5"><h2 className="mb-2 font-bold">邀请店铺管理员注册 APP</h2><form action={issueStaffInvitation} className="form-grid"><label className="label">店铺<select className="field" name="storeId" required>{stores.filter((store)=>store.isActive).map((store)=><option value={store.id} key={store.id}>{store.name}</option>)}</select></label><label className="label">受邀手机号<input className="field" name="inviteePhone" inputMode="numeric" pattern="1[0-9]{10}" required/></label><button className="btn btn-primary self-end">生成邀请链接</button></form>{query.inviteLink&&<div className="mt-4 rounded border bg-[#f6f8f6] p-3"><p className="mb-2 text-sm">完整链接仅本次展示，请立即复制：</p><CopyLink path={query.inviteLink}/></div>}{invitations.length>0&&<div className="mt-4 space-y-2">{invitations.map((item)=><div className="actions text-sm" key={item.id}><span>{item.store.name} · {item.inviteePhone.replace(/^(\d{3})\d{4}(\d{4})$/,"$1****$2")} · {item.expiresAt.toLocaleString("zh-CN")} 到期</span><form action={revokeStaffInvitation}><input type="hidden" name="id" value={item.id}/><button className="btn min-h-8 px-2 text-xs">撤销</button></form></div>)}</div>}</section>
    <details className="panel mb-6" open={Boolean(editing) || stores.length === 0}>
      <summary className="cursor-pointer px-5 py-4 font-bold">{editing ? "编辑店铺" : "新建店铺"}</summary>
      <form action={editing ? updateStore : createStore} className="border-t border-[#e5e9e6] p-5">
        {editing && <input type="hidden" name="id" value={editing.id} />}
        <div className="form-grid">
          <label className="label">店铺名称<input className="field" name="name" required defaultValue={editing?.name} /></label>
          {!editing && <label className="label">店铺访问标识<input className="field" name="slug" required placeholder="例如 liangchen-home" pattern="[a-z0-9-]{3,30}" /></label>}
          <label className="label">联系电话<input className="field" name="phone" required defaultValue={editing?.phone} /></label>
          <label className="label">地址<input className="field" name="address" required defaultValue={editing?.address} /></label>
          {!editing && <><label className="label">管理员姓名<input className="field" name="managerName" required /></label><label className="label">管理员登录账号<input className="field" name="username" required /></label><label className="label">初始密码<input className="field" name="password" type="password" minLength={8} required /></label></>}
        </div>
        <div className="actions mt-5"><button className="btn btn-primary">保存店铺</button>{editing && <Link className="btn" href="/admin/stores">取消编辑</Link>}</div>
      </form>
    </details>
    <section className="panel table-wrap">
      <table><thead><tr><th>店铺</th><th>管理员账号</th><th>联系电话</th><th>业务数据</th><th>状态</th><th>创建时间</th><th>操作</th></tr></thead>
      <tbody>{stores.map((store) => <tr key={store.id}>
        <td><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded bg-[#e7efe9] text-[#176b45]"><StoreIcon size={18} /></span><div><strong>{store.name}</strong><div className="muted mt-1 text-xs">/s/{store.slug}</div></div></div></td>
        <td>{store.users[0]?.username ?? "-"}</td><td>{store.phone}</td><td className="text-sm">{store._count.products} 商品 / {store._count.orders} 订单</td>
        <td><span className={`badge ${store.isActive ? "" : "badge-off"}`}>{store.isActive ? "已启用" : "已停用"}</span></td><td>{formatDate(store.createdAt)}</td>
        <td><div className="actions"><form action={enterStoreSupport}><input type="hidden" name="id" value={store.id}/><button className="btn min-h-8 px-2 text-xs">代运营装修/商品</button></form><Link className="btn min-h-8 px-2 text-xs" href={`/admin/stores?edit=${store.id}`}><Pencil size={14} />编辑</Link><form action={toggleStore}><input type="hidden" name="id" value={store.id} /><button className="btn min-h-8 px-2 text-xs"><Power size={14} />{store.isActive ? "停用" : "启用"}</button></form><details><summary className="btn min-h-8 list-none px-2 text-xs"><KeyRound size={14} />重置密码</summary><form action={resetManagerPassword} className="absolute z-10 mt-2 flex gap-2 rounded border bg-white p-3 shadow-lg"><input type="hidden" name="storeId" value={store.id} /><input className="field w-44" name="password" type="password" minLength={8} placeholder="新密码（至少 8 位）" required /><button className="btn btn-primary">确认</button></form></details></div></td>
      </tr>)}</tbody></table>
      {!stores.length && <div className="empty">暂无店铺，请先创建。</div>}
    </section>
  </>;
}
