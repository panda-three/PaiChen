import ExcelJS from "exceljs";
import { Role } from "@prisma/client";
import { getActiveActor } from "@/lib/authz";

export async function GET() {
  const actor = await getActiveActor();
  if (!actor || actor.role !== Role.STORE_ADMIN) return new Response("Unauthorized", { status: 401 });
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("商品导入");
  sheet.columns = [
    { header: "商品名称*", key: "name", width: 24 }, { header: "商品编码*", key: "code", width: 18 }, { header: "分类名称*", key: "category", width: 18 },
    { header: "主图URL*", key: "mainImageUrl", width: 48 }, { header: "详情图URL", key: "detailImageUrls", width: 48 }, { header: "规格/型号*", key: "specification", width: 28 },
    { header: "参考价格", key: "price", width: 14 }, { header: "单位", key: "unit", width: 10 }, { header: "商品描述", key: "description", width: 36 }, { header: "排序", key: "sort", width: 10 },
  ];
  sheet.addRow({ name: "示例商品（请删除）", code: "DEMO-001", category: "客厅系列", mainImageUrl: "https://example.com/product.jpg", detailImageUrls: "https://example.com/detail-1.jpg\nhttps://example.com/detail-2.jpg", specification: "2200x950x820mm", price: 6999, unit: "套", description: "商品描述", sort: 10 });
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } }; sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF176B45" } };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer as ArrayBuffer, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": "attachment; filename=product-import-template.xlsx" } });
}
