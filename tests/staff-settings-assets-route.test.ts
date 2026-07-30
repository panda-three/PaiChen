import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const upload = vi.fn();
  const remove = vi.fn();
  const getPublicUrl = vi.fn((path: string) => ({ data: { publicUrl: `https://example.supabase.co/storage/v1/object/public/customer-assets/${path}` } }));
  const from = vi.fn(() => ({ upload, remove, getPublicUrl }));
  return {
    getActiveStaff: vi.fn(),
    update: vi.fn(),
    writeAudit: vi.fn(),
    revalidatePath: vi.fn(),
    storage: { from },
    upload,
    remove,
  };
});

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/db", () => ({ db: { user: { update: mocks.update } } }));
vi.mock("@/lib/audit", () => ({ writeAudit: mocks.writeAudit }));
vi.mock("@/lib/staff-settings", () => ({ getActiveStaff: mocks.getActiveStaff }));
vi.mock("@/lib/customer-assets", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/customer-assets")>();
  return { ...original, customerAssetStorage: () => mocks.storage };
});

import { DELETE, POST } from "../app/api/staff/settings/assets/route";

const actor = {
  id: "user-1",
  storeId: "store-1",
  avatarUrl: "https://example.supabase.co/storage/v1/object/public/customer-assets/store-1/user-1/avatar-old.jpg",
  wechatQrUrl: "https://example.supabase.co/storage/v1/object/public/customer-assets/store-1/user-1/wechatQr-old.png",
  store: { slug: "demo" },
};

function uploadRequest(type: string | null = "wechatQr", mime = "image/png") {
  const form = new FormData();
  if (type) form.set("type", type);
  form.set("file", new File(["image"], "asset.png", { type: mime }));
  return new Request("http://localhost/api/staff/settings/assets", { method: "POST", body: form });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getActiveStaff.mockResolvedValue(actor);
  mocks.upload.mockResolvedValue({ error: null });
  mocks.remove.mockResolvedValue({ error: null });
  mocks.update.mockResolvedValue({});
});

describe("staff settings assets route", () => {
  it("keeps missing upload type backward-compatible with avatar", async () => {
    const response = await POST(uploadRequest(null, "image/jpeg"));

    expect(response.status).toBe(200);
    const path = mocks.upload.mock.calls[0][0] as string;
    expect(path).toMatch(/^store-1\/user-1\/avatar-.*\.jpg$/);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ data: { avatarUrl: expect.stringContaining(path) } }));
  });

  it("uploads a store-and-user-isolated QR, replaces the old object, and audits", async () => {
    const response = await POST(uploadRequest());

    expect(response.status).toBe(200);
    const path = mocks.upload.mock.calls[0][0] as string;
    expect(path).toMatch(/^store-1\/user-1\/wechatQr-.*\.png$/);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ data: { wechatQrUrl: expect.stringContaining(path) } }));
    expect(mocks.remove).toHaveBeenCalledWith(["store-1/user-1/wechatQr-old.png"]);
    expect(mocks.writeAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "APP 修改微信二维码", before: { wechatQrUrl: actor.wechatQrUrl } }));
  });

  it("removes the newly uploaded object when persistence fails", async () => {
    mocks.update.mockRejectedValueOnce(new Error("database unavailable"));

    await expect(POST(uploadRequest())).rejects.toThrow("database unavailable");

    const path = mocks.upload.mock.calls[0][0] as string;
    expect(mocks.remove).toHaveBeenCalledWith([path]);
    expect(mocks.writeAudit).not.toHaveBeenCalled();
  });

  it("deletes only the QR field and records the deletion", async () => {
    const request = new Request("http://localhost/api/staff/settings/assets", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "wechatQr" }) });

    const response = await DELETE(request);

    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: actor.id }, data: { wechatQrUrl: null } });
    expect(mocks.remove).toHaveBeenCalledWith(["store-1/user-1/wechatQr-old.png"]);
    expect(mocks.writeAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "APP 删除微信二维码", after: { wechatQrUrl: null } }));
  });

  it("keeps a missing delete type backward-compatible with avatar", async () => {
    const request = new Request("http://localhost/api/staff/settings/assets", { method: "DELETE" });

    const response = await DELETE(request);

    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: actor.id }, data: { avatarUrl: null } });
    expect(mocks.writeAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "APP 删除名片头像" }));
  });

  it("rejects unsupported types and files and requires staff authentication", async () => {
    expect((await POST(uploadRequest("unknown"))).status).toBe(400);
    expect((await POST(uploadRequest("wechatQr", "image/gif"))).status).toBe(400);
    const oversized = new FormData();
    oversized.set("type", "wechatQr");
    oversized.set("file", new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.png", { type: "image/png" }));
    expect((await POST(new Request("http://localhost/api/staff/settings/assets", { method: "POST", body: oversized }))).status).toBe(400);
    mocks.getActiveStaff.mockResolvedValueOnce(null);
    expect((await POST(uploadRequest())).status).toBe(401);
  });
});
