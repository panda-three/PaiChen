import { describe, expect, it } from "vitest";
import { isHttpUrl, publicOrderSchema } from "../lib/validation";

const validOrder = {
  storeSlug: "liangchen",
  ref: "staff-ruan",
  clientRequestId: "11111111-1111-4111-8111-111111111111",
  customerName: "张先生",
  customerPhone: "13912345678",
  customerAddress: "上海市测试路 1 号",
  customerRemark: "周末联系",
  items: [{ productId: "product-1", quantity: 2 }],
};

describe("publicOrderSchema", () => {
  it("accepts a valid purchase intention", () => {
    expect(publicOrderSchema.safeParse(validOrder).success).toBe(true);
  });

  it("rejects invalid mobile numbers", () => {
    const result = publicOrderSchema.safeParse({ ...validOrder, customerPhone: "1234" });
    expect(result.success).toBe(false);
  });

  it("requires at least one product and a positive integer quantity", () => {
    expect(publicOrderSchema.safeParse({ ...validOrder, items: [] }).success).toBe(false);
    expect(publicOrderSchema.safeParse({ ...validOrder, items: [{ productId: "p", quantity: 0 }] }).success).toBe(false);
  });

  it("limits duplicate-submit keys to UUIDs", () => {
    expect(publicOrderSchema.safeParse({ ...validOrder, clientRequestId: "same-order" }).success).toBe(false);
  });
});

describe("isHttpUrl", () => {
  it("allows HTTP images and rejects local paths or other schemes", () => {
    expect(isHttpUrl("https://example.com/item.jpg")).toBe(true);
    expect(isHttpUrl("/Users/demo/item.jpg")).toBe(false);
    expect(isHttpUrl("file:///tmp/item.jpg")).toBe(false);
  });
});
