import Link from "next/link";
import { Role } from "@prisma/client";
import { requireActor } from "@/lib/authz";
import { db } from "@/lib/db";
import { FormError, PageHeader } from "@/components/page-header";
import { saveCategory } from "../actions";
import { CategoryTreeTable } from "./category-tree-table";

type Query = { edit?: string; parent?: string; error?: string };

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<Query> }) {
  const actor = await requireActor([Role.STORE_ADMIN]);
  const storeId = actor.storeId!;
  const query = await searchParams;
  const [categories, editing, requestedParent] = await Promise.all([
    db.category.findMany({ where: { storeId }, include: { _count: { select: { products: true, children: true } } }, orderBy: [{ sort: "asc" }, { createdAt: "asc" }] }),
    query.edit ? db.category.findFirst({ where: { id: query.edit, storeId } }) : null,
    query.parent ? db.category.findFirst({ where: { id: query.parent, storeId, parentId: null } }) : null,
  ]);
  const roots = categories.filter((item) => !item.parentId);
  const children = categories.filter((item) => item.parentId);
  const editingParent = editing?.parentId ? roots.find((item) => item.id === editing.parentId) : null;
  const parent = editingParent ?? requestedParent;
  return <>
    <PageHeader title="商品分类" description="严格两级分类；商品只能归入二级分类，排序值越小越靠前" />
    <FormError message={query.error} />
    <form action={saveCategory} className="panel mb-6 flex flex-wrap items-end gap-4 p-5">
      {editing && <input type="hidden" name="id" value={editing.id} />}
      {parent && <input type="hidden" name="parentId" value={parent.id} />}
      <label className="label min-w-64 flex-1">{parent ? `${parent.name} / 二级分类名称` : "一级分类名称"}<input className="field" name="name" required defaultValue={editing?.name} /></label>
      <label className="label min-w-52">分类别名（后台备注）<input className="field" name="alias" defaultValue={editing?.alias ?? ""} /></label>
      <label className="label w-36">排序值<input className="field" name="sort" type="number" defaultValue={editing?.sort ?? 0} /></label>
      <div className="actions"><button className="btn btn-primary">{editing ? "保存修改" : parent ? "新增二级分类" : "新增一级分类"}</button>{(editing || parent) && <Link className="btn" href="/admin/categories">取消</Link>}</div>
    </form>
    <CategoryTreeTable roots={roots.map((root) => ({ ...root, createdAt: root.createdAt.toISOString(), productCount: root._count.products + children.filter((item) => item.parentId === root.id).reduce((sum, item) => sum + item._count.products, 0) }))} subcategories={children.map((item) => ({ ...item, createdAt: item.createdAt.toISOString(), productCount: item._count.products }))}/>
  </>;
}
