import { z } from "zod";
export { parsePageConfig, sanitizeRichText } from "./page-config";

export const publicOrderSchema = z.object({
  storeSlug: z.string().min(1),
  ref: z.string().optional().nullable(),
  clientRequestId: z.string().uuid(),
  customerName: z.string().trim().max(50).optional().default(""),
  customerPhone: z.string().trim().regex(/^1\d{10}$/, "请输入正确的手机号").optional().default(""),
  customerAddress: z.string().trim().max(200).default(""),
  customerRemark: z.string().trim().max(500).default(""),
  logisticsName: z.string().trim().max(100).default(""),
  logisticsAddress: z.string().trim().max(200).default(""),
  logisticsPhone: z.string().trim().max(30).default(""),
  shippingFee: z.coerce.number().min(0).max(99999999).default(0),
  installationFee: z.coerce.number().min(0).max(99999999).default(0),
  items: z.array(z.object({ productId: z.string().min(1), variantId: z.string().min(1).optional().nullable(), quantity: z.number().int().min(1).max(999), remark: z.string().trim().max(200).default("") })).min(1, "至少选择一件商品"),
});

export const customerRegistrationSchema = z.object({
  storeSlug: z.string().min(1),
  ref: z.string().optional().nullable(),
  name: z.string().trim().min(1).max(50),
  phone: z.string().trim().regex(/^1\d{10}$/, "请输入正确的手机号"),
  password: z.string().min(8, "密码至少 8 个字符").max(72),
});

export const customerProfileSettingsSchema = z.object({
  storeSlug: z.string().min(1),
  name: z.string().trim().min(1, "昵称不能为空").max(50),
  phone: z.string().trim().regex(/^1\d{10}$/, "请输入正确的本店联系电话"),
  currentPassword: z.string().min(1).max(72).optional(),
}).strict();

export const cardWechatSchema = z.string().trim().min(1, "请填写真实微信号").max(50, "微信号不能超过 50 个字符");

export const customerPasswordSettingsSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "新密码至少 8 个字符").max(72),
});

export const staffProfileSettingsSchema = z.object({
  name: z.string().trim().min(1, "姓名不能为空").max(50),
  phone: z.string().trim().regex(/^1\d{10}$/, "请输入正确的联系电话"),
  wechat: cardWechatSchema,
  title: z.string().trim().max(30, "职位不能超过 30 个字符"),
  bio: z.string().trim().max(90, "简介不能超过 90 个字符"),
}).strict();

export const behaviorEventSchema = z.object({
  storeSlug: z.string().min(1), sessionId: z.string().uuid(), eventId: z.string().uuid(),
  type: z.enum(["PAGE_VIEW", "PRODUCT_VIEW", "FAVORITE", "CART_ADD", "ORDER_SUBMIT"]),
  productId: z.string().optional().nullable(), pageSlug: z.string().max(60).optional().nullable(), ref: z.string().max(100).optional().nullable(),
});

export function isIntentCustomer(events: { type: string; productId?: string | null }[]) {
  if (events.some((event) => event.type === "FAVORITE")) return { intent: true, reason: "近 30 天收藏过商品" };
  if (events.some((event) => event.type === "CART_ADD")) return { intent: true, reason: "近 30 天加入过开单" };
  const views = new Map<string, number>();
  for (const event of events) if (event.type === "PRODUCT_VIEW" && event.productId) views.set(event.productId, (views.get(event.productId) ?? 0) + 1);
  if ([...views.values()].some((count) => count >= 3)) return { intent: true, reason: "同一商品近 30 天浏览达到 3 次" };
  return { intent: false, reason: "" };
}

export function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
