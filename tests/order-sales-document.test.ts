import { describe, expect, it } from "vitest";
import { buildSalesDocument, formatSalesMoney } from "../lib/order-sales-document";

function salesOrder(overrides: Record<string, unknown> = {}) {
  return {
    orderNo: "YC202607260001",
    status: "WON",
    customerName: "方小姐",
    customerPhone: "13800000000",
    customerAddress: "苏州相城",
    customerRemark: "尽快安排",
    shippingFee: "195",
    installationFee: "666",
    soldAt: new Date("2026-07-24T00:00:00Z"),
    store: { name: "良丞家具", logoUrl: null, address: "苏州相城" },
    sourceEmployee: { name: "来源员工" },
    responsibleEmployee: { name: "甜甜" },
    items: [
      { id: "1", productName: "组合沙发", imageUrl: "https://example.com/1.jpg", specification: "2140*870*970", color: "米白", quantity: 1, unit: "件", salePrice: "25600", remark: "" },
      { id: "2", productName: "长茶几", imageUrl: "https://example.com/2.jpg", specification: "9116", color: "", quantity: 2, unit: "件", salePrice: "2800.50", remark: "" },
    ],
    ...overrides,
  };
}

describe("sales document", () => {
  it("calculates quantities, line amounts and payable total in cents", () => {
    const document = buildSalesDocument(salesOrder());
    expect(document.totalQuantity).toBe(3);
    expect(document.items.map((item) => item.amountCents)).toEqual([2_560_000, 560_100]);
    expect(document.productAmountCents).toBe(3_120_100);
    expect(document.payableAmountCents).toBe(3_206_200);
    expect(formatSalesMoney(document.payableAmountCents)).toBe("¥32,062.00");
  });

  it("uses the responsible employee and falls back to the source employee", () => {
    expect(buildSalesDocument(salesOrder()).salesperson).toBe("甜甜");
    expect(buildSalesDocument(salesOrder({ responsibleEmployee: null })).salesperson).toBe("来源员工");
    expect(buildSalesDocument(salesOrder({ responsibleEmployee: null, sourceEmployee: null })).salesperson).toBe("未分配");
  });

  it("only marks won orders with a sales date and complete prices as ready", () => {
    expect(buildSalesDocument(salesOrder()).ready).toBe(true);
    expect(buildSalesDocument(salesOrder({ status: "FOLLOWING" })).ready).toBe(false);
    expect(buildSalesDocument(salesOrder({ soldAt: null })).ready).toBe(false);
    const missingPrice = salesOrder(); missingPrice.items[0].salePrice = null as unknown as string;
    expect(buildSalesDocument(missingPrice).ready).toBe(false);
  });
});
