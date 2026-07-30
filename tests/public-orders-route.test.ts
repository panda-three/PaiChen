import { Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const auth = vi.fn();
  const tx = {
    lead: { upsert: vi.fn() },
    customerAttribution: { updateMany: vi.fn(), create: vi.fn() },
    order: { create: vi.fn() },
    behaviorEvent: { create: vi.fn() },
  };
  const db = {
    user: { findFirst: vi.fn() },
    store: { findUnique: vi.fn() },
    customerProfile: { findFirst: vi.fn() },
    order: { findUnique: vi.fn() },
    product: { findMany: vi.fn() },
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  };
  return { auth, db, tx };
});

vi.mock("@/customer-auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/deployment-scope", () => ({ canAccessPublicStore: () => true }));

import { POST } from "../app/api/public/orders/route";

const store = { id: "store-1", slug: "demo", phone: "4008001234", isActive: true, customerEnabled: true };
const product = { id: "product-1", name: "沙发", code: "P1", mainImageUrl: "/p1.jpg", specification: "", unit: "件", price: "100", variants: [] };
const baseBody = {
  storeSlug: "demo",
  ref: "shared-employee",
  clientRequestId: "00000000-0000-4000-8000-000000000001",
  customerName: "代客姓名",
  customerPhone: "13800000000",
  customerAddress: "",
  customerRemark: "",
  logisticsName: "",
  logisticsAddress: "",
  logisticsPhone: "",
  shippingFee: 0,
  installationFee: 0,
  items: [{ productId: "product-1", variantId: null, quantity: 1, remark: "" }],
};

function request(body: object = baseBody) {
  return new Request("http://localhost/api/public/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

function actor(role: Role, overrides: object = {}) {
  return { id: `${role.toLowerCase()}-1`, role, storeId: role === Role.CUSTOMER ? null : store.id, isActive: true, ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.db.store.findUnique.mockResolvedValue(store);
  mocks.db.order.findUnique.mockResolvedValue(null);
  mocks.db.product.findMany.mockResolvedValue([product]);
  mocks.tx.lead.upsert.mockResolvedValue({ id: "lead-1" });
  mocks.tx.order.create.mockImplementation(async ({ data }) => ({ ...data, orderNo: "YC-1" }));
});

describe("public order route", () => {
  it("assigns employee assisted orders to the signed-in employee and ignores ref", async () => {
    const employee = actor(Role.EMPLOYEE);
    mocks.auth.mockResolvedValue({ user: { id: employee.id, role: employee.role, storeId: employee.storeId } });
    mocks.db.user.findFirst.mockResolvedValue(employee);

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.db.user.findFirst).toHaveBeenCalledTimes(1);
    expect(mocks.tx.order.create.mock.calls[0][0].data).toMatchObject({ customerId: null, appSubmitterId: employee.id, sourceEmployeeId: employee.id, responsibleEmployeeId: employee.id, customerName: "代客姓名", customerPhone: "13800000000" });
    expect(mocks.tx.lead.upsert.mock.calls[0][0].create.latestEmployeeId).toBe(employee.id);
  });

  it("keeps store-admin assisted orders on the store default", async () => {
    const admin = actor(Role.STORE_ADMIN);
    mocks.auth.mockResolvedValue({ user: { id: admin.id, role: admin.role, storeId: admin.storeId } });
    mocks.db.user.findFirst.mockResolvedValue(admin);

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.tx.order.create.mock.calls[0][0].data).toMatchObject({ customerId: null, appSubmitterId: admin.id, sourceEmployeeId: null, responsibleEmployeeId: null });
    expect(mocks.tx.lead.upsert.mock.calls[0][0].create.latestEmployeeId).toBeUndefined();
  });

  it("preserves customer profile and ref attribution", async () => {
    const customer = actor(Role.CUSTOMER, { phone: "13900000000", customerStatus: "ACTIVE" });
    const source = actor(Role.EMPLOYEE, { id: "employee-ref" });
    mocks.auth.mockResolvedValue({ user: { id: customer.id, role: customer.role, storeId: null } });
    mocks.db.user.findFirst.mockImplementation(async ({ where }) => where.id ? customer : source);
    mocks.db.customerProfile.findFirst.mockResolvedValue({ name: "客户本人", phone: "13900000000" });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.tx.order.create.mock.calls[0][0].data).toMatchObject({ customerId: customer.id, appSubmitterId: customer.id, sourceEmployeeId: source.id, responsibleEmployeeId: source.id, customerName: "客户本人", customerPhone: "13900000000" });
    expect(mocks.tx.customerAttribution.create).toHaveBeenCalledOnce();
  });

  it("rejects cross-store staff and missing assisted-customer details", async () => {
    const employee = actor(Role.EMPLOYEE, { storeId: "other-store" });
    mocks.auth.mockResolvedValue({ user: { id: employee.id, role: employee.role, storeId: employee.storeId } });
    mocks.db.user.findFirst.mockResolvedValue(employee);
    expect((await POST(request())).status).toBe(403);

    mocks.db.user.findFirst.mockResolvedValue(actor(Role.EMPLOYEE));
    const invalid = { ...baseBody, customerName: "", customerPhone: "" };
    expect((await POST(request(invalid))).status).toBe(400);
  });

  it("returns an employee's existing order on an idempotent retry", async () => {
    const employee = actor(Role.EMPLOYEE);
    mocks.auth.mockResolvedValue({ user: { id: employee.id, role: employee.role, storeId: employee.storeId } });
    mocks.db.user.findFirst.mockResolvedValue(employee);
    mocks.db.order.findUnique.mockResolvedValue({ orderNo: "YC-existing", storeId: store.id, customerId: null, appSubmitterId: employee.id, sourceEmployeeId: employee.id, responsibleEmployeeId: employee.id });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ orderNo: "YC-existing" });
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });

  it("rejects an idempotency key owned by another APP account", async () => {
    const admin = actor(Role.STORE_ADMIN);
    mocks.auth.mockResolvedValue({ user: { id: admin.id, role: admin.role, storeId: admin.storeId } });
    mocks.db.user.findFirst.mockResolvedValue(admin);
    mocks.db.order.findUnique.mockResolvedValue({ orderNo: "YC-existing", storeId: store.id, customerId: null, appSubmitterId: "other-user" });

    const response = await POST(request());

    expect(response.status).toBe(409);
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });
});
