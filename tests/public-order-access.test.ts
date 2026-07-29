import { Role } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { resolveOrderAccess } from "../lib/public-order-access";

describe("public order access", () => {
  const storeId = "store-1";

  it.each([
    ["anonymous", null, false, "anonymous"],
    ["active customer", { role: Role.CUSTOMER, storeId: null }, true, "customer"],
    ["same-store employee", { role: Role.EMPLOYEE, storeId }, false, "employee"],
    ["same-store admin", { role: Role.STORE_ADMIN, storeId }, false, "storeAdmin"],
    ["cross-store employee", { role: Role.EMPLOYEE, storeId: "other" }, false, "forbidden"],
  ] as const)("resolves %s", (_label, user, customerActive, expected) => {
    expect(resolveOrderAccess(user, storeId, customerActive)).toBe(expected);
  });

  it("forbids inactive customer profiles and non-APP business roles", () => {
    expect(resolveOrderAccess({ role: Role.CUSTOMER, storeId: null }, storeId, false)).toBe("forbidden");
    expect(resolveOrderAccess({ role: Role.PLATFORM_ADMIN, storeId: null }, storeId, false)).toBe("forbidden");
    expect(resolveOrderAccess(null, storeId, false, true)).toBe("forbidden");
  });
});
