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
import { ChevronDown, ChevronUp, GripVertical, ImagePlus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { PublicHome, type Employee, type HomeProduct } from "@/app/s/[slug]/public-home";
import { PublicCartProvider } from "@/components/public/cart-provider";
import {
  insertPageComponent,
  movePageComponent,
  removePageComponent,
} from "@/lib/page-editor-state";
import type { PageComponentV2, PageConfigV2 } from "@/lib/page-config";
import { applyLiangchenHomeTemplate, publishPage, savePageDraft } from "../../phase-one-actions";

const CANVAS_ID = "page-editor-canvas";
const labels: Record<PageComponentV2["type"], string> = {
  heroCarousel: "首屏轮播",
  quickNav: "快捷导航",
  announcement: "动态公告",
  seriesShowcase: "系列展示",
  newProducts: "新品轮播",
  storeHeader: "店铺头部",
  employeeCard: "员工名片",
  imageAd: "图片广告",
  productGroupTabs: "商品分组",
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

type Category = { id: string; name: string; parentId: string | null; productCount: number; createdAt: string };
type PageLink = { id: string; title: string; slug: string; published: boolean };
type Props = {
  page: { id: string; title: string; slug: string; config: PageConfigV2; published: boolean; isHome: boolean };
  publicUrl: string;
  store: { slug: string; name: string; logoUrl: string | null; phone: string; address: string };
  employee: Employee;
  products: HomeProduct[];
  categories: Category[];
  pages: PageLink[];
};
type DragData = { kind: "palette"; type: PageComponentV2["type"] } | { kind: "component" };
type ImageAdItem = Extract<PageComponentV2, { type: "imageAd" }>["items"][number];
type HeroSlide = Extract<PageComponentV2, { type: "heroCarousel" }>["slides"][number];

function categoryTree(categories: Category[], query: string) {
  const byParent = new Map<string | null, Category[]>();
  for (const category of categories) byParent.set(category.parentId, [...(byParent.get(category.parentId) ?? []), category]);
  const needle = query.toLowerCase();
  return (byParent.get(null) ?? []).filter((root) => !needle || root.name.toLowerCase().includes(needle) || (byParent.get(root.id) ?? []).some((child) => child.name.toLowerCase().includes(needle))).map((root) => ({ root, children: (byParent.get(root.id) ?? []).filter((child) => !needle || root.name.toLowerCase().includes(needle) || child.name.toLowerCase().includes(needle)) }));
}

function ActionSubmitButton({ children, pendingLabel, className }: { children: ReactNode; pendingLabel: string; className: string }) {
  const { pending } = useFormStatus();
  return <button className={className} disabled={pending}>{pending ? pendingLabel : children}</button>;
}

function makeComponent(
  type: PageComponentV2["type"],
): PageComponentV2 {
  const id = crypto.randomUUID();
  switch (type) {
    case "heroCarousel": return { id, type, slides: [] };
    case "quickNav": return { id, type, items: [] };
    case "announcement": return { id, type, messages: ["欢迎来到线上展厅"] };
    case "seriesShowcase": return { id, type, title: "探索系列", categoryIds: [] };
    case "newProducts": return { id, type, title: "当季新品", source: { mode: "all" } };
    case "storeHeader": return { id, type, style: "compact", subtitle: "家居美学 · 意向开单" };
    case "employeeCard": return { id, type, style: "yuncheng" };
    case "imageAd": return { id, type, title: "", subtitle: "", layout: "stack", items: [] };
    case "productGroupTabs": return { id, type, title: "精选商品", groups: [] };
    case "text": return { id, type, title: "品牌标题", body: "介绍您的空间与服务" };
    case "richText": return { id, type, html: "<p>富文本内容</p>" };
    case "productSearch": return { id, type, placeholder: "搜索商品", style: "default" };
    case "categoryNav": return { id, type, title: "商品分类" };
    case "productGrid": return { id, type, title: "精选商品", subtitle: "", layout: "default", limit: null, source: { mode: "all" } };
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

export function PageEditor({ page, publicUrl, store, employee, products, categories, pages }: Props) {
  const [components, setComponents] = useState(page.config.components);
  const [themeColor, setThemeColor] = useState(page.config.themeColor);
  const [selectedId, setSelectedId] = useState(page.config.components[0]?.id ?? "");
  const [activeLabel, setActiveLabel] = useState("");
  const [groupSearch, setGroupSearch] = useState("");
  const [groupPage, setGroupPage] = useState(0);
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const selected = components.find((item) => item.id === selectedId);
  const selectedGroups = selected?.type === "productGroupTabs" ? selected.groups : [];
  const config = useMemo(() => JSON.stringify({ version: 4, themeColor, components }), [components, themeColor]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const update = (patch: Record<string, unknown>) => setComponents((items) => items.map((item) => item.id === selectedId ? { ...item, ...patch } as PageComponentV2 : item));
  const updateImageAdItem = (entryId: string, transform: (entry: ImageAdItem) => ImageAdItem) => setComponents((items) => items.map((item) => item.id === selectedId && item.type === "imageAd" ? { ...item, items: item.items.map((entry) => entry.id === entryId ? transform(entry) : entry) } : item));
  async function uploadAdImage(file: File | undefined, itemId?: string) {
    if (!file || !selected || selected.type !== "imageAd") return;
    setUploading(true);
    const body = new FormData(); body.set("pageId", page.id); body.set("file", file);
    const response = await fetch("/api/page-assets", { method: "POST", body });
    const result = await response.json();
    setUploading(false);
    if (!response.ok) { alert(result.error ?? "图片上传失败"); return; }
    const items = itemId ? selected.items.map((item) => item.id === itemId ? { ...item, imageUrl: result.url } : item) : [...selected.items, { id: crypto.randomUUID(), imageUrl: result.url, alt: "" }];
    update({ items });
  }
  async function uploadHeroImage(file: File | undefined, index?: number) {
    if (!file || !selected || selected.type !== "heroCarousel") return;
    setUploading(true);
    const body = new FormData(); body.set("pageId", page.id); body.set("file", file);
    const response = await fetch("/api/page-assets", { method: "POST", body });
    const result = await response.json();
    setUploading(false);
    if (!response.ok) { alert(result.error ?? "图片上传失败"); return; }
    const slides: HeroSlide[] = index === undefined
      ? [...selected.slides, { imageUrl: result.url, alt: "" }]
      : selected.slides.map((slide, at) => at === index ? { ...slide, imageUrl: result.url } : slide);
    update({ slides });
  }
  function add(type: PageComponentV2["type"]) {
    const component = makeComponent(type);
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
      const component = makeComponent(data.type);
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
  const matchingCategories = categoryTree(categories, groupSearch);
  const categoryPage = matchingCategories.flatMap(({ root, children }) => [root, ...children]).slice(groupPage * 6, groupPage * 6 + 6);
  function Properties() {
    if (showGroupPicker && selected?.type === "productGroupTabs") return <div className="grid gap-3"><div className="flex items-center justify-between"><strong>选择商品分组</strong><button type="button" aria-label="关闭" onClick={()=>setShowGroupPicker(false)}><X size={18}/></button></div><input className="field" placeholder="搜索分组" value={groupSearch} onChange={(event)=>{setGroupSearch(event.target.value);setGroupPage(0)}}/><div className="overflow-x-auto"><table><thead><tr><th>选择</th><th>分组</th><th>商品</th><th>创建</th></tr></thead><tbody>{categoryPage.map((category)=>{const checked=selectedGroups.some((item)=>item.categoryId===category.id);return <tr key={category.id}><td><input type="checkbox" checked={checked} disabled={!checked&&selectedGroups.length>=15} onChange={(event)=>update({groups:event.target.checked?[...selectedGroups,{categoryId:category.id,limit:null}]:selectedGroups.filter((item)=>item.categoryId!==category.id)})}/></td><td>{category.name}</td><td>{category.productCount}</td><td>{new Date(category.createdAt).toLocaleDateString("zh-CN")}</td></tr>})}</tbody></table></div><div className="flex justify-between"><button className="btn" type="button" disabled={!groupPage} onClick={()=>setGroupPage((value)=>value-1)}>上一页</button><button className="btn" type="button" disabled={(groupPage+1)*6>=matchingCategories.length} onClick={()=>setGroupPage((value)=>value+1)}>下一页</button></div><div className="flex justify-end gap-2"><button className="btn" type="button" onClick={()=>setShowGroupPicker(false)}>取消</button><button className="btn btn-primary" type="button" onClick={()=>setShowGroupPicker(false)}>确认</button></div></div>;
    if (!selected) return <div className="empty">选择画布中的组件后配置</div>;
    const selectedProductIds = selected.type === "productGrid" && selected.source.mode === "selected" ? selected.source.productIds : [];
    return <div className="grid gap-4"><div><span className="badge">{labels[selected.type]}</span><p className="muted mt-2 text-xs">组件身份数据由当前店铺与分享员工动态绑定。</p></div><label className="label">页面主题色<input type="color" className="h-10 w-full" value={themeColor} onChange={(event) => setThemeColor(event.target.value)}/></label>
      {selected.type === "heroCarousel" && <div className="grid gap-3">
        <p className="muted text-xs">最多 8 张，仅支持 JPG、PNG、WebP，单张不超过 5 MB。轮播只展示图片和分页控件。</p>
        <label className="btn cursor-pointer"><ImagePlus size={16}/>{uploading ? "上传中…" : "添加图片"}<input className="hidden" type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading || selected.slides.length >= 8} onChange={(event)=>void uploadHeroImage(event.target.files?.[0])}/></label>
        {selected.slides.map((slide,index)=><article className="flex items-center gap-3 rounded border border-[#d6ddd8] p-3" draggable onDragStart={(event)=>event.dataTransfer.setData("text/plain",String(index))} onDragOver={(event)=>event.preventDefault()} onDrop={(event)=>{const from=Number(event.dataTransfer.getData("text/plain"));const slides=[...selected.slides];const [moved]=slides.splice(from,1);slides.splice(index,0,moved);update({slides})}} key={`${slide.imageUrl}-${index}`}><GripVertical size={16}/><img className="h-16 w-24 rounded object-cover" src={slide.imageUrl} alt=""/><div className="ml-auto flex gap-2"><label className="btn cursor-pointer">替换<input className="hidden" type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={(event)=>void uploadHeroImage(event.target.files?.[0],index)}/></label><button className="btn btn-danger" type="button" aria-label={`删除第 ${index+1} 张`} onClick={()=>update({slides:selected.slides.filter((_,at)=>at!==index)})}><Trash2 size={15}/></button></div></article>)}
      </div>}
      {selected.type === "quickNav" && <>{textField("快捷入口（每行：标题|图标|页面ID或链接）", selected.items.map((item) => [item.title,item.icon ?? "building",item.pageId ?? item.href].join("|")).join("\n"), (value) => update({ items:value.split(/\r?\n/).filter(Boolean).slice(0,5).map((line) => { const [title="",icon="building",target=""] = line.split("|"); const page=pages.find((item)=>item.id===target); return {title,icon,pageId:page?.id,href:page?"":target}; }) }), true)}<p className="muted text-xs">图标：building / sofa / images / shield / phone。页面目标可从下方复制 ID。</p><div className="grid gap-1 text-xs">{pages.map((target)=><div key={target.id}><code>{target.id}</code> · {target.title}（{target.published?"已发布":"草稿"}）</div>)}</div></>}
      {selected.type === "announcement" && textField("公告（每行一条）", selected.messages.join("\n"), (value) => update({ messages:value.split(/\r?\n/).filter(Boolean).slice(0,10) }), true)}
      {selected.type === "seriesShowcase" && <>{textField("标题",selected.title,(value)=>update({title:value}))}<fieldset className="grid gap-2"><legend className="mb-2 text-sm font-semibold">展示分类（不选则自动取前两个）</legend>{categories.map((category)=><label className="flex items-center gap-2 text-sm" key={category.id}><input type="checkbox" checked={selected.categoryIds.includes(category.id)} onChange={(event)=>update({categoryIds:event.target.checked?[...selected.categoryIds,category.id]:selected.categoryIds.filter((id)=>id!==category.id)})}/>{category.name}</label>)}</fieldset></>}
      {selected.type === "newProducts" && <>{textField("标题",selected.title,(value)=>update({title:value}))}<label className="label">商品来源<select className="field" value={selected.source.mode} onChange={(event)=>{const mode=event.target.value;if(mode==="all")update({source:{mode}});if(mode==="category")update({source:{mode,categoryId:categories[0]?.id??""}});if(mode==="selected")update({source:{mode,productIds:[]}})}}><option value="all">全部商品</option><option value="category">指定分类</option><option value="selected">指定商品</option></select></label>{selected.source.mode==="category"&&<label className="label">分类<select className="field" value={selected.source.categoryId} onChange={(event)=>update({source:{mode:"category",categoryId:event.target.value}})}>{categories.map((category)=><option value={category.id} key={category.id}>{category.name}</option>)}</select></label>}{selected.source.mode==="selected"&&<fieldset className="grid gap-2">{products.map((product)=><label className="flex items-center gap-2 text-sm" key={product.id}><input type="checkbox" checked={selected.source.mode==="selected"&&selected.source.productIds.includes(product.id)} onChange={(event)=>{const ids=selected.source.mode==="selected"?selected.source.productIds:[];update({source:{mode:"selected",productIds:event.target.checked?[...ids,product.id]:ids.filter((id)=>id!==product.id)}})}}/>{product.name}</label>)}</fieldset>}</>}
      {selected.type === "storeHeader" && <>{textField("店铺名称", selected.name ?? store.name, (value) => update({ name: value.trim() || undefined }))}<label className="label">店铺图片<select className="field" value={selected.imageSource?.type === "productMainImage" ? selected.imageSource.productId : "storeLogo"} onChange={(event) => update({ imageSource: event.target.value === "storeLogo" ? { type: "storeLogo" } : { type: "productMainImage", productId: event.target.value } })}><option value="storeLogo">使用店铺 Logo</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}（商品主图）</option>)}</select></label>{textField("副标题", selected.subtitle, (value) => update({ subtitle: value }))}<label className="label">样式<select className="field" value={selected.style} onChange={(event) => update({ style: event.target.value as "compact" | "hero" })}><option value="compact">紧凑</option><option value="hero">品牌展示</option></select></label></>}
      {selected.type === "employeeCard" && <label className="label">样式<select className="field" value={selected.style} onChange={(event) => update({ style: event.target.value as "dark" | "light" | "yuncheng" })}><option value="yuncheng">云橙名片</option><option value="dark">深色</option><option value="light">浅色</option></select></label>}
      {selected.type === "text" && <>{textField("标题", selected.title, (value) => update({ title: value }))}{textField("正文", selected.body, (value) => update({ body: value }), true)}</>}
      {selected.type === "richText" && textField("安全富文本（HTML）", selected.html, (value) => update({ html: value }), true)}
      {selected.type === "imageAd" && <div className="grid gap-3">
        {textField("章节标题",selected.title,(value)=>update({title:value}))}{textField("章节副标题",selected.subtitle,(value)=>update({subtitle:value}))}
        <label className="label">布局<select className="field" value={selected.layout} onChange={(event)=>update({layout:event.target.value})}><option value="stack">纵向堆叠</option><option value="carousel">横向轮播</option></select></label>
        <label className="btn cursor-pointer"><ImagePlus size={16}/>{uploading ? "上传中…" : "添加图片"}<input className="hidden" type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading || selected.items.length >= 10} onChange={(event) => void uploadAdImage(event.target.files?.[0])}/></label>
        {selected.items.map((entry, index) => <article className="rounded border border-[#d6ddd8] p-3" draggable onDragStart={(event) => event.dataTransfer.setData("text/plain", String(index))} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const from = Number(event.dataTransfer.getData("text/plain")); const items = [...selected.items]; const [moved] = items.splice(from, 1); items.splice(index, 0, moved); update({ items }); }} key={entry.id}>
          <div className="flex gap-3"><img className="size-16 rounded object-cover" src={entry.imageUrl} alt=""/><div className="grid flex-1 gap-2"><input className="field" value={entry.title} maxLength={100} placeholder="图片标题" onChange={(event)=>updateImageAdItem(entry.id,(item)=>({...item,title:event.target.value}))}/><input className="field" value={entry.subtitle} maxLength={160} placeholder="图片副标题" onChange={(event)=>updateImageAdItem(entry.id,(item)=>({...item,subtitle:event.target.value}))}/><input className="field" value={entry.alt} maxLength={100} placeholder="无障碍提示文字" onChange={(event)=>updateImageAdItem(entry.id,(item)=>({...item,alt:event.target.value}))}/></div></div>
          <select className="field mt-2" value={entry.target?.type ?? "none"} onChange={(event) => { const type=event.target.value; const target=type==="product"?{type,productId:products[0]?.id??""}:type==="category"?{type,categoryId:categories[0]?.id??""}:type==="productGroup"?{type,title:entry.title,groups:categories[0]?[{categoryId:categories[0].id,limit:null}]:[]}:type==="page"?{type,pageId:pages[0]?.id??""}:type==="custom"?{type,url:"/"}:undefined; updateImageAdItem(entry.id,(item)=>({...item,target} as ImageAdItem)); }}><option value="none">不跳转</option><option value="product">商品</option><option value="category">单个分类</option><option value="productGroup">商品分组</option><option value="page">店铺页面</option><option value="custom">自定义链接</option></select>
          {entry.target?.type==="product"&&<select className="field mt-2" value={entry.target.productId} onChange={(event)=>updateImageAdItem(entry.id,(item)=>({...item,target:{type:"product",productId:event.target.value}}))}>{products.map((product)=><option value={product.id} key={product.id}>{product.name}</option>)}</select>}
          {entry.target?.type==="category"&&<select className="field mt-2" value={entry.target.categoryId} onChange={(event)=>updateImageAdItem(entry.id,(item)=>({...item,target:{type:"category",categoryId:event.target.value}}))}>{categories.map((category)=><option value={category.id} key={category.id}>{category.name}</option>)}</select>}
          {entry.target?.type==="page"&&<select className="field mt-2" value={entry.target.pageId} onChange={(event)=>updateImageAdItem(entry.id,(item)=>({...item,target:{type:"page",pageId:event.target.value}}))}>{pages.map((link)=><option value={link.id} key={link.id}>{link.title}（{link.published?"已发布":"草稿"}）</option>)}</select>}
          {entry.target?.type==="custom"&&<input className="field mt-2" value={entry.target.url} placeholder="/s/... 或 https://..." onChange={(event)=>updateImageAdItem(entry.id,(item)=>({...item,target:{type:"custom",url:event.target.value}}))}/>}
          {entry.target?.type==="productGroup"&&<div className="mt-3 grid gap-2"><input className="field" value={entry.target.title??""} placeholder="分组页标题" onChange={(event)=>updateImageAdItem(entry.id,(item)=>item.target?.type==="productGroup"?{...item,target:{...item.target,title:event.target.value}}:item)}/>{categories.map((category)=>{if(entry.target?.type!=="productGroup")return null;const target=entry.target;const group=target.groups.find((item)=>item.categoryId===category.id);return <div className="rounded bg-[#f5f6f5] p-2" key={category.id}><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(group)} disabled={!group&&target.groups.length>=15} onChange={(event)=>updateImageAdItem(entry.id,(item)=>item.target?.type==="productGroup"?{...item,target:{...item.target,groups:event.target.checked?[...item.target.groups,{categoryId:category.id,limit:null}]:item.target.groups.filter((value)=>value.categoryId!==category.id)}}:item)}/>{category.name}</label>{group&&<div className="mt-2 grid grid-cols-2 gap-2"><input className="field" value={group.alias??""} placeholder="别名" onChange={(event)=>updateImageAdItem(entry.id,(item)=>item.target?.type==="productGroup"?{...item,target:{...item.target,groups:item.target.groups.map((value)=>value.categoryId===category.id?{...value,alias:event.target.value||undefined}:value)}}:item)}/><input className="field" type="number" min="1" max="50" value={group.limit??""} placeholder="全部" onChange={(event)=>updateImageAdItem(entry.id,(item)=>item.target?.type==="productGroup"?{...item,target:{...item.target,groups:item.target.groups.map((value)=>value.categoryId===category.id?{...value,limit:event.target.value?Number(event.target.value):null}:value)}}:item)}/><div className="col-span-2 flex justify-end gap-2"><button type="button" aria-label="上移" disabled={!target.groups.findIndex((value)=>value.categoryId===category.id)} onClick={()=>updateImageAdItem(entry.id,(item)=>{if(item.target?.type!=="productGroup")return item;const groups=[...item.target.groups];const at=groups.findIndex((value)=>value.categoryId===category.id);[groups[at-1],groups[at]]=[groups[at],groups[at-1]];return {...item,target:{...item.target,groups}}})}><ChevronUp size={15}/></button><button type="button" aria-label="下移" disabled={target.groups.findIndex((value)=>value.categoryId===category.id)===target.groups.length-1} onClick={()=>updateImageAdItem(entry.id,(item)=>{if(item.target?.type!=="productGroup")return item;const groups=[...item.target.groups];const at=groups.findIndex((value)=>value.categoryId===category.id);[groups[at],groups[at+1]]=[groups[at+1],groups[at]];return {...item,target:{...item.target,groups}}})}><ChevronDown size={15}/></button></div></div>}</div>})}</div>}
          <div className="mt-2 flex justify-end gap-2"><label className="btn cursor-pointer">替换<input className="hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event)=>void uploadAdImage(event.target.files?.[0],entry.id)}/></label><button className="btn btn-danger" type="button" onClick={()=>update({items:selected.items.filter((item)=>item.id!==entry.id)})}><Trash2 size={15}/></button></div>
        </article>)}
      </div>}
      {selected.type === "productGroupTabs" && <div className="grid gap-3">{textField("章节标题",selected.title,(value)=>update({title:value}))}<button className="btn" type="button" onClick={()=>setShowGroupPicker(true)}>选择商品分组（{selected.groups.length}/15）</button>{selected.groups.map((group,index)=><article className="rounded border border-[#d6ddd8] p-3" draggable onDragStart={(event)=>event.dataTransfer.setData("text/plain",String(index))} onDragOver={(event)=>event.preventDefault()} onDrop={(event)=>{const from=Number(event.dataTransfer.getData("text/plain"));const groups=[...selected.groups];const [moved]=groups.splice(from,1);groups.splice(index,0,moved);update({groups});}} key={group.categoryId}><div className="flex items-center gap-2"><GripVertical size={16}/><strong className="flex-1 text-sm">{categories.find((item)=>item.id===group.categoryId)?.name??"已失效分组"}</strong><button type="button" onClick={()=>{const groups=[...selected.groups];[groups[index-1],groups[index]]=[groups[index],groups[index-1]];update({groups})}} disabled={!index}><ChevronUp size={15}/></button><button type="button" onClick={()=>{const groups=[...selected.groups];[groups[index],groups[index+1]]=[groups[index+1],groups[index]];update({groups})}} disabled={index===selected.groups.length-1}><ChevronDown size={15}/></button><button type="button" onClick={()=>update({groups:selected.groups.filter((item)=>item.categoryId!==group.categoryId)})}><Trash2 size={15}/></button></div><input className="field mt-2" placeholder="菜单别名（可空）" value={group.alias??""} onChange={(event)=>update({groups:selected.groups.map((item)=>item.categoryId===group.categoryId?{...item,alias:event.target.value||undefined}:item)})}/><select className="field mt-2" value={group.limit??"all"} onChange={(event)=>update({groups:selected.groups.map((item)=>item.categoryId===group.categoryId?{...item,limit:event.target.value==="all"?null:Number(event.target.value)}:item)})}><option value="all">全部</option>{[6,8,10,12,16,20,30,50].map((value)=><option value={value} key={value}>{value} 个</option>)}</select></article>)}</div>}
      {selected.type === "productSearch" && <>{textField("提示文字", selected.placeholder, (value) => update({ placeholder: value }))}<label className="label">样式<select className="field" value={selected.style} onChange={(event)=>update({style:event.target.value})}><option value="default">普通搜索</option><option value="heroOverlay">首屏悬浮</option></select></label></>}
      {selected.type === "categoryNav" && textField("标题", selected.title, (value) => update({ title: value }))}
      {selected.type === "productGrid" && <>{textField("标题", selected.title, (value) => update({ title: value }))}{textField("副标题", selected.subtitle, (value) => update({ subtitle: value }))}<label className="label">布局<select className="field" value={selected.layout} onChange={(event)=>update({layout:event.target.value})}><option value="default">标准商品卡</option><option value="yuncheng">云橙三列图片</option></select></label><label className="label">最多展示<input className="field" type="number" min="1" max="50" value={selected.limit??""} placeholder="全部" onChange={(event)=>update({limit:event.target.value?Number(event.target.value):null})}/></label><label className="label">商品来源<select className="field" value={selected.source.mode} onChange={(event) => { const mode = event.target.value; if (mode === "all") update({ source: { mode } }); if (mode === "category") update({ source: { mode, categoryId: categories[0]?.id ?? "" } }); if (mode === "selected") update({ source: { mode, productIds: [] } }); }}><option value="all">全部商品</option><option value="category">指定分类</option><option value="selected">指定商品</option></select></label>{selected.source.mode === "category" && <label className="label">分类<select className="field" value={selected.source.categoryId} onChange={(event) => update({ source: { mode: "category", categoryId: event.target.value } })}>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>}{selected.source.mode === "selected" && <fieldset className="grid gap-2"><legend className="mb-2 text-sm font-semibold">选择商品</legend>{products.map((product) => <label className="flex items-center gap-2 text-sm" key={product.id}><input type="checkbox" checked={selectedProductIds.includes(product.id)} onChange={(event) => update({ source: { mode: "selected", productIds: event.target.checked ? [...selectedProductIds, product.id] : selectedProductIds.filter((id) => id !== product.id) } })}/>{product.name}</label>)}</fieldset>}</>}
      {selected.type === "contentCard" && <>{textField("标题", selected.title, (value) => update({ title: value }))}{textField("正文", selected.body, (value) => update({ body: value }), true)}{textField("图片地址（可空）", selected.imageUrl ?? "", (value) => update({ imageUrl: value || undefined }))}</>}
      {selected.type === "video" && <>{textField("视频地址", selected.url, (value) => update({ url: value }))}{textField("封面地址（可空）", selected.poster ?? "", (value) => update({ poster: value || undefined }))}</>}
      {selected.type === "divider" && <p className="muted text-sm">分隔线无需额外配置。</p>}
    </div>;
  }

  return <><div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><Link className="muted text-sm" href="/admin/pages">← 页面列表</Link><h1 className="page-title mt-2">装修：{page.title}</h1><p className="muted mt-1 text-sm">{page.published ? page.isHome ? "已发布 · 当前主页" : "已发布" : "草稿"}</p></div><div className="actions">{page.isHome&&<form action={applyLiangchenHomeTemplate} onSubmit={(event)=>{if(!window.confirm("将覆盖当前首页草稿，并创建缺失的五个内容页草稿；线上版本不会改变。确认继续？"))event.preventDefault()}}><input type="hidden" name="id" value={page.id}/><ActionSubmitButton className="btn disabled:cursor-wait disabled:opacity-60" pendingLabel="应用中…">应用良丞首页模板</ActionSubmitButton></form>}<form action={savePageDraft}><input type="hidden" name="id" value={page.id}/><input type="hidden" name="config" value={config}/><ActionSubmitButton className="btn disabled:cursor-wait disabled:opacity-60" pendingLabel="保存中…">保存草稿</ActionSubmitButton></form><form action={publishPage}><input type="hidden" name="id" value={page.id}/><input type="hidden" name="config" value={config}/><input type="hidden" name="makeHome" value="false"/><ActionSubmitButton className="btn btn-primary disabled:cursor-wait disabled:opacity-60" pendingLabel="发布中…">发布当前版本</ActionSubmitButton></form>{!page.isHome && <form action={publishPage}><input type="hidden" name="id" value={page.id}/><input type="hidden" name="config" value={config}/><input type="hidden" name="makeHome" value="true"/><ActionSubmitButton className="btn disabled:cursor-wait disabled:opacity-60" pendingLabel="发布中…">发布并设主页</ActionSubmitButton></form>}{page.published && <a className="btn" target="_blank" href={publicUrl}>查看线上页</a>}</div></div>
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={dragStart} onDragCancel={() => setActiveLabel("")} onDragEnd={dragEnd}>
      <div className="grid items-start gap-5 xl:grid-cols-[200px_410px_minmax(280px,1fr)] 2xl:grid-cols-[220px_430px_minmax(320px,1fr)]">
        <aside className="panel p-4 xl:sticky xl:top-5"><h2 className="font-bold">组件</h2><p className="muted mb-3 mt-1 text-xs">点击追加，或拖入中间画布</p><div className="grid gap-2">{types.map((type) => <PaletteItem key={type} type={type} onAdd={() => add(type)}/>)}</div></aside>
        <section><div className="mb-3 flex items-center justify-between"><div><h2 className="font-bold">页面画布</h2><p className="muted mt-1 text-xs">拖动组件调整页面顺序</p></div><span className="badge">{components.length} 个组件</span></div>
          <PhoneCanvas empty={!components.length}><PublicCartProvider slug={store.slug}><SortableContext items={components.map((item) => item.id)} strategy={verticalListSortingStrategy}><PublicHome catalog={{store,categories,products,customerActive:false}} config={{ version: 4, themeColor, components }} employee={employee ?? {name:store.name,phone:store.phone,wechat:null,wechatQrUrl:null,title:null,bio:store.address,avatarUrl:store.logoUrl}} currentPageId={page.id} favoriteIds={[]} pages={pages} heroAutoplay={false} renderComponent={(component, content) => <SortableCanvasItem key={component.id} component={component} selected={selectedId === component.id} onSelect={() => setSelectedId(component.id)} onRemove={() => remove(component.id)}>{content}</SortableCanvasItem>}/></SortableContext></PublicCartProvider></PhoneCanvas>
        </section>
        <aside className="panel p-4 xl:sticky xl:top-5"><h2 className="mb-4 font-bold">属性</h2><Properties/></aside>
      </div>
      <DragOverlay>{activeLabel && <div className="rounded border border-[#176b45] bg-white px-4 py-3 text-sm font-bold text-[#176b45] shadow-xl"><GripVertical className="mr-2 inline" size={16}/>{activeLabel}</div>}</DragOverlay>
    </DndContext>
  </>;
}
