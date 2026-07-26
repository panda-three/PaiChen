import { ImageResponse } from "next/og";
import { Role } from "@prisma/client";
import { getActiveActor } from "@/lib/authz";
import { db } from "@/lib/db";
import { buildSalesDocument, formatSalesMoney } from "@/lib/order-sales-document";
import { orderScope } from "@/lib/scopes";

export const dynamic = "force-dynamic";

async function imageDataUrl(url: string | null) {
  if (!url) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    const type = response.headers.get("content-type") ?? "image/jpeg";
    if (!type.startsWith("image/")) return null;
    return `data:${type};base64,${Buffer.from(await response.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

function dateOnly(value: Date | string) {
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

const columns = ["5%", "16%", "11%", "14%", "7%", "6%", "6%", "9%", "10%", "16%"];
const headers = ["序号", "货品名称", "图片", "规格", "颜色", "数量", "单位", "单价", "金额", "备注"];
const cell = (width: string, extra: Record<string, unknown> = {}) => ({ width, minHeight: 46, display: "flex", alignItems: "center", justifyContent: "center", padding: "7px 6px", borderRight: "1px solid #777", borderBottom: "1px solid #777", fontSize: 16, textAlign: "center" as const, ...extra });

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActiveActor();
  const { id } = await params;
  if (!actor || (actor.role !== Role.STORE_ADMIN && actor.role !== Role.EMPLOYEE) || !actor.storeId) return new Response("Unauthorized", { status: 401 });
  const order = await db.order.findFirst({ where: { id, ...orderScope(actor) }, include: { store: true, sourceEmployee: true, responsibleEmployee: true, items: true } });
  if (!order) return new Response("Not found", { status: 404 });
  const document = buildSalesDocument(order);
  if (!document.ready) return new Response("订单成交并补齐成交单价后才能导出正式销售单", { status: 409 });
  const [logo, ...itemImages] = await Promise.all([imageDataUrl(document.store.logoUrl), ...document.items.map((item) => imageDataUrl(item.imageUrl))]);
  const height = 500 + document.items.length * 108;

  return new ImageResponse(
    <div style={{ width: 1200, height, display: "flex", flexDirection: "column", background: "#fff", color: "#1f2521", padding: "26px 36px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", minHeight: 92, alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ display: "flex", width: 230, fontSize: 16, fontWeight: 700 }}>第 1 页 / 共 1 页</div>
        <div style={{ display: "flex", flex: 1, flexDirection: "column", alignItems: "center" }}><div style={{ display: "flex", alignItems: "center", fontSize: 36, fontWeight: 800 }}>{logo?<img src={logo} alt="" width="54" height="54" style={{ objectFit: "contain", marginRight: 14 }}/>:null}{document.store.name}销售单</div><div style={{ display: "flex", marginTop: 10, fontSize: 17 }}>地址：{document.store.address}</div></div>
        <div style={{ display: "flex", width: 260, flexDirection: "column", alignItems: "flex-end", gap: 8, fontSize: 16, fontWeight: 700 }}><div style={{ display: "flex" }}>订单号：{document.orderNo}</div><div style={{ display: "flex" }}>销售日期：{dateOnly(document.soldAt!)}</div></div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", minHeight: 84, justifyContent: "center", gap: 7, fontSize: 17, fontWeight: 700 }}><div style={{ display: "flex" }}>客户名称：{document.customerName}</div><div style={{ display: "flex" }}>客户电话：{document.customerPhone}</div><div style={{ display: "flex" }}>订单备注：{document.customerRemark || "无"}</div></div>
      <div style={{ display: "flex", flexDirection: "column", borderTop: "1px solid #777", borderLeft: "1px solid #777" }}>
        <div style={{ display: "flex", background: "#f2f3f2", fontWeight: 800 }}>{headers.map((header,index)=><div key={header} style={cell(columns[index])}>{header}</div>)}</div>
        {document.items.map((item,index)=><div key={item.id} style={{ display: "flex", minHeight: 108 }}><div style={cell(columns[0],{minHeight:108})}>{item.sequence}</div><div style={cell(columns[1],{minHeight:108,fontWeight:700,justifyContent:"flex-start",textAlign:"left"})}>{item.productName}</div><div style={cell(columns[2],{minHeight:108})}>{itemImages[index]?<img src={itemImages[index]!} alt="" width="100" height="82" style={{ objectFit:"contain" }}/>:<span style={{display:"flex",fontSize:13,color:"#777"}}>图片加载失败</span>}</div><div style={cell(columns[3],{minHeight:108,justifyContent:"flex-start",textAlign:"left"})}>{item.specification}</div><div style={cell(columns[4],{minHeight:108})}>{item.color||"—"}</div><div style={cell(columns[5],{minHeight:108})}>{item.quantity}</div><div style={cell(columns[6],{minHeight:108,fontWeight:700})}>{item.unit}</div><div style={cell(columns[7],{minHeight:108})}>{formatSalesMoney(item.salePriceCents)}</div><div style={cell(columns[8],{minHeight:108})}>{formatSalesMoney(item.amountCents)}</div><div style={cell(columns[9],{minHeight:108,justifyContent:"flex-start",textAlign:"left"})}>{item.remark}</div></div>)}
        <div style={{ display:"flex",fontWeight:800 }}><div style={cell(columns[0])}></div><div style={cell(columns[1])}>合计</div><div style={cell(columns[2])}></div><div style={cell(columns[3])}></div><div style={cell(columns[4])}></div><div style={cell(columns[5])}>{document.totalQuantity}</div><div style={cell(columns[6])}></div><div style={cell(columns[7])}></div><div style={cell(columns[8])}>{formatSalesMoney(document.productAmountCents)}</div><div style={cell(columns[9])}></div></div>
      </div>
      <div style={{ display:"flex",justifyContent:"space-between",minHeight:104,padding:"10px 10px 0",fontSize:17,fontWeight:700 }}><div style={{display:"flex"}}>合计数量：{document.totalQuantity} 件</div><div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5}}><div style={{display:"flex"}}>商品金额：{formatSalesMoney(document.productAmountCents)}</div><div style={{display:"flex",fontSize:15}}>运费 {formatSalesMoney(document.shippingFeeCents)}　+　安装费 {formatSalesMoney(document.installationFeeCents)}</div><div style={{display:"flex",fontSize:20}}>应付总额：{formatSalesMoney(document.payableAmountCents)}</div></div></div>
      <div style={{ display:"flex",borderTop:"1px solid #777",padding:"8px 10px 0",justifyContent:"space-between",fontSize:17,fontWeight:700 }}><div style={{display:"flex",width:"33%"}}>业务员：{document.salesperson}</div><div style={{display:"flex",width:"33%"}}>财务：________________</div><div style={{display:"flex",width:"33%"}}>签收人：________________</div></div>
    </div>,
    { width: 1200, height, headers: { "Content-Disposition": `attachment; filename="${document.orderNo}-sales.png"; filename*=UTF-8''${encodeURIComponent(`${document.orderNo}-销售单.png`)}` } },
  );
}
