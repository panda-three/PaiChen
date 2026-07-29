import { Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const requireActor = vi.fn();
  const redirect = vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); });
  const tx = {
    storePage: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  };
  const db = {
    storePage: { findFirst: vi.fn() },
    category: { findMany: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  };
  return { requireActor, redirect, tx, db };
});

vi.mock("@/lib/authz", () => ({ requireActor: mocks.requireActor }));
vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { applyLiangchenHomeTemplate } from "../app/admin/phase-one-actions";

function form(id = "home-1") {
  const data = new FormData();
  data.set("id", id);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireActor.mockResolvedValue({ id: "admin-1", role: Role.STORE_ADMIN, storeId: "store-1" });
  mocks.db.category.findMany.mockResolvedValue([{ id: "category-1" }]);
  mocks.tx.storePage.findMany.mockResolvedValue([{ id: "existing-brand", slug: "brand-story" }]);
  let created = 0;
  mocks.tx.storePage.create.mockImplementation(async ({ data }) => ({ ...data, id: `created-${++created}` }));
});

describe("applyLiangchenHomeTemplate", () => {
  it("applies to another store's homepage without publishing or overwriting existing content pages", async () => {
    mocks.db.storePage.findFirst.mockResolvedValue({ id: "home-1", storeId: "store-1", isHome: true, draftJson: "old-draft", publishedJson: "live-version", store: { slug: "another-store" } });

    await expect(applyLiangchenHomeTemplate(form())).rejects.toThrow("REDIRECT:/admin/pages/home-1?notice=");

    expect(mocks.tx.storePage.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ storeId: "store-1" }) }));
    expect(mocks.tx.storePage.create).toHaveBeenCalledTimes(4);
    for (const [call] of mocks.tx.storePage.create.mock.calls) expect(call.data.storeId).toBe("store-1");
    expect(mocks.tx.storePage.update).toHaveBeenCalledOnce();
    const update = mocks.tx.storePage.update.mock.calls[0][0];
    expect(update.where).toEqual({ id: "home-1" });
    expect(update.data).toEqual({ draftJson: expect.any(String) });
    expect(update.data).not.toHaveProperty("publishedJson");
    expect(JSON.parse(update.data.draftJson).components).toEqual(expect.any(Array));
  });

  it("rejects ordinary pages on the server", async () => {
    mocks.db.storePage.findFirst.mockResolvedValue({ id: "page-1", storeId: "store-1", isHome: false, store: { slug: "another-store" } });

    await expect(applyLiangchenHomeTemplate(form("page-1"))).rejects.toThrow(encodeURIComponent("请在当前主页上应用良丞首页模板"));
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });
});
