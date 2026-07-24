import { OrderStatus } from "@prisma/client";

export const statusLabel: Record<OrderStatus, string> = {
  PENDING: "待跟进",
  FOLLOWING: "跟进中",
  WON: "已成交",
  LOST: "未成交",
};

export function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(value));
}

export function formatPrice(value: { toString(): string } | number | null) {
  if (value == null) return "面议";
  return `¥${Number(value).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
