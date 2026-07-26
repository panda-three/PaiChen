"use client";

import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  type DragEndEvent,
  type DragStartEvent,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useMemo, useState } from "react";
import {
  Storefront,
  type StorefrontEmployee,
  type StorefrontProduct,
  type StorefrontStore,
} from "@/app/s/[slug]/storefront";
import {
  insertPageComponent,
  movePageComponent,
  removePageComponent,
} from "@/lib/page-editor-state";
import type { PageComponentV2, PageConfigV2 } from "@/lib/page-config";
import { publishPage, savePageDraft } from "../../phase-one-actions";

const CANVAS_ID = "page-editor-canvas";
const labels: Record<PageComponentV2["type"], string> = {
  heroCarousel: "首屏轮播",
  quickNav: "快捷导航",
  announcement: "动态公告",
  seriesShowcase: "系列展示",
  newProducts: "新品轮播",
  storeHeader: "店铺头部",
  employeeCard: "员工名片",
  image: "图片广告",
  text: "标题 / 正文",
  richText: "富文本",
  productSearch: "商品搜索",
  categoryNav: "分类导航",
  productGrid: "商品网格",
  contentCard: "内容卡片",
  video: "视频",
  divider: "分隔线",
};
const types = Object.keys(labels) as PageComponentV2["type"][];

type Category = { id: string; name: string };
type Props = {
  page: { id: string; title: string; slug: string; config: PageConfigV2; published: boolean; isHome: boolean };
  publicUrl: string;
  store: StorefrontStore;
  employee: StorefrontEmployee;
  products: StorefrontProduct[];
  categories: Category[];
};
type DragData = { kind: "palette"; type: PageComponentV2["type"] } | { kind: "component" };

function makeComponent(
  type: PageComponentV2["type"],
  products: StorefrontProduct[],
): PageComponentV2 {
  const id = crypto.randomUUID();
  switch (type) {
    case "heroCarousel": return { id, type, slides: [] };
    case "quickNav": return { id, type, items: [] };
    case "announcement": return { id, type, messages: ["欢迎来到线上展厅"] };
    case "seriesShowcase": return { id, type, title: "探索系列", categoryIds: [] };
    case "newProducts": return { id, type, title: "当季新品", source: { mode: "all" } };
    case "storeHeader": return { id, type, style: "compact", subtitle: "家居美学 · 意向开单" };
    case "employeeCard": return { id, type, style: "dark" };
    case "image": return { id, type, url: products[0]?.mainImageUrl ?? "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200", alt: "图片广告" };
    case "text": return { id, type, title: "品牌标题", body: "介绍您的空间与服务" };
    case "richText": return { id, type, html: "<p>富文本内容</p>" };
    case "productSearch": return { id, type, placeholder: "搜索商品" };
    case "categoryNav": return { id, type, title: "商品分类" };
    case "productGrid": return { id, type, title: "精选商品", source: { mode: "all" } };
    case "contentCard": return { id, type, title: "设计灵感", body: "用材质与光线塑造理想之家" };
    case "video": return { id, type, url: "https://www.w3schools.com/html/mov_bbb.mp4" };
    case "divider": return { id, type };
  }
}

function PaletteItem({ type, onAdd }: { type: PageComponentV2["type"]; onAdd: () => void }) {
  const { attributes, isDragging, listeners, setNodeRef } = useDraggable({
    id: `palette:${type}`,
    data: { kind: "palette", type } satisfies DragData,
  });
  return <div ref={setNodeRef} className={`flex items-center rounded border border-[#d6ddd8] bg-white ${isDragging ? "opacity-40" : ""}`}>
    <button type="button" className="min-h-10 flex-1 px-3 text-left text-sm font-semibold" onClick={onAdd}>＋ {labels[type]}</button>
    <button type="button" className="grid min-h-10 w-10 cursor-grab place-items-center border-l border-[#e3e8e4] text-[#69736c] active:cursor-grabbing" aria-label={`拖动添加${labels[type]}`} {...attributes} {...listeners}><GripVertical size={16}/></button>
  </div>;
}

function SortableCanvasItem({
  component,
  selected,
  children,
  onSelect,
  onRemove,
}: {
  component: PageComponentV2;
  selected: boolean;
  children: ReactNode;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({
    id: component.id,
    data: { kind: "component" } satisfies DragData,
  });
  return <div
    ref={setNodeRef}
    style={{ transform: CSS.Transform.toString(transform), transition }}
    className={`group relative mb-4 rounded-xl ${selected ? "ring-2 ring-[#176b45] ring-offset-2" : "hover:ring-2 hover:ring-[#176b45]/40"} ${isDragging ? "z-30 opacity-35" : ""}`}
    onClick={onSelect}
  >
    <div className="pointer-events-none [&>*]:!mb-0">{children}</div>
    <button
      type="button"
      aria-label={`拖动${labels[component.type]}`}
      className={`absolute left-2 top-2 z-10 grid size-8 cursor-grab place-items-center rounded bg-white text-[#465149] shadow-md active:cursor-grabbing ${selected ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"}`}
      onClick={(event) => event.stopPropagation()}
      {...attributes}
      {...listeners}
    ><GripVertical size={17}/></button>
    {selected && <button
      type="button"
      aria-label={`删除${labels[component.type]}`}
      className="absolute right-2 top-2 z-10 grid size-8 place-items-center rounded bg-white text-[#b83931] shadow-md"
      onClick={(event) => { event.stopPropagation(); onRemove(); }}
    ><Trash2 size={16}/></button>}
  </div>;
}

function PhoneCanvas({ children, empty }: { children: ReactNode; empty: boolean }) {
  const { isOver, setNodeRef } = useDroppable({ id: CANVAS_ID });
  return <div ref={setNodeRef} className={`relative mx-auto max-w-[410px] overflow-hidden rounded-[30px] border-[7px] bg-[#f8f6f2] shadow-xl transition-colors ${isOver ? "border-[#176b45]" : "border-[#252525]"}`}>
    <div className="bg-[#252525] py-2 text-center text-xs text-white">移动端编辑画布</div>
    <div className="relative h-[700px] overflow-y-auto">
      {empty && <div className="pointer-events-none absolute inset-x-5 top-24 z-10 rounded-xl border-2 border-dashed border-[#aab9af] bg-white/90 p-8 text-center text-sm text-[#69736c]">从左侧拖入组件</div>}
      {children}
    </div>
  </div>;
}

export function PageEditor({ page, publicUrl, store, employee, products, categories }: Props) {
  const [components, setComponents] = useState(page.config.components);
  const [themeColor, setThemeColor] = useState(page.config.themeColor);
  const [selectedId, setSelectedId] = useState(page.config.components[0]?.id ?? "");
  const [activeLabel, setActiveLabel] = useState("");
  const selected = components.find((item) => item.id === selectedId);
  const config = useMemo(() => JSON.stringify({ version: 3, themeColor, components }), [components, themeColor]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const update = (patch: Partial<PageComponentV2>) => setComponents((items) => items.map((item) => item.id === selectedId ? { ...item, ...patch } as PageComponentV2 : item));
  function add(type: PageComponentV2["type"]) {
    const component = makeComponent(type, products);
    setComponents((items) => insertPageComponent(items, component));
    setSelectedId(component.id);
  }
  function remove(id: string) {
    const result = removePageComponent(components, id, selectedId);
    setComponents(result.components);
    setSelectedId(result.selectedId);
  }
  function dragStart(event: DragStartEvent) {
    const data = event.active.data.current as DragData | undefined;
    setActiveLabel(data?.kind === "palette" ? labels[data.type] : labels[components.find((item) => item.id === event.active.id)?.type ?? "divider"]);
  }
  function dragEnd(event: DragEndEvent) {
    setActiveLabel("");
    const { active, over } = event;
    if (!over) return;
    const data = active.data.current as DragData | undefined;
    const overId = String(over.id);
    if (data?.kind === "palette") {
      if (overId !== CANVAS_ID && !components.some((item) => item.id === overId)) return;
      const component = makeComponent(data.type, products);
      if (overId === CANVAS_ID) {
        setComponents((items) => insertPageComponent(items, component));
      } else {
        const translated = active.rect.current.translated;
        const position = translated && translated.top + translated.height / 2 > over.rect.top + over.rect.height / 2 ? "after" : "before";
        setComponents((items) => insertPageComponent(items, component, overId, position));
      }
      setSelectedId(component.id);
      return;
    }
    if (data?.kind === "component") {
      setComponents((items) => movePageComponent(items, String(active.id), overId === CANVAS_ID ? undefined : overId));
      setSelectedId(String(active.id));
    }
  }

  const textField = (label: string, value: string, onChange: (value: string) => void, multiline = false) => <label className="label">{label}{multiline ? <textarea className="field min-h-24" value={value} onChange={(event) => onChange(event.target.value)}/> : <input className="field" value={value} onChange={(event) => onChange(event.target.value)}/>}</label>;
  function Properties() {
    if (!selected) return <div className="empty">选择画布中的组件后配置</div>;
    const selectedProductIds = selected.type === "productGrid" && selected.source.mode === "selected" ? selected.source.productIds : [];
    return <div className="grid gap-4"><div><span className="badge">{labels[selected.type]}</span><p className="muted mt-2 text-xs">组件身份数据由当前店铺与分享员工动态绑定。</p></div><label className="label">页面主题色<input type="color" className="h-10 w-full" value={themeColor} onChange={(event) => setThemeColor(event.target.value)}/></label>
      {selected.type === "heroCarousel" && <>{textField("轮播内容（每行：标题|副标题|图片地址|链接）", selected.slides.map((slide) => [slide.title,slide.subtitle,slide.imageUrl ?? "",slide.href].join("|")).join("\n"), (value) => update({ slides:value.split(/\r?\n/).filter(Boolean).slice(0,8).map((line) => { const [title="",subtitle="",imageUrl="",href=""] = line.split("|"); return {title,subtitle,imageUrl,href}; }) }), true)}</>}
      {selected.type === "quickNav" && textField("快捷入口（每行：标题|图片地址|链接）", selected.items.map((item) => [item.title,item.imageUrl ?? "",item.href].join("|")).join("\n"), (value) => update({ items:value.split(/\r?\n/).filter(Boolean).slice(0,8).map((line) => { const [title="",imageUrl="",href=""] = line.split("|"); return {title,imageUrl,href}; }) }), true)}
      {selected.type === "announcement" && textField("公告（每行一条）", selected.messages.join("\n"), (value) => update({ messages:value.split(/\r?\n/).filter(Boolean).slice(0,10) }), true)}
      {selected.type === "seriesShowcase" && <>{textField("标题",selected.title,(value)=>update({title:value}))}<fieldset className="grid gap-2"><legend className="mb-2 text-sm font-semibold">展示分类（不选则自动取前两个）</legend>{categories.map((category)=><label className="flex items-center gap-2 text-sm" key={category.id}><input type="checkbox" checked={selected.categoryIds.includes(category.id)} onChange={(event)=>update({categoryIds:event.target.checked?[...selected.categoryIds,category.id]:selected.categoryIds.filter((id)=>id!==category.id)})}/>{category.name}</label>)}</fieldset></>}
      {selected.type === "newProducts" && <>{textField("标题",selected.title,(value)=>update({title:value}))}<label className="label">商品来源<select className="field" value={selected.source.mode} onChange={(event)=>{const mode=event.target.value;if(mode==="all")update({source:{mode}});if(mode==="category")update({source:{mode,categoryId:categories[0]?.id??""}});if(mode==="selected")update({source:{mode,productIds:[]}})}}><option value="all">全部商品</option><option value="category">指定分类</option><option value="selected">指定商品</option></select></label>{selected.source.mode==="category"&&<label className="label">分类<select className="field" value={selected.source.categoryId} onChange={(event)=>update({source:{mode:"category",categoryId:event.target.value}})}>{categories.map((category)=><option value={category.id} key={category.id}>{category.name}</option>)}</select></label>}{selected.source.mode==="selected"&&<fieldset className="grid gap-2">{products.map((product)=><label className="flex items-center gap-2 text-sm" key={product.id}><input type="checkbox" checked={selected.source.mode==="selected"&&selected.source.productIds.includes(product.id)} onChange={(event)=>{const ids=selected.source.mode==="selected"?selected.source.productIds:[];update({source:{mode:"selected",productIds:event.target.checked?[...ids,product.id]:ids.filter((id)=>id!==product.id)}})}}/>{product.name}</label>)}</fieldset>}</>}
      {selected.type === "storeHeader" && <>{textField("副标题", selected.subtitle, (value) => update({ subtitle: value }))}<label className="label">样式<select className="field" value={selected.style} onChange={(event) => update({ style: event.target.value as "compact" | "hero" })}><option value="compact">紧凑</option><option value="hero">品牌展示</option></select></label></>}
      {selected.type === "employeeCard" && <label className="label">样式<select className="field" value={selected.style} onChange={(event) => update({ style: event.target.value as "dark" | "light" })}><option value="dark">深色</option><option value="light">浅色</option></select></label>}
      {selected.type === "text" && <>{textField("标题", selected.title, (value) => update({ title: value }))}{textField("正文", selected.body, (value) => update({ body: value }), true)}</>}
      {selected.type === "richText" && textField("安全富文本（HTML）", selected.html, (value) => update({ html: value }), true)}
      {selected.type === "image" && <><label className="label">选择店铺素材<select className="field" value="" onChange={(event) => event.target.value && update({ url: event.target.value })}><option value="">选择 Logo 或商品图片</option>{store.logoUrl && <option value={store.logoUrl}>店铺 Logo</option>}{products.map((product) => <option key={product.id} value={product.mainImageUrl}>{product.name}</option>)}</select></label>{textField("图片 HTTP(S) 地址", selected.url, (value) => update({ url: value }))}{textField("替代文字", selected.alt, (value) => update({ alt: value }))}{textField("点击链接（可空）", selected.link ?? "", (value) => update({ link: value || undefined }))}</>}
      {selected.type === "productSearch" && textField("提示文字", selected.placeholder, (value) => update({ placeholder: value }))}
      {selected.type === "categoryNav" && textField("标题", selected.title, (value) => update({ title: value }))}
      {selected.type === "productGrid" && <>{textField("标题", selected.title, (value) => update({ title: value }))}<label className="label">商品来源<select className="field" value={selected.source.mode} onChange={(event) => { const mode = event.target.value; if (mode === "all") update({ source: { mode } }); if (mode === "category") update({ source: { mode, categoryId: categories[0]?.id ?? "" } }); if (mode === "selected") update({ source: { mode, productIds: [] } }); }}><option value="all">全部商品</option><option value="category">指定分类</option><option value="selected">指定商品</option></select></label>{selected.source.mode === "category" && <label className="label">分类<select className="field" value={selected.source.categoryId} onChange={(event) => update({ source: { mode: "category", categoryId: event.target.value } })}>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>}{selected.source.mode === "selected" && <fieldset className="grid gap-2"><legend className="mb-2 text-sm font-semibold">选择商品</legend>{products.map((product) => <label className="flex items-center gap-2 text-sm" key={product.id}><input type="checkbox" checked={selectedProductIds.includes(product.id)} onChange={(event) => update({ source: { mode: "selected", productIds: event.target.checked ? [...selectedProductIds, product.id] : selectedProductIds.filter((id) => id !== product.id) } })}/>{product.name}</label>)}</fieldset>}</>}
      {selected.type === "contentCard" && <>{textField("标题", selected.title, (value) => update({ title: value }))}{textField("正文", selected.body, (value) => update({ body: value }), true)}{textField("图片地址（可空）", selected.imageUrl ?? "", (value) => update({ imageUrl: value || undefined }))}</>}
      {selected.type === "video" && <>{textField("视频地址", selected.url, (value) => update({ url: value }))}{textField("封面地址（可空）", selected.poster ?? "", (value) => update({ poster: value || undefined }))}</>}
      {selected.type === "divider" && <p className="muted text-sm">分隔线无需额外配置。</p>}
    </div>;
  }

  return <><div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><Link className="muted text-sm" href="/admin/pages">← 页面列表</Link><h1 className="page-title mt-2">装修：{page.title}</h1><p className="muted mt-1 text-sm">{page.published ? page.isHome ? "已发布 · 当前主页" : "已发布" : "草稿"}</p></div><div className="actions"><form action={savePageDraft}><input type="hidden" name="id" value={page.id}/><input type="hidden" name="config" value={config}/><button className="btn">保存草稿</button></form><form action={publishPage}><input type="hidden" name="id" value={page.id}/><input type="hidden" name="config" value={config}/><input type="hidden" name="makeHome" value="false"/><button className="btn btn-primary">发布当前版本</button></form>{!page.isHome && <form action={publishPage}><input type="hidden" name="id" value={page.id}/><input type="hidden" name="config" value={config}/><input type="hidden" name="makeHome" value="true"/><button className="btn">发布并设主页</button></form>}{page.published && <a className="btn" target="_blank" href={publicUrl}>查看线上页</a>}</div></div>
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={dragStart} onDragCancel={() => setActiveLabel("")} onDragEnd={dragEnd}>
      <div className="grid items-start gap-5 xl:grid-cols-[200px_410px_minmax(280px,1fr)] 2xl:grid-cols-[220px_430px_minmax(320px,1fr)]">
        <aside className="panel p-4 xl:sticky xl:top-5"><h2 className="font-bold">组件</h2><p className="muted mb-3 mt-1 text-xs">点击追加，或拖入中间画布</p><div className="grid gap-2">{types.map((type) => <PaletteItem key={type} type={type} onAdd={() => add(type)}/>)}</div></aside>
        <section><div className="mb-3 flex items-center justify-between"><div><h2 className="font-bold">页面画布</h2><p className="muted mt-1 text-xs">拖动组件调整页面顺序</p></div><span className="badge">{components.length} 个组件</span></div>
          <PhoneCanvas empty={!components.length}><SortableContext items={components.map((item) => item.id)} strategy={verticalListSortingStrategy}><Storefront store={store} categories={categories} products={products} employee={employee} pageConfig={{ version: 3, themeColor, components }} pageSlug={page.slug} customerActive={false} favoriteIds={[]} preview editor={{ renderComponent: (component, content) => <SortableCanvasItem key={component.id} component={component} selected={selectedId === component.id} onSelect={() => setSelectedId(component.id)} onRemove={() => remove(component.id)}>{content}</SortableCanvasItem> }}/></SortableContext></PhoneCanvas>
        </section>
        <aside className="panel p-4 xl:sticky xl:top-5"><h2 className="mb-4 font-bold">属性</h2><Properties/></aside>
      </div>
      <DragOverlay>{activeLabel && <div className="rounded border border-[#176b45] bg-white px-4 py-3 text-sm font-bold text-[#176b45] shadow-xl"><GripVertical className="mr-2 inline" size={16}/>{activeLabel}</div>}</DragOverlay>
    </DndContext>
  </>;
}
