import ExcelJS from "exceljs";
import { Role } from "@prisma/client";
import { getActiveActor } from "@/lib/authz";
import { db } from "@/lib/db";
import { buildSalesDocument, centsToNumber, formatSalesMoney } from "@/lib/order-sales-document";
import { orderScope } from "@/lib/scopes";

type WorkbookImage = { base64: string; extension: "png" | "jpeg" };

async function fetchWorkbookImage(url: string | null): Promise<WorkbookImage | null> {
  if (!url) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    const extension = contentType.includes("png") || url.toLowerCase().includes(".png") ? "png" : contentType.includes("jpeg") || contentType.includes("jpg") || /\.jpe?g(?:\?|$)/i.test(url) ? "jpeg" : null;
    if (!extension) return null;
    return { base64: `data:${contentType};base64,${Buffer.from(await response.arrayBuffer()).toString("base64")}`, extension };
  } catch {
    return null;
  }
}

function dateOnly(value: Date | string) {
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActiveActor();
  const { id } = await params;
  if (!actor || (actor.role !== Role.STORE_ADMIN && actor.role !== Role.EMPLOYEE) || !actor.storeId) return new Response("Unauthorized", { status: 401 });
  const order = await db.order.findFirst({ where: { id, ...orderScope(actor) }, include: { store: true, sourceEmployee: true, responsibleEmployee: true, items: true } });
  if (!order) return new Response("Not found", { status: 404 });
  const document = buildSalesDocument(order);
  if (!document.ready) return new Response("订单成交并补齐成交单价后才能导出正式销售单", { status: 409 });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "云丞商城后台";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("销售单", { pageSetup: { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.15, footer: 0.15 } } });
  sheet.properties.defaultRowHeight = 22;
  sheet.headerFooter.oddHeader = "&L第 &P 页 / 共 &N 页";
  sheet.columns = [5, 20, 13, 17, 9, 8, 8, 12, 13, 20].map((width) => ({ width }));

  sheet.mergeCells("C1:H2"); sheet.getCell("C1").value = `${document.store.name}销售单`;
  sheet.getCell("C1").font = { name: "Microsoft YaHei", size: 24, bold: true };
  sheet.getCell("C1").alignment = { horizontal: "center", vertical: "middle" };
  sheet.getCell("A1").value = "第 1 页 / 共 1 页"; sheet.getCell("A1").font = { name: "Microsoft YaHei", size: 10, bold: true };
  sheet.mergeCells("I1:J1"); sheet.getCell("I1").value = `订单号：${document.orderNo}`;
  sheet.mergeCells("I2:J2"); sheet.getCell("I2").value = `销售日期：${dateOnly(document.soldAt!)}`;
  sheet.mergeCells("C3:H3"); sheet.getCell("C3").value = `地址：${document.store.address}`; sheet.getCell("C3").alignment = { horizontal: "center" };
  sheet.mergeCells("A4:E4"); sheet.getCell("A4").value = `客户名称：${document.customerName}`;
  sheet.mergeCells("A5:E5"); sheet.getCell("A5").value = `客户电话：${document.customerPhone}`;
  sheet.mergeCells("A6:J6"); sheet.getCell("A6").value = `订单备注：${document.customerRemark || "无"}`;
  for (let row = 1; row <= 6; row++) sheet.getRow(row).font = { ...sheet.getRow(row).font, name: "Microsoft YaHei" };
  sheet.getRow(1).height = 28; sheet.getRow(2).height = 28; sheet.getRow(3).height = 24;

  const logo = await fetchWorkbookImage(document.store.logoUrl);
  if (logo) {
    const logoId = workbook.addImage(logo);
    sheet.addImage(logoId, { tl: { col: 1.05, row: 0.15 }, ext: { width: 70, height: 48 } });
  }

  const headerRow = 7;
  const headers = ["序号", "货品名称", "图片", "规格", "颜色", "数量", "单位", "单价", "金额", "备注"];
  headers.forEach((header, index) => { const cell = sheet.getCell(headerRow, index + 1); cell.value = header; cell.font = { name: "Microsoft YaHei", bold: true }; cell.alignment = { horizontal: "center", vertical: "middle" }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F3F2" } }; });
  sheet.getRow(headerRow).height = 26;

  const itemImages = await Promise.all(document.items.map((item) => fetchWorkbookImage(item.imageUrl)));
  document.items.forEach((item, index) => {
    const rowNumber = headerRow + 1 + index;
    const row = sheet.getRow(rowNumber); row.height = 68;
    row.values = [item.sequence, item.productName, itemImages[index] ? "" : "图片加载失败", item.specification, item.color || "—", item.quantity, item.unit, centsToNumber(item.salePriceCents!), centsToNumber(item.amountCents!), item.remark];
    row.eachCell({ includeEmpty: true }, (cell) => { cell.font = { name: "Microsoft YaHei", size: 10 }; cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true }; });
    const image = itemImages[index];
    if (image) { const imageId = workbook.addImage(image); sheet.addImage(imageId, { tl: { col: 2.1, row: rowNumber - 0.9 }, ext: { width: 82, height: 58 } }); }
    sheet.getCell(rowNumber, 8).numFmt = "¥#,##0.00";
    sheet.getCell(rowNumber, 9).numFmt = "¥#,##0.00";
  });

  const totalRow = headerRow + 1 + document.items.length;
  sheet.getCell(totalRow, 2).value = "合计"; sheet.getCell(totalRow, 2).font = { name: "Microsoft YaHei", bold: true };
  sheet.getCell(totalRow, 6).value = document.totalQuantity; sheet.getCell(totalRow, 6).font = { bold: true };
  sheet.getCell(totalRow, 9).value = centsToNumber(document.productAmountCents); sheet.getCell(totalRow, 9).numFmt = "¥#,##0.00"; sheet.getCell(totalRow, 9).font = { bold: true };
  sheet.mergeCells(totalRow + 1, 1, totalRow + 1, 5); sheet.getCell(totalRow + 1, 1).value = `合计数量：${document.totalQuantity} 件`;
  sheet.mergeCells(totalRow + 1, 7, totalRow + 1, 10); sheet.getCell(totalRow + 1, 7).value = `商品金额：${formatSalesMoney(document.productAmountCents)}`;
  sheet.mergeCells(totalRow + 2, 7, totalRow + 2, 10); sheet.getCell(totalRow + 2, 7).value = `运费：${formatSalesMoney(document.shippingFeeCents)}  +  安装费：${formatSalesMoney(document.installationFeeCents)}`;
  sheet.mergeCells(totalRow + 3, 7, totalRow + 3, 10); sheet.getCell(totalRow + 3, 7).value = `应付总额：${formatSalesMoney(document.payableAmountCents)}`; sheet.getCell(totalRow + 3, 7).font = { name: "Microsoft YaHei", size: 13, bold: true };
  sheet.mergeCells(totalRow + 4, 1, totalRow + 4, 3); sheet.getCell(totalRow + 4, 1).value = `业务员：${document.salesperson}`;
  sheet.mergeCells(totalRow + 4, 4, totalRow + 4, 7); sheet.getCell(totalRow + 4, 4).value = "财务：________________";
  sheet.mergeCells(totalRow + 4, 8, totalRow + 4, 10); sheet.getCell(totalRow + 4, 8).value = "签收人：________________";
  for (let row = totalRow; row <= totalRow + 4; row++) { sheet.getRow(row).height = row === totalRow + 3 ? 28 : 24; sheet.getRow(row).eachCell((cell) => { cell.font = { name: "Microsoft YaHei", bold: cell.font?.bold }; cell.alignment = { vertical: "middle", horizontal: row >= totalRow + 1 && Number(cell.col) >= 7 ? "right" : "left" }; }); }

  for (let row = headerRow; row <= totalRow; row++) for (let col = 1; col <= 10; col++) sheet.getCell(row, col).border = { top: { style: "thin", color: { argb: "FF777777" } }, left: { style: "thin", color: { argb: "FF777777" } }, bottom: { style: "thin", color: { argb: "FF777777" } }, right: { style: "thin", color: { argb: "FF777777" } } };
  sheet.views = [{ showGridLines: false }];
  sheet.pageSetup.printArea = `A1:J${totalRow + 4}`;

  const buffer = await workbook.xlsx.writeBuffer();
  const utf8Name = encodeURIComponent(`${document.orderNo}-销售单.xlsx`);
  return new Response(buffer as ArrayBuffer, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${document.orderNo}-sales.xlsx"; filename*=UTF-8''${utf8Name}` } });
}
