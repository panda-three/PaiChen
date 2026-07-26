import ExcelJS from "exceljs";
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

export const BUSINESS_HEADERS = [
  "序号\n一个序号一款商品", "商品链接名称", "型号", "产品白底图\n一个规格一张\n可不添加",
  "品名\n组合产品，可以吧型号填在品名写在一起", "尺寸", "单位", "单价", "封面主图", "附加主图1",
  "附加主图2", "详情图1", "详情图2", "详情图3", "详情图4", "详情图5",
] as const;

export type ImportError = { row: number; code: string; reason: string };
export type EmbeddedImage = { key: string; bytes: Uint8Array; extension: "png" | "jpg" | "webp"; contentType: string };
export type BusinessVariant = {
  row: number;
  name: string;
  specification: string | null;
  unit: string;
  price: number;
  image: EmbeddedImage | null;
};
export type BusinessProduct = {
  row: number;
  name: string;
  code: string;
  mainImage: EmbeddedImage;
  galleryImages: EmbeddedImage[];
  detailImages: EmbeddedImage[];
  variants: BusinessVariant[];
};

const xml = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function stableVariantCode(productCode: string, index: number) {
  return `${productCode}-${String(index + 1).padStart(2, "0")}`;
}

function list<T>(value: T | T[] | undefined): T[] { return value === undefined ? [] : Array.isArray(value) ? value : [value]; }
function text(cell: ExcelJS.Cell) {
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "result" in value && value.result !== undefined) return String(value.result).trim();
  if (typeof value === "object" && "text" in value) return String(value.text).trim();
  if (typeof value === "object" && "richText" in value) return value.richText.map((part) => part.text).join("").trim();
  if (typeof value === "object") return "";
  return String(value).trim();
}
function normalized(value: string) { return value.replace(/\s+/g, ""); }
function imageType(path: string): Pick<EmbeddedImage, "extension" | "contentType"> | null {
  const extension = path.split(".").pop()?.toLowerCase();
  if (extension === "png") return { extension: "png", contentType: "image/png" };
  if (extension === "jpg" || extension === "jpeg") return { extension: "jpg", contentType: "image/jpeg" };
  if (extension === "webp") return { extension: "webp", contentType: "image/webp" };
  return null;
}
function formulaImageId(cell: ExcelJS.Cell) {
  const value = cell.value;
  const formula = value && typeof value === "object" && "formula" in value ? String(value.formula) : "";
  const marker = "DISPIMG(\"";
  const start = formula.indexOf(marker);
  if (start < 0) return null;
  const idStart = start + marker.length;
  const end = formula.indexOf("\"", idStart);
  return end > idStart ? formula.slice(idStart, end) : null;
}

async function wpsImages(zip: JSZip) {
  const result = new Map<string, EmbeddedImage>();
  const imagesFile = zip.file("xl/cellimages.xml");
  const relsFile = zip.file("xl/_rels/cellimages.xml.rels");
  if (!imagesFile || !relsFile) return result;
  const [imagesDoc, relsDoc] = await Promise.all([imagesFile.async("string"), relsFile.async("string")]);
  const relationships = new Map<string, string>();
  for (const relation of list(xml.parse(relsDoc)?.Relationships?.Relationship)) {
    relationships.set(relation["@_Id"], relation["@_Target"]);
  }
  for (const cellImage of list(xml.parse(imagesDoc)?.cellImages?.cellImage)) {
    const picture = cellImage?.pic;
    const id = picture?.nvPicPr?.cNvPr?.["@_name"];
    const relationId = picture?.blipFill?.blip?.["@_embed"];
    const target = relationships.get(relationId);
    const kind = target ? imageType(target) : null;
    const file = target ? zip.file(`xl/${target.replace(/^\.\//, "")}`) : null;
    if (!id || !target || !kind || !file) continue;
    result.set(id, { key: `wps:${target}`, bytes: await file.async("uint8array"), ...kind });
  }
  return result;
}

function standardImages(workbook: ExcelJS.Workbook, sheet: ExcelJS.Worksheet) {
  const result = new Map<string, EmbeddedImage>();
  const media = ((workbook as unknown as { model: { media?: Array<{ index: number; buffer: Uint8Array; extension: string }> } }).model.media ?? []);
  const byId = new Map(media.map((item) => [item.index, item]));
  for (const image of sheet.getImages()) {
    // ExcelJS declares imageId as a string, but loaded workbook models use the numeric media index.
    const item = byId.get(Number(image.imageId));
    const kind = item ? imageType(`image.${item.extension}`) : null;
    if (!item || !kind) continue;
    const row = Math.floor(image.range.tl.nativeRow) + 1;
    const column = Math.floor(image.range.tl.nativeCol) + 1;
    result.set(`${row}:${column}`, { key: `standard:${image.imageId}`, bytes: new Uint8Array(item.buffer), ...kind });
  }
  return result;
}

function findBusinessSheet(workbook: ExcelJS.Workbook) {
  return workbook.worksheets.find((sheet) => {
    const row2 = sheet.getRow(2); const row3 = sheet.getRow(3);
    return normalized(text(row2.getCell(1))).includes("一个序号一款商品")
      && normalized(text(row3.getCell(2))) === "商品链接名称"
      && normalized(text(row3.getCell(3))) === "型号"
      && normalized(text(row3.getCell(8))) === "单价";
  });
}

export async function parseBusinessWorkbook(input: ArrayBuffer | Uint8Array) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const [zip, workbook] = await Promise.all([
    JSZip.loadAsync(bytes),
    new ExcelJS.Workbook().xlsx.load(bytes as never),
  ]);
  const sheet = findBusinessSheet(workbook);
  if (!sheet) throw new Error("未找到 A:P 业务表头");
  const [wps, anchored] = await Promise.all([wpsImages(zip), Promise.resolve(standardImages(workbook, sheet))]);
  const imageAt = (row: number, column: number) => {
    const cell = sheet.getRow(row).getCell(column);
    const id = formulaImageId(cell);
    return (id ? wps.get(id) : null) ?? anchored.get(`${row}:${column}`) ?? null;
  };

  type Draft = Omit<BusinessProduct, "mainImage"> & { sequence: string; mainImage: EmbeddedImage | null };
  const groups = new Map<string, Draft>();
  for (let rowNumber = 4; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    const sequence = text(row.getCell(1));
    const name = text(row.getCell(2));
    const code = text(row.getCell(3));
    const variantName = text(row.getCell(5));
    const priceText = text(row.getCell(8));
    if (![sequence, name, code, variantName, priceText].some(Boolean)) continue;
    const key = sequence || `row-${rowNumber}`;
    let draft = groups.get(key);
    if (!draft) {
      draft = {
        sequence: key, row: rowNumber, name, code, mainImage: imageAt(rowNumber, 9),
        galleryImages: [imageAt(rowNumber, 10), imageAt(rowNumber, 11)].filter((item): item is EmbeddedImage => Boolean(item)),
        detailImages: [12, 13, 14, 15, 16].map((column) => imageAt(rowNumber, column)).filter((item): item is EmbeddedImage => Boolean(item)),
        variants: [],
      };
      groups.set(key, draft);
    }
    const price = Number(priceText);
    draft.variants.push({
      row: rowNumber, name: variantName, specification: text(row.getCell(6)) || null,
      unit: text(row.getCell(7)), price, image: imageAt(rowNumber, 4),
    });
  }

  if (groups.size > 50) throw new Error("单次最多导入 50 款商品");
  if ([...groups.values()].reduce((sum, item) => sum + item.variants.length, 0) > 500) throw new Error("单次最多导入 500 个规格");

  const duplicateCodes = new Set<string>();
  const codeCounts = new Map<string, number>();
  for (const item of groups.values()) codeCounts.set(item.code, (codeCounts.get(item.code) ?? 0) + 1);
  for (const [code, count] of codeCounts) if (code && count > 1) duplicateCodes.add(code);

  const products: BusinessProduct[] = [];
  const errors: ImportError[] = [];
  for (const item of groups.values()) {
    let error: ImportError | null = null;
    const invalidImage = [item.mainImage, ...item.galleryImages, ...item.detailImages, ...item.variants.map((variant) => variant.image)]
      .find((image) => image && image.bytes.byteLength > MAX_IMAGE_BYTES);
    if (!item.name) error = { row: item.row, code: "REQUIRED_FIELD", reason: "商品名称不能为空" };
    else if (!item.code) error = { row: item.row, code: "REQUIRED_FIELD", reason: "型号不能为空" };
    else if (duplicateCodes.has(item.code)) error = { row: item.row, code: "DUPLICATE_CODE", reason: "型号在文件中重复" };
    else if (!item.mainImage) error = { row: item.row, code: "REQUIRED_IMAGE", reason: "第一张主图不能为空" };
    else if (invalidImage) error = { row: item.row, code: "IMAGE_TOO_LARGE", reason: "单张图片不能超过 5MB" };
    else if (!item.variants.length) error = { row: item.row, code: "REQUIRED_FIELD", reason: "商品至少需要一个规格" };
    else {
      const firstUnit = item.variants[0].unit;
      const invalid = item.variants.find((variant) => !variant.name || !variant.unit || !Number.isFinite(variant.price) || variant.price < 0 || variant.unit !== firstUnit);
      if (invalid) {
        const reason = !invalid.name ? "品名不能为空" : !invalid.unit ? "单位不能为空" : !Number.isFinite(invalid.price) || invalid.price < 0 ? "单价必须是非负数字" : "同一商品的单位必须一致";
        error = { row: invalid.row, code: reason.includes("单位必须一致") ? "UNIT_MISMATCH" : "INVALID_VARIANT", reason };
      }
    }
    if (error) errors.push(error);
    else products.push({ row: item.row, name: item.name, code: item.code, mainImage: item.mainImage!, galleryImages: item.galleryImages, detailImages: item.detailImages, variants: item.variants });
  }
  return { products, errors, imageCount: new Set([...wps.values(), ...anchored.values()].map((item) => item.key)).size };
}
