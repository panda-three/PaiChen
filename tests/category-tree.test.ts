import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { activeSecondLevelCategories, categoryPath, categoryProductMatches } from "@/lib/category-tree";
import { resolveHomeCard } from "@/lib/home-card";
import { importCategoryLookup } from "@/lib/product-import";

describe("category tree semantics", () => {
  const categories = [{ id: "r1", name: "客厅", parentId: null, isActive: true }, { id: "c1", name: "其他", parentId: "r1", isActive: true }, { id: "r2", name: "卧室", parentId: null, isActive: false }, { id: "c2", name: "其他", parentId: "r2", isActive: true }];
  it("aggregates a root and resolves an exact child", () => { expect(categoryProductMatches("r1", "c1", "r1")).toBe(true); expect(categoryProductMatches("c1", "c1", "r1")).toBe(true); expect(categoryProductMatches("c2", "c1", "r1")).toBe(false); });
  it("hides children of disabled roots and renders paths", () => { expect(activeSecondLevelCategories(categories).map((item) => item.id)).toEqual(["c1"]); expect(categoryPath(categories[1], categories)).toBe("客厅 / 其他"); });
  it("accepts paths and only globally unique child names", () => { const lookup = importCategoryLookup(categories); expect(lookup.get("客厅/其他")).toBe("c1"); expect(lookup.has("其他")).toBe(true); });
  it("requires a path when active roots repeat a child name", () => { const lookup = importCategoryLookup([{ id: "a", name: "客厅", parentId: null, isActive: true }, { id: "b", name: "卧室", parentId: null, isActive: true }, { id: "x", name: "其他", parentId: "a", isActive: true }, { id: "y", name: "其他", parentId: "b", isActive: true }]); expect(lookup.has("其他")).toBe(false); expect(lookup.get("卧室/其他")).toBe("y"); });
});

describe("home card completeness", () => {
  const fallback = { name: "店铺", phone: null, wechat: "store", wechatQrUrl: "/store.png", title: null, bio: null, avatarUrl: null };
  const user = { ...fallback, name: "顾问", wechat: "staff", wechatQrUrl: "/staff.png", role: Role.EMPLOYEE };
  it("uses a complete personal card", () => expect(resolveHomeCard(fallback, user).name).toBe("顾问"));
  it("falls back when either personal WeChat field is missing", () => expect(resolveHomeCard(fallback, { ...user, wechatQrUrl: null }).name).toBe("店铺"));
});
