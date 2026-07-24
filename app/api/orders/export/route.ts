import ExcelJS from "exceljs";
import { OrderStatus, Role } from "@prisma/client";
import { getActiveActor } from "@/lib/authz";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const actor = await getActiveActor();
  if (!actor || (actor.role !== Role.STORE_ADMIN && actor.role !== Role.EMPLOYEE) || !actor.storeId) return new Response("Unauthorized", { status: 401 });
  const url = new URL(request.url); const q = url.searchParams.get("q") ?? ""; const rawStatus = url.searchParams.get("status"); const employee = url.searchParams.get("employee");
  const status = Object.values(OrderStatus).includes(rawStatus as OrderStatus) ? rawStatus as OrderStatus : undefined;
  const orders = await db.order.findMany({ where: { storeId: actor.storeId, ...(actor.role === Role.EMPLOYEE ? { sourceEmployeeId: actor.id } : {}), ...(status ? { status } : {}), ...(employee && actor.role === Role.STORE_ADMIN ? { sourceEmployeeId: employee } : {}), ...(q ? { OR: [{ orderNo: { contains: q } }, { customerName: { contains: q } }, { customerPhone: { contains: q } }] } : {}) }, include: { sourceEmployee: true, items: true }, orderBy: { createdAt: "desc" } });
  const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet("订单");
  sheet.columns = [{ header: "订单编号", key: "orderNo", width: 24 }, { header: "客户姓名", key: "customerName", width: 14 }, { header: "手机号", key: "phone", width: 16 }, { header: "来源员工", key: "employee", width: 14 }, { header: "商品明细", key: "items", width: 54 }, { header: "状态", key: "status", width: 12 }, { header: "客户地址", key: "address", width: 32 }, { header: "客户备注", key: "remark", width: 32 }, { header: "提交时间", key: "createdAt", width: 22 }];
  for (const order of orders) sheet.addRow({ orderNo: order.orderNo, customerName: order.customerName, phone: order.customerPhone, employee: order.sourceEmployee?.name ?? "店铺默认", items: order.items.map((item) => `${item.productName} × ${item.quantity}${item.unit}`).join("；"), status: ({ PENDING: "待跟进", FOLLOWING: "跟进中", WON: "已成交", LOST: "未成交" } as Record<string, string>)[order.status], address: order.customerAddress, remark: order.customerRemark, createdAt: order.createdAt.toLocaleString("zh-CN") });
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } }; sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF176B45" } }; sheet.views = [{ state: "frozen", ySplit: 1 }];
  const buffer = await workbook.xlsx.writeBuffer(); return new Response(buffer as ArrayBuffer, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename=orders-${new Date().toISOString().slice(0, 10)}.xlsx` } });
}
