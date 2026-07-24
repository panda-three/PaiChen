import Link from "next/link";
import { Role } from "@prisma/client";
import { Pencil, Power } from "lucide-react";
import { requireActor } from "@/lib/authz";
import { db } from "@/lib/db";
import { FormError, PageHeader } from "@/components/page-header";
import { CopyLink } from "@/components/copy-link";
import { saveEmployee, toggleEmployee } from "../actions";

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ edit?: string; error?: string }> }) {
  const actor = await requireActor([Role.STORE_ADMIN]);
  const query = await searchParams;
  const [employees, editing] = await Promise.all([
    db.user.findMany({ where: { storeId: actor.storeId, role: Role.EMPLOYEE }, orderBy: { createdAt: "desc" } }),
    query.edit ? db.user.findFirst({ where: { id: query.edit, storeId: actor.storeId, role: Role.EMPLOYEE } }) : null,
  ]);
  return <>
    <PageHeader title="员工管理" description="维护员工后台账号、个人名片与专属分享入口" />
    <FormError message={query.error} />
    <details className="panel mb-6" open={Boolean(editing) || employees.length === 0}>
      <summary className="cursor-pointer px-5 py-4 font-bold">{editing ? "编辑员工" : "创建员工"}</summary>
      <form action={saveEmployee} className="border-t border-[#e5e9e6] p-5">
        {editing && <input type="hidden" name="id" value={editing.id} />}
        <div className="form-grid">
          <label className="label">员工姓名<input className="field" name="name" required defaultValue={editing?.name} /></label>
          <label className="label">登录账号<input className="field" name="username" required defaultValue={editing?.username} /></label>
          {!editing && <label className="label">初始密码<input className="field" name="password" type="password" minLength={8} required /></label>}
          <label className="label">手机号<input className="field" name="phone" required defaultValue={editing?.phone ?? ""} /></label>
          <label className="label">微信号<input className="field" name="wechat" defaultValue={editing?.wechat ?? ""} /></label>
          <label className="label">职位<input className="field" name="title" maxLength={30} defaultValue={editing?.title ?? ""} /></label>
          <label className="label col-span-full">头像 URL<input className="field" name="avatarUrl" type="url" defaultValue={editing?.avatarUrl ?? ""} /></label>
          <label className="label col-span-full">名片文案（最多三行）<textarea className="field min-h-24 resize-y" name="bio" maxLength={90} defaultValue={editing?.bio ?? ""} /></label>
        </div>
        <div className="actions mt-5"><button className="btn btn-primary">保存员工</button>{editing && <Link className="btn" href="/admin/employees">取消编辑</Link>}</div>
      </form>
    </details>
    <section className="panel table-wrap"><table><thead><tr><th>员工</th><th>账号</th><th>联系方式</th><th>名片</th><th>状态</th><th>操作</th></tr></thead><tbody>
      {employees.map((employee) => <tr key={employee.id}><td><div className="flex items-center gap-3">{employee.avatarUrl ? <img src={employee.avatarUrl} alt="" className="size-10 rounded-full object-cover" /> : <span className="grid size-10 place-items-center rounded-full bg-[#e6eee8] font-bold">{employee.name.slice(0, 1)}</span>}<strong>{employee.name}</strong></div></td><td>{employee.username}</td><td><div>{employee.phone}</div><div className="muted text-xs">微信：{employee.wechat || "未填写"}</div></td><td><div>{employee.title || "员工顾问"}</div><div className="muted max-w-60 truncate text-xs">{employee.bio || "未填写名片文案"}</div></td><td><span className={`badge ${employee.isActive ? "" : "badge-off"}`}>{employee.isActive ? "已启用" : "已停用"}</span></td><td><div className="actions"><Link className="btn min-h-8 px-2 text-xs" href={`/admin/employees?edit=${employee.id}`}><Pencil size={14} />编辑</Link><CopyLink compact path={`/s/${actor.store!.slug}?ref=${employee.shareCode}`} /><form action={toggleEmployee}><input type="hidden" name="id" value={employee.id} /><button className="btn min-h-8 px-2 text-xs"><Power size={14} />{employee.isActive ? "停用" : "启用"}</button></form></div></td></tr>)}
    </tbody></table>{!employees.length && <div className="empty">暂无员工，请先创建。</div>}</section>
  </>;
}
