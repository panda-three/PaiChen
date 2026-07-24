import ExcelJS from "exceljs";
import { Role } from "@prisma/client";
import { getActiveActor } from "@/lib/authz";
import { db } from "@/lib/db";

const headers = ["商品名称*", "商品编码*", "分类名称*", "主图URL*", "详情图URL", "规格/型号*", "参考价格", "单位", "商品描述", "排序"];
const urlPattern = /^https?:\/\/\S+$/i;
const value = (cell: ExcelJS.Cell) => String(cell.text ?? "").trim();

export async function POST(request: Request) {
  const actor = await getActiveActor();
  if (!actor || actor.role !== Role.STORE_ADMIN || !actor.storeId) return Response.json({ error: "无权导入商品" }, { status: 401 });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx")) return Response.json({ error: "请选择 .xlsx 文件" }, { status: 400 });
  if (file.size > 5 * 1024 * 1024) return Response.json({ error: "文件不能超过 5MB" }, { status: 400 });

  const workbook = new ExcelJS.Workbook();
  try { await workbook.xlsx.load(await file.arrayBuffer()); } catch { return Response.json({ error: "Excel 文件无法读取" }, { status: 400 }); }
  const sheet = workbook.worksheets[0];
  if (!sheet) return Response.json({ error: "Excel 中没有工作表" }, { status: 400 });
  const actualHeaders = headers.map((_, index) => value(sheet.getRow(1).getCell(index + 1)));
  if (headers.some((header, index) => actualHeaders[index] !== header)) return Response.json({ error: "表头与当前模板不一致，请重新下载模板" }, { status: 400 });

  const [categories, existing] = await Promise.all([
    db.category.findMany({ where: { storeId: actor.storeId } }),
    db.product.findMany({ where: { storeId: actor.storeId }, select: { code: true } }),
  ]);
  const categoryMap = new Map(categories.map((category) => [category.name, category]));
  const codes = new Set(existing.map((product) => product.code));
  const errors: { row: number; reason: string }[] = [];
  let success = 0;

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    if (!row.hasValues) continue;
    const [name, code, categoryName, mainImageUrl, detailImageUrls, specification, priceText, unit, description, sortText] = headers.map((_, index) => value(row.getCell(index + 1)));
    let reason = "";
    if (!name) reason = "商品名称不能为空"; else if (!code) reason = "商品编码不能为空"; else if (!categoryMap.has(categoryName)) reason = `分类“${categoryName || "空"}”不存在`; else if (!urlPattern.test(mainImageUrl)) reason = "主图 URL 格式不正确";
    else if (detailImageUrls && detailImageUrls.split(/\r?\n/).some((url) => !urlPattern.test(url.trim()))) reason = "详情图中存在无效 URL";
    else if (!specification) reason = "规格/型号不能为空"; else if (priceText && (!Number.isFinite(Number(priceText)) || Number(priceText) < 0)) reason = "参考价格格式不正确";
    else if (sortText && !Number.isInteger(Number(sortText))) reason = "排序必须是整数"; else if (codes.has(code)) reason = "商品编码在本店或当前文件中重复";
    if (reason) { errors.push({ row: rowNumber, reason }); continue; }
    codes.add(code);
    try {
      await db.product.create({ data: { storeId: actor.storeId, categoryId: categoryMap.get(categoryName)!.id, name, code, mainImageUrl, detailImageUrls, specification, price: priceText ? Number(priceText) : null, unit: unit || "件", description, sort: sortText ? Number(sortText) : 0, isPublished: false } });
      success++;
    } catch { errors.push({ row: rowNumber, reason: "保存失败，商品编码可能已被占用" }); }
  }
  return Response.json({ success, failed: errors.length, errors });
}
