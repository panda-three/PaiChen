"use client";

import Link from "next/link";
import { ChevronDown, ChevronRight, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { useState } from "react";
import { deleteCategory, saveCategory, toggleCategory } from "../actions";

type Row = { id: string; name: string; alias: string | null; sort: number; isActive: boolean; parentId: string | null; createdAt: string; productCount: number; _count: { children: number; products: number } };
const date = (value: string) => new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));

function SortCell({ row }: { row: Row }) {
  return <form action={saveCategory}><input type="hidden" name="id" value={row.id}/><input type="hidden" name="parentId" value={row.parentId ?? ""}/><input type="hidden" name="name" value={row.name}/><input type="hidden" name="alias" value={row.alias ?? ""}/><input className="field h-8 w-20 px-2" aria-label={`${row.name}排序`} name="sort" type="number" defaultValue={row.sort} onBlur={(event) => event.currentTarget.form?.requestSubmit()} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }}/></form>;
}

export function CategoryTreeTable({ roots, subcategories }: { roots: Row[]; subcategories: Row[] }) {
  const [open, setOpen] = useState(() => new Set(roots.map((item) => item.id)));
  const render = (row: Row, child = false) => <tr key={row.id} className={child ? "bg-white" : "bg-[#f5f7f5]"}>
    <td><div className={`flex items-center gap-2 ${child ? "pl-9" : "font-bold"}`}>{!child && <button type="button" className="grid size-6 place-items-center" aria-label={`${open.has(row.id) ? "收起" : "展开"}${row.name}`} onClick={() => setOpen((current) => { const next = new Set(current); if (next.has(row.id)) next.delete(row.id); else next.add(row.id); return next; })}>{open.has(row.id) ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}</button>}{child && <span className="text-[#aab3ac]">└</span>}<span>{row.name}</span></div></td>
    <td><SortCell row={row}/></td><td>{row.alias || "—"}</td><td>{row.productCount}</td><td className="whitespace-nowrap text-xs">{date(row.createdAt)}</td><td><span className={`badge ${row.isActive ? "" : "badge-off"}`}>{row.isActive ? "已启用" : "已停用"}</span></td>
    <td><div className="actions">{!child && <Link className="btn min-h-8 px-2 text-xs" href={`/admin/categories?parent=${row.id}`}><Plus size={14}/>新增二级分类</Link>}<Link className="btn min-h-8 px-2 text-xs" href={`/admin/categories?edit=${row.id}`}><Pencil size={14}/>编辑</Link><form action={toggleCategory}><input type="hidden" name="id" value={row.id}/><button className="btn min-h-8 px-2 text-xs"><Power size={14}/>{row.isActive ? "停用" : "启用"}</button></form><form action={deleteCategory}><input type="hidden" name="id" value={row.id}/><button className="btn btn-danger min-h-8 px-2 text-xs" disabled={row.productCount > 0 || (!child && row._count.children > 0)}><Trash2 size={14}/>删除</button></form></div></td>
  </tr>;
  return <section className="panel table-wrap"><table><thead><tr><th>分类名称</th><th>排序</th><th>分类别名</th><th>商品数</th><th>创建时间</th><th>状态</th><th>操作</th></tr></thead><tbody>{roots.flatMap((root) => [render(root), ...(open.has(root.id) ? subcategories.filter((item) => item.parentId === root.id).map((item) => render(item, true)) : [])])}</tbody></table>{!roots.length && <div className="empty">暂无分类。</div>}</section>;
}
