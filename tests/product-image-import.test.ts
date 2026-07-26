import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { BUSINESS_HEADERS, parseBusinessWorkbook, stableVariantCode } from "../lib/product-image-import";
import { isStoreImportPath } from "../lib/product-storage";

const pixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");

async function workbookWithRows(rows: Array<Array<string | number>>, withVariantImage = false) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("任意名称");
  sheet.getCell("A2").value = BUSINESS_HEADERS[0];
  BUSINESS_HEADERS.slice(1).forEach((header, index) => { sheet.getRow(3).getCell(index + 2).value = header; });
  rows.forEach((values, index) => values.forEach((value, column) => { sheet.getRow(index + 4).getCell(column + 1).value = value; }));
  const imageId = workbook.addImage({ buffer: pixel as never, extension: "png" });
  const firstRows = rows.map((row, index) => ({ sequence: String(row[0]), index })).filter((row, index, all) => index === all.findIndex((other) => other.sequence === row.sequence));
  firstRows.forEach(({ index }) => sheet.addImage(imageId, { tl: { col: 8, row: index + 3 }, ext: { width: 20, height: 20 } }));
  if (withVariantImage) sheet.addImage(imageId, { tl: { col: 3, row: 3 }, ext: { width: 20, height: 20 } });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe("A:P image workbook import", () => {
  it("finds a business sheet by headers and reads standard anchored images", async () => {
    const buffer = await workbookWithRows([
      [1, "餐桌", "6002", "", "1.6 米", "160x90", "件", 11800],
      [1, "餐桌", "6002", "", "1.8 米", "180x90", "件", 12650],
    ], true);
    const result = await parseBusinessWorkbook(buffer);
    expect(result.errors).toEqual([]);
    expect(result.products).toHaveLength(1);
    expect(result.products[0]).toMatchObject({ name: "餐桌", code: "6002" });
    expect(result.products[0].variants).toHaveLength(2);
    expect(result.products[0].variants[0]).toMatchObject({ name: "1.6 米", specification: "160x90", unit: "件", price: 11800 });
    expect(result.products[0].variants[0].image).not.toBeNull();
  });

  it("skips the whole product when one variant is invalid", async () => {
    const buffer = await workbookWithRows([
      [1, "餐桌", "6002", "", "1.6 米", "", "件", 11800],
      [1, "餐桌", "6002", "", "1.8 米", "", "套", 12650],
      [2, "椅子", "6010", "", "默认", "", "件", 1000],
    ]);
    const result = await parseBusinessWorkbook(buffer);
    expect(result.products.map((item) => item.code)).toEqual(["6010"]);
    expect(result.errors).toEqual([{ row: 5, code: "UNIT_MISMATCH", reason: "同一商品的单位必须一致" }]);
  });

  it("rejects a negative price and generates stable variant codes", async () => {
    const buffer = await workbookWithRows([[1, "餐桌", "6002", "", "默认", "", "件", -1]]);
    const result = await parseBusinessWorkbook(buffer);
    expect(result.products).toEqual([]);
    expect(result.errors[0]).toMatchObject({ row: 4, code: "INVALID_VARIANT", reason: "单价必须是非负数字" });
    expect([0, 1, 9].map((index) => stableVariantCode("6002", index))).toEqual(["6002-01", "6002-02", "6002-10"]);
  });

  it("resolves WPS DISPIMG cells through structured image relationships", async () => {
    const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet("业务表");
    sheet.getCell("A2").value = BUSINESS_HEADERS[0];
    BUSINESS_HEADERS.slice(1).forEach((header, index) => { sheet.getRow(3).getCell(index + 2).value = header; });
    [1, "床", "6001", "", "1.5 米床", "1500x2000", "件", 6800].forEach((value, index) => { sheet.getRow(4).getCell(index + 1).value = value; });
    sheet.getCell("I4").value = { formula: '_xlfn.DISPIMG("ID_MAIN",1)', result: '=DISPIMG("ID_MAIN",1)' } as never;
    const zip = await JSZip.loadAsync(await workbook.xlsx.writeBuffer());
    zip.file("xl/cellimages.xml", '<?xml version="1.0"?><etc:cellImages xmlns:etc="http://www.wps.cn/officeDocument/2017/etCustomData" xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><etc:cellImage><xdr:pic><xdr:nvPicPr><xdr:cNvPr name="ID_MAIN"/></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId1"/></xdr:blipFill></xdr:pic></etc:cellImage></etc:cellImages>');
    zip.file("xl/_rels/cellimages.xml.rels", '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/></Relationships>');
    zip.file("xl/media/image1.png", pixel);
    const result = await parseBusinessWorkbook(await zip.generateAsync({ type: "uint8array" }));
    expect(result.errors).toEqual([]);
    expect(result.products[0].mainImage.key).toBe("wps:media/image1.png");
  });

  const acceptancePath = resolve(process.cwd(), "04欣雅图一件上传测试打样(1).xlsx");
  (existsSync(acceptancePath) ? it : it.skip)("parses the local acceptance workbook as 3 products, 8 variants and 24 images", async () => {
    const path = acceptancePath;
    const result = await parseBusinessWorkbook(await readFile(path));
    expect(result.errors).toEqual([]);
    expect(result.products).toHaveLength(3);
    expect(result.products.reduce((sum, item) => sum + item.variants.length, 0)).toBe(8);
    expect(result.imageCount).toBe(24);
    expect(result.products[0].variants.every((item) => item.image === null)).toBe(true);
    expect(result.products[2].detailImages).toHaveLength(4);
  });
});

describe("temporary import paths", () => {
  it("accepts only a UUID xlsx directly below the current store directory", () => {
    const path = "store-a/11111111-1111-4111-8111-111111111111.xlsx";
    expect(isStoreImportPath(path, "store-a")).toBe(true);
    expect(isStoreImportPath(path, "store-b")).toBe(false);
    expect(isStoreImportPath("store-a/nested/file.xlsx", "store-a")).toBe(false);
    expect(isStoreImportPath("store-a/not-a-uuid.xlsx", "store-a")).toBe(false);
  });
});
