import { ImageResponse } from "next/og";
import { Role } from "@prisma/client";
import { getActiveActor } from "@/lib/authz";
import { db } from "@/lib/db";
import { statusLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActiveActor();
  const { id } = await params;
  if (!actor || (actor.role !== Role.STORE_ADMIN && actor.role !== Role.EMPLOYEE) || !actor.storeId) return new Response("Unauthorized", { status: 401 });
  const order = await db.order.findFirst({
    where: { id, storeId: actor.storeId, ...(actor.role === Role.EMPLOYEE ? { sourceEmployeeId: actor.id } : {}) },
    include: { store: true, sourceEmployee: true, items: true },
  });
  if (!order) return new Response("Not found", { status: 404 });
  const height = 470 + order.items.length * 145;

  return new ImageResponse(
    <div style={{ width: 900, height, display: "flex", flexDirection: "column", background: "#f6f7f5", color: "#17211b", padding: 48, fontFamily: "Arial" }}>
      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "2px solid #d9e1db", paddingBottom: 24 }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 28, fontWeight: 700 }}>{order.store.name}</div>
          <div style={{ display: "flex", fontSize: 18, color: "#6d786f", marginTop: 8 }}>{`购买意向单 · ${order.orderNo}`}</div>
        </div>
        <div style={{ display: "flex", fontSize: 22, color: "#176b45", fontWeight: 700 }}>{statusLabel[order.status]}</div>
      </div>
      <div style={{ display: "flex", marginTop: 28, fontSize: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "50%" }}>
          <div style={{ display: "flex" }}>{`客户：${order.customerName}`}</div>
          <div style={{ display: "flex" }}>{`手机：${order.customerPhone}`}</div>
          <div style={{ display: "flex" }}>{`来源：${order.sourceEmployee?.name ?? "店铺默认"}`}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "50%" }}>
          <div style={{ display: "flex" }}>{`时间：${order.createdAt.toLocaleString("zh-CN")}`}</div>
          <div style={{ display: "flex" }}>{`电话：${order.store.phone}`}</div>
          <div style={{ display: "flex" }}>{`地址：${order.customerAddress || "未填写"}`}</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 30, gap: 14 }}>
        {order.items.map((item) => <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 18, background: "#ffffff", borderRadius: 10, padding: 15 }}>
          <img src={item.imageUrl} alt="" width="108" height="108" style={{ objectFit: "cover", borderRadius: 8 }} />
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ display: "flex", fontSize: 22, fontWeight: 700 }}>{item.productName}</div>
            <div style={{ display: "flex", fontSize: 17, color: "#6d786f", marginTop: 8 }}>{`${item.productCode} · ${item.specification}`}</div>
          </div>
          <div style={{ display: "flex", fontSize: 21, fontWeight: 700 }}>{`${item.quantity} ${item.unit}`}</div>
        </div>)}
      </div>
      <div style={{ display: "flex", marginTop: 28, borderTop: "2px solid #d9e1db", paddingTop: 20, fontSize: 18, color: "#6d786f" }}>{`客户备注：${order.customerRemark || "无"} | 本平台仅提交购买意向，最终价格由商家确认。`}</div>
    </div>,
    { width: 900, height, headers: { "Content-Disposition": `attachment; filename=${order.orderNo}.png` } },
  );
}
