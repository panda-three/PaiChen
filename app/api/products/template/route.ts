import ExcelJS from "exceljs";
import { Role } from "@prisma/client";
import { getActiveActor } from "@/lib/authz";

export async function GET() {
  const actor = await getActiveActor();
  if (!actor || actor.role !== Role.STORE_ADMIN) return new Response("Unauthorized", { status: 401 });
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("商品图片批量导入");
  sheet.mergeCells("A1:P1");
  sheet.getCell("A1").value = "备注：一个序号代表一款商品；导入后商品进入未分类、未上架状态。";
  sheet.mergeCells("A2:A3"); sheet.getCell("A2").value = "序号\n一个序号一款商品";
  sheet.mergeCells("B2:C2"); sheet.getCell("B2").value = "产品名称";
  sheet.mergeCells("D2:H2"); sheet.getCell("D2").value = "规格";
  sheet.mergeCells("I2:K3"); sheet.getCell("I2").value = "主图\n第一张为封面，最多 3 张";
  sheet.mergeCells("L2:P3"); sheet.getCell("L2").value = "商品详情\n最多 5 张";
  ["商品链接名称", "型号", "产品白底图\n一个规格一张\n可不添加", "品名", "尺寸", "单位", "单价"].forEach((value, index) => { sheet.getRow(3).getCell(index + 2).value = value; });
  sheet.columns = Array.from({ length: 16 }, (_, index) => ({ width: index === 1 ? 32 : index >= 8 ? 20 : 18 }));
  sheet.getRow(1).height = 28; sheet.getRow(2).height = 34; sheet.getRow(3).height = 46;
  for (const row of [1, 2, 3]) {
    sheet.getRow(row).font = { bold: true, color: { argb: row === 1 ? "FF3F4F43" : "FFFFFFFF" } };
    if (row > 1) sheet.getRow(row).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3F4F43" } };
    sheet.getRow(row).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  }
  sheet.views = [{ state: "frozen", ySplit: 3 }];
  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer as ArrayBuffer, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": "attachment; filename=product-image-import-template.xlsx" } });
}
