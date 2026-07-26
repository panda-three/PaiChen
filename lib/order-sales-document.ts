type Money = { toString(): string } | string | number | null;

export type SalesDocumentSource = {
  orderNo: string;
  status: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerRemark: string;
  shippingFee: Money;
  installationFee: Money;
  soldAt: Date | string | null;
  store: { name: string; logoUrl: string | null; address: string };
  sourceEmployee: { name: string } | null;
  responsibleEmployee: { name: string } | null;
  items: Array<{
    id: string;
    productName: string;
    imageUrl: string;
    specification: string;
    color: string;
    quantity: number;
    unit: string;
    salePrice: Money;
    remark: string;
  }>;
};

function moneyToCents(value: Money) {
  if (value == null || value === "") return null;
  const amount = Number(value.toString());
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
}

export function buildSalesDocument(order: SalesDocumentSource) {
  const items = order.items.map((item, index) => {
    const salePriceCents = moneyToCents(item.salePrice);
    return {
      ...item,
      sequence: index + 1,
      salePriceCents,
      amountCents: salePriceCents == null ? null : salePriceCents * item.quantity,
    };
  });
  const productAmountCents = items.reduce((total, item) => total + (item.amountCents ?? 0), 0);
  const shippingFeeCents = moneyToCents(order.shippingFee) ?? 0;
  const installationFeeCents = moneyToCents(order.installationFee) ?? 0;
  return {
    ...order,
    items,
    salesperson: order.responsibleEmployee?.name ?? order.sourceEmployee?.name ?? "未分配",
    totalQuantity: items.reduce((total, item) => total + item.quantity, 0),
    productAmountCents,
    shippingFeeCents,
    installationFeeCents,
    payableAmountCents: productAmountCents + shippingFeeCents + installationFeeCents,
    ready: order.status === "WON" && order.soldAt != null && items.every((item) => item.salePriceCents != null),
  };
}

export function centsToNumber(cents: number) {
  return cents / 100;
}

export function formatSalesMoney(cents: number | null) {
  if (cents == null) return "待补充";
  return `¥${centsToNumber(cents).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
