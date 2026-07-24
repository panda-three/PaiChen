import Link from "next/link";
import { Role } from "@prisma/client";
import { FileSpreadsheet, Pencil, Power } from "lucide-react";
import { getCatalogStore, requireActor } from "@/lib/authz";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { FormError, PageHeader } from "@/components/page-header";
import { saveProduct, toggleProduct } from "../actions";

type Params = { q?: string; category?: string; status?: string; edit?: string; error?: string };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const actor = await requireActor([Role.STORE_ADMIN, Role.PLATFORM_ADMIN]);
  const storeId = await getCatalogStore(actor);
  if (!storeId) return <><PageHeader title="商品代运营" description="请先从店铺管理进入代运营模式"/><Link className="btn" href="/admin/stores">选择店铺</Link></>;
  const query = await searchParams;
  const where = {
    storeId, isDeleted: false,
    ...(query.q ? { OR: [{ name: { contains: query.q } }, { code: { contains: query.q } }] } : {}),
    ...(query.category ? { categoryId: query.category } : {}),
    ...(query.status === "published" ? { isPublished: true } : query.status === "draft" ? { isPublished: false } : {}),
  };
  const [products, categories, editing] = await Promise.all([
    db.product.findMany({ where, include: { category: true, variants: true }, orderBy: [{ sort: "asc" }, { createdAt: "desc" }] }),
    db.category.findMany({ where: { storeId }, orderBy: { sort: "asc" } }),
    query.edit ? db.product.findFirst({ where: { id: query.edit, storeId } }) : null,
  ]);
  return <>
    <PageHeader title="商品管理" description="只有已上架且分类启用的商品会出现在 H5" actions={<Link className="btn" href="/admin/products/import"><FileSpreadsheet size={16} />Excel 导入</Link>} />
    <FormError message={query.error} />
    <details className="panel mb-6" open={Boolean(editing) || products.length === 0}>
      <summary className="cursor-pointer px-5 py-4 font-bold">{editing ? "编辑商品" : "手工新增商品"}</summary>
      <form action={saveProduct} className="border-t border-[#e5e9e6] p-5">
        {editing && <input type="hidden" name="id" value={editing.id} />}
        <div className="form-grid">
          <label className="label">商品名称<input className="field" name="name" required defaultValue={editing?.name} /></label>
          <label className="label">商品编码<input className="field" name="code" required defaultValue={editing?.code} /></label>
          <label className="label">所属分类<select className="field" name="categoryId" required defaultValue={editing?.categoryId ?? ""}><option value="">请选择分类</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}{category.isActive ? "" : "（已停用）"}</option>)}</select></label>
          <label className="label">规格/型号<input className="field" name="specification" required defaultValue={editing?.specification} /></label>
          <label className="label">参考价格<input className="field" name="price" type="number" min="0" step="0.01" defaultValue={editing?.price?.toString() ?? ""} placeholder="留空表示面议" /></label>
          <label className="label">参考库存<input className="field" name="referenceStock" type="number" min="0" defaultValue={editing?.referenceStock ?? ""} placeholder="仅供参考，不扣减" /></label>
          <label className="label">单位<input className="field" name="unit" required defaultValue={editing?.unit ?? "件"} /></label>
          <label className="label">排序值<input className="field" name="sort" type="number" defaultValue={editing?.sort ?? 0} /></label>
          <label className="label col-span-full">主图 URL<input className="field" name="mainImageUrl" type="url" required defaultValue={editing?.mainImageUrl} /></label>
          <label className="label col-span-full">详情图 URL（每行一个）<textarea className="field min-h-24" name="detailImageUrls" defaultValue={editing?.detailImageUrls} /></label>
          <label className="label col-span-full">商品描述<textarea className="field min-h-28" name="description" defaultValue={editing?.description} /></label>
        </div>
        <p className="muted mt-4 text-xs">新增和 Excel 导入的商品默认下架，确认资料后再手工上架。</p>
        <div className="actions mt-5"><button className="btn btn-primary">保存商品</button>{editing && <Link className="btn" href="/admin/products">取消编辑</Link>}</div>
      </form>
    </details>
    <form className="panel mb-5 grid gap-3 p-4 md:grid-cols-[1fr_220px_160px_auto]">
      <input className="field" name="q" defaultValue={query.q} placeholder="搜索商品名称或编码" />
      <select className="field" name="category" defaultValue={query.category}><option value="">全部分类</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
      <select className="field" name="status" defaultValue={query.status}><option value="">全部状态</option><option value="published">已上架</option><option value="draft">已下架</option></select>
      <button className="btn btn-primary">筛选</button>
    </form>
    <section className="panel table-wrap"><table><thead><tr><th>商品</th><th>来源/编码</th><th>分类</th><th>规格</th><th>参考价格/库存</th><th>排序</th><th>状态</th><th>操作</th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td><div className="flex min-w-56 items-center gap-3"><img src={product.mainImageUrl} alt="" className="size-12 rounded object-cover" /><strong>{product.name}</strong></div></td><td><span className="badge badge-off">{product.source}</span><div className="mt-1">{product.code}</div></td><td>{product.category?.name ?? "未分类"}</td><td>{product.variants.map(v=>v.name).join("、") || product.specification}</td><td>{formatPrice(product.price)}<div className="muted text-xs">库存 {product.referenceStock ?? "未设"}</div></td><td>{product.sort}</td><td><span className={`badge ${product.isPublished ? "" : "badge-off"}`}>{product.isPublished ? "已上架" : "已下架"}</span></td><td><div className="actions"><Link className="btn min-h-8 px-2 text-xs" href={`/admin/products?edit=${product.id}`}><Pencil size={14} />编辑</Link><form action={toggleProduct}><input type="hidden" name="id" value={product.id} /><button className="btn min-h-8 px-2 text-xs"><Power size={14} />{product.isPublished ? "下架" : "上架"}</button></form></div></td></tr>)}</tbody></table>{!products.length && <div className="empty">没有符合条件的商品。</div>}</section>
  </>;
}
