import { describe, expect, it } from "vitest";
import { findCurrentHref } from "../components/admin-nav";

describe("admin navigation", () => {
  it("assigns nested pages to the longest matching menu path", () => {
    expect(findCurrentHref("/admin/products/import", ["/admin/products"])).toBe("/admin/products");
    expect(findCurrentHref("/admin/enterprise/products", ["/admin/enterprise", "/admin/enterprise/products"])).toBe("/admin/enterprise/products");
    expect(findCurrentHref("/admin/orders/order-1", ["/admin/orders"])).toBe("/admin/orders");
  });

  it("does not match a sibling path with the same prefix", () => {
    expect(findCurrentHref("/admin/productivity", ["/admin/products"])).toBeUndefined();
  });
});
