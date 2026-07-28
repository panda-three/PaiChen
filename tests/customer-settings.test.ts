import { CustomerStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { customerAssetPath, customerAssetType, storagePathFromPublicUrl } from "../lib/customer-assets";
import { customerRegistrationBlock } from "../lib/customer-registration";
import { CUSTOMER_SESSION_MAX_AGE_MS, isCustomerSessionActive, shouldTouchCustomerSession } from "../lib/customer-session";
import { resolveHomeCard } from "../lib/home-card";
import { customerPasswordSettingsSchema, customerProfileSettingsSchema } from "../lib/validation";

describe("customer registration activation policy", () => {
  it("activates new and pending customers without unblocking rejected or reset accounts", () => {
    expect(customerRegistrationBlock(null)).toBeNull();
    expect(customerRegistrationBlock(CustomerStatus.PENDING)).toBeNull();
    expect(customerRegistrationBlock(CustomerStatus.ACTIVE)).toBeNull();
    expect(customerRegistrationBlock(CustomerStatus.REJECTED)).toContain("拒绝");
    expect(customerRegistrationBlock(CustomerStatus.RESET_PENDING)).toContain("密码重置");
  });
});

describe("customer settings validation", () => {
  it("rejects invalid contact data and weak passwords", () => {
    expect(customerProfileSettingsSchema.safeParse({ storeSlug:"demo", name:"张先生", phone:"123" }).success).toBe(false);
    expect(customerPasswordSettingsSchema.safeParse({ currentPassword:"old-password", newPassword:"short" }).success).toBe(false);
  });

  it("accepts store-scoped profile and service fields", () => {
    expect(customerProfileSettingsSchema.safeParse({ storeSlug:"demo", name:"张先生", phone:"13800000000", servicePhone:"0512-123456", serviceWechat:"service-demo", cardTitle:"空间顾问", cardBio:"全屋选品" }).success).toBe(true);
  });

  it("uses active store profile for the home card without consulting ref", () => {
    const fallback={name:"默认名片",phone:"400",wechat:null,title:"顾问",bio:"默认简介",avatarUrl:null};
    const profile={name:"张先生",phone:"13800000000",avatarUrl:"https://example.com/a.jpg",servicePhone:"0512-123456",serviceWechat:"wx-demo",serviceQrUrl:null,cardTitle:"空间顾问",cardBio:"全屋选品"};
    expect(resolveHomeCard(fallback,profile)).toMatchObject({name:"张先生",phone:"0512-123456",title:"空间顾问",bio:"全屋选品"});
    expect(resolveHomeCard(fallback,null)).toBe(fallback);
  });
});

describe("customer device sessions", () => {
  const now = new Date("2026-07-28T08:00:00.000Z");
  it("keeps an eight hour session and rejects expired, revoked, or cross-account sessions", () => {
    expect(CUSTOMER_SESSION_MAX_AGE_MS).toBe(8 * 60 * 60 * 1000);
    const active = { customerId:"c1", revokedAt:null, expiresAt:new Date(now.getTime()+1000) };
    expect(isCustomerSessionActive(active,"c1",now)).toBe(true);
    expect(isCustomerSessionActive({...active,expiresAt:now},"c1",now)).toBe(false);
    expect(isCustomerSessionActive({...active,revokedAt:now},"c1",now)).toBe(false);
    expect(isCustomerSessionActive(active,"c2",now)).toBe(false);
  });

  it("touches recent activity at most once per five minutes", () => {
    expect(shouldTouchCustomerSession(new Date(now.getTime()-299999),now)).toBe(false);
    expect(shouldTouchCustomerSession(new Date(now.getTime()-300000),now)).toBe(true);
  });
});

describe("customer assets", () => {
  it("accepts only known asset slots and produces store/customer scoped paths", () => {
    expect(customerAssetType("avatar")).toBe("avatar");
    expect(customerAssetType("other")).toBeNull();
    expect(customerAssetPath("s1","c1","serviceQr","image/webp")).toMatch(/^s1\/c1\/serviceQr-[\w-]+\.webp$/);
  });

  it("only parses paths from the customer assets public bucket", () => {
    expect(storagePathFromPublicUrl("https://demo.supabase.co/storage/v1/object/public/customer-assets/s1/c1/avatar-a.jpg")).toBe("s1/c1/avatar-a.jpg");
    expect(storagePathFromPublicUrl("https://example.com/avatar.jpg")).toBeNull();
  });
});
