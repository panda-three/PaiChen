import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import { ProductSource, Role } from "@prisma/client";
import { getActiveActor } from "@/lib/authz";
import { db } from "@/lib/db";
import { BusinessProduct, EmbeddedImage, ImportError, parseBusinessWorkbook, stableVariantCode } from "@/lib/product-image-import";
import { groupImportRows, importCategoryLookup, ImportRow, V2_HEADERS } from "@/lib/product-import";
import { isStoreImportPath, PRODUCT_IMAGES_BUCKET, PRODUCT_IMPORTS_BUCKET, productStorage } from "@/lib/product-storage";

export const runtime = "nodejs";
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const LEGACY = ["商品名称*", "商品编码*", "分类名称*", "主图URL*", "详情图URL", "规格/型号*", "参考价格", "单位", "商品描述", "排序"];

const cell = (row: ExcelJS.Row, index: number) => String(row.getCell(index + 1).text ?? "").trim();
type Result = { success: number; failed: number; errors: ImportError[] };

async function uploadProductImages(storeId: string, product: BusinessProduct) {
  const storage = productStorage();
  const uploadedPaths: string[] = [];
  const urls = new Map<string, string>();
  const images = [product.mainImage, ...product.galleryImages, ...product.detailImages, ...product.variants.map((variant) => variant.image).filter((item): item is EmbeddedImage => Boolean(item))];
  try {
    for (const image of images) {
      if (urls.has(image.key)) continue;
      const path = `${storeId}/${randomUUID()}.${image.extension}`;
      const { error } = await storage.from(PRODUCT_IMAGES_BUCKET).upload(path, image.bytes, { contentType: image.contentType, upsert: false });
      if (error) throw error;
      uploadedPaths.push(path);
      urls.set(image.key, storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl);
    }
    return { uploadedPaths, url: (image: EmbeddedImage | null) => image ? urls.get(image.key) ?? "" : "" };
  } catch (error) {
    if (uploadedPaths.length) await storage.from(PRODUCT_IMAGES_BUCKET).remove(uploadedPaths).catch(() => null);
    throw error;
  }
}

async function importBusiness(buffer: Buffer, storeId: string): Promise<Result> {
  const parsed = await parseBusinessWorkbook(buffer);
  const existing = await db.product.findMany({ where: { storeId, code: { in: parsed.products.map((item) => item.code) } }, select: { code: true } });
  const existingCodes = new Set(existing.map((item) => item.code));
  const errors = [...parsed.errors];
  let success = 0;
  for (const product of parsed.products) {
    if (existingCodes.has(product.code)) {
      errors.push({ row: product.row, code: "DUPLICATE_CODE", reason: "型号在本店已存在" });
      continue;
    }
    let uploaded: Awaited<ReturnType<typeof uploadProductImages>> | null = null;
    try {
      uploaded = await uploadProductImages(storeId, product);
      const firstVariant = product.variants[0];
      await db.$transaction((tx) => tx.product.create({
        data: {
          storeId, categoryId: null, source: ProductSource.EXCEL, isPublished: false,
          name: product.name, code: product.code, mainImageUrl: uploaded!.url(product.mainImage),
          galleryImageUrls: product.galleryImages.map(uploaded!.url).join("\n"),
          detailImageUrls: product.detailImages.map(uploaded!.url).join("\n"),
          specification: firstVariant.specification ?? firstVariant.name, price: firstVariant.price,
          referenceStock: null, unit: firstVariant.unit, description: "", sort: 0,
          variants: { create: product.variants.map((variant, index) => ({
            name: variant.name, code: stableVariantCode(product.code, index),
            price: variant.price, referenceStock: null, imageUrl: uploaded!.url(variant.image),
            specification: variant.specification, sort: index,
          })) },
        },
      }));
      success++;
    } catch {
      if (uploaded?.uploadedPaths.length) await productStorage().from(PRODUCT_IMAGES_BUCKET).remove(uploaded.uploadedPaths).catch(() => null);
      errors.push({ row: product.row, code: uploaded ? "SAVE_FAILED" : "UPLOAD_FAILED", reason: uploaded ? "保存失败，型号或规格编码可能重复" : "商品图片上传失败" });
    }
  }
  return { success, failed: errors.length, errors };
}

async function importUrlWorkbook(buffer: Buffer, storeId: string): Promise<Result> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as never);
  const sheet = workbook.worksheets.find((candidate) => {
    const first = cell(candidate.getRow(1), 0);
    const expected = first === V2_HEADERS[0] ? V2_HEADERS : LEGACY;
    return expected.every((header, index) => cell(candidate.getRow(1), index) === header);
  });
  if (!sheet) throw new Error("表头不受支持，请使用 A:P 业务模板、V2 模板或原 MVP 模板");
  const v2 = cell(sheet.getRow(1), 0) === V2_HEADERS[0];
  const rows: ImportRow[] = [];
  for (let number = 2; number <= sheet.rowCount; number++) {
    const row = sheet.getRow(number); if (!row.hasValues) continue;
    rows.push(v2
      ? { row: number, name: cell(row, 1), code: cell(row, 2), categoryName: cell(row, 3), mainImageUrl: cell(row, 4), detailImageUrls: cell(row, 5), variantName: cell(row, 6), variantCode: cell(row, 7), priceText: cell(row, 8), stockText: cell(row, 9), unit: cell(row, 10), description: cell(row, 11), sortText: cell(row, 12) }
      : { row: number, name: cell(row, 0), code: cell(row, 1), categoryName: cell(row, 2), mainImageUrl: cell(row, 3), detailImageUrls: cell(row, 4), variantName: cell(row, 5), variantCode: `${cell(row, 1)}-DEFAULT`, priceText: cell(row, 6), stockText: "", unit: cell(row, 7), description: cell(row, 8), sortText: cell(row, 9) });
  }
  if (new Set(rows.map((row) => row.code).filter(Boolean)).size > 50) throw new Error("单次最多导入 50 款商品");
  if (rows.length > 500) throw new Error("单次最多导入 500 个规格");
  const [categories, existing] = await Promise.all([
    db.category.findMany({ where: { storeId } }),
    db.product.findMany({ where: { storeId }, select: { code: true } }),
  ]);
  const categoryMap = importCategoryLookup(categories);
  const result = groupImportRows(rows, new Set(existing.map((item) => item.code)), new Set(categoryMap.keys()));
  const errors: ImportError[] = result.errors.map((error) => ({ row: error.row, code: "VALIDATION_ERROR", reason: error.reason }));
  let success = 0;
  for (const product of result.products) {
    try {
      const firstVariant = product.variants[0];
      await db.product.create({ data: { storeId, categoryId: categoryMap.get(product.categoryName)!, source: ProductSource.EXCEL, name: product.name, code: product.code, mainImageUrl: product.mainImageUrl, detailImageUrls: product.detailImageUrls, specification: firstVariant.name, price: firstVariant.price, referenceStock: firstVariant.stock, unit: product.unit, description: product.description, sort: product.sort, isPublished: false, variants: { create: product.variants.map((variant, sort) => ({ name: variant.name, code: variant.code, price: variant.price, referenceStock: variant.stock, sort })) } } });
      success++;
    } catch {
      errors.push({ row: rows.find((item) => item.code === product.code)?.row ?? 0, code: "SAVE_FAILED", reason: "保存失败，商品或规格编码可能重复" });
    }
  }
  const failedCodes = new Set(errors.map((error) => rows.find((row) => row.row === error.row)?.code || `row-${error.row}`));
  return { success, failed: failedCodes.size, errors };
}

async function runImport(buffer: Buffer, storeId: string) {
  try {
    return await importBusiness(buffer, storeId);
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "未找到 A:P 业务表头") throw error;
    return importUrlWorkbook(buffer, storeId);
  }
}

export async function POST(request: Request) {
  const actor = await getActiveActor();
  if (!actor || actor.role !== Role.STORE_ADMIN || !actor.storeId) return Response.json({ error: "无权导入商品" }, { status: 401 });
  let temporaryPath: string | null = null;
  try {
    let buffer: Buffer;
    if (request.headers.get("content-type")?.includes("application/json")) {
      const input = await request.json().catch(() => null) as { path?: unknown } | null;
      const path = typeof input?.path === "string" ? input.path : "";
      if (!isStoreImportPath(path, actor.storeId)) return Response.json({ error: "上传路径不属于当前店铺" }, { status: 400 });
      temporaryPath = path;
      const { data, error } = await productStorage().from(PRODUCT_IMPORTS_BUCKET).download(path);
      if (error || !data) return Response.json({ error: "找不到待导入的 Excel 文件" }, { status: 400 });
      if (data.size > MAX_FILE_BYTES) return Response.json({ error: "Excel 文件不能超过 20MB" }, { status: 400 });
      buffer = Buffer.from(await data.arrayBuffer());
    } else {
      const form = await request.formData(); const file = form.get("file");
      if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx")) return Response.json({ error: "请选择 .xlsx 文件" }, { status: 400 });
      if (file.size > MAX_FILE_BYTES) return Response.json({ error: "Excel 文件不能超过 20MB" }, { status: 400 });
      buffer = Buffer.from(await file.arrayBuffer());
    }
    return Response.json(await runImport(buffer, actor.storeId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Excel 文件无法读取";
    return Response.json({ error: message }, { status: message.includes("存储尚未配置") ? 503 : 400 });
  } finally {
    if (temporaryPath) {
      try { await productStorage().from(PRODUCT_IMPORTS_BUCKET).remove([temporaryPath]); } catch { /* The import response must survive cleanup failures. */ }
    }
  }
}
