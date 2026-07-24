import { z } from "zod";

export const publicOrderSchema = z.object({
  storeSlug: z.string().min(1),
  ref: z.string().optional().nullable(),
  clientRequestId: z.string().uuid(),
  customerName: z.string().trim().min(1, "请填写客户姓名").max(50),
  customerPhone: z.string().trim().regex(/^1\d{10}$/, "请输入正确的手机号"),
  customerAddress: z.string().trim().max(200).default(""),
  customerRemark: z.string().trim().max(500).default(""),
  items: z.array(z.object({ productId: z.string().min(1), quantity: z.number().int().min(1).max(999) })).min(1, "至少选择一件商品"),
});

export function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
