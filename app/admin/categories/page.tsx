import Link from "next/link";
import { Role } from "@prisma/client";
import { Pencil, Power, Trash2 } from "lucide-react";
import { requireActor } from "@/lib/authz";
import { db } from "@/lib/db";
import { FormError, PageHeader } from "@/components/page-header";
import { deleteCategory, saveCategory, toggleCategory } from "../actions";

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<{ edit?: string; error?: string }> }) {
  const actor = await requireActor([Role.STORE_ADMIN]);
  const storeId = actor.storeId!;
  const query = await searchParams;
  const [categories, editing] = await Promise.all([
    db.category.findMany({ where: { storeId }, include: { _count: { select: { products: true } } }, orderBy: [{ sort: "asc" }, { createdAt: "asc" }] }),
    query.edit ? db.category.findFirst({ where: { id: query.edit, storeId } }) : null,
  ]);
  return <>
    <PageHeader title="商品分类" description="启用的分类按排序值显示在 H5 店铺页" />
    <FormError message={query.error} />
    <form action={saveCategory} className="panel mb-6 flex flex-wrap items-end gap-4 p-5">
      {editing && <input type="hidden" name="id" value={editing.id} />}
      <label className="label min-w-64 flex-1">分类名称<input className="field" name="name" required defaultValue={editing?.name} /></label>
      <label className="label w-36">排序值<input className="field" name="sort" type="number" defaultValue={editing?.sort ?? 0} /></label>
      <div className="actions"><button className="btn btn-primary">{editing ? "保存修改" : "新增分类"}</button>{editing && <Link className="btn" href="/admin/categories">取消</Link>}</div>
    </form>
    <section className="panel table-wrap"><table><thead><tr><th>分类名称</th><th>排序</th><th>商品数</th><th>状态</th><th>操作</th></tr></thead><tbody>{categories.map((category) => <tr key={category.id}><td><strong>{category.name}</strong></td><td>{category.sort}</td><td>{category._count.products}</td><td><span className={`badge ${category.isActive ? "" : "badge-off"}`}>{category.isActive ? "已启用" : "已停用"}</span></td><td><div className="actions"><Link className="btn min-h-8 px-2 text-xs" href={`/admin/categories?edit=${category.id}`}><Pencil size={14} />编辑</Link><form action={toggleCategory}><input type="hidden" name="id" value={category.id} /><button className="btn min-h-8 px-2 text-xs"><Power size={14} />{category.isActive ? "停用" : "启用"}</button></form><form action={deleteCategory}><input type="hidden" name="id" value={category.id} /><button className="btn btn-danger min-h-8 px-2 text-xs" disabled={category._count.products > 0} title={category._count.products ? "分类下有商品，不能删除" : "删除空分类"}><Trash2 size={14} />删除</button></form></div></td></tr>)}</tbody></table>{!categories.length && <div className="empty">暂无分类。</div>}</section>
  </>;
}
