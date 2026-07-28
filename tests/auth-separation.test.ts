import { describe, expect, it } from "vitest";
import { CustomerStatus, Role } from "@prisma/client";
import { ADMIN_AUTH_BASE_PATH, authCookieNames, CUSTOMER_AUTH_BASE_PATH, isAccountAllowed } from "../lib/auth-scope";

describe("customer and admin authentication separation", () => {
  it("allows each account role only through its own login", () => {
    expect(isAccountAllowed("customer", Role.CUSTOMER, CustomerStatus.ACTIVE)).toBe(true);
    expect(isAccountAllowed("customer", Role.CUSTOMER, CustomerStatus.PENDING)).toBe(false);
    expect(isAccountAllowed("customer", Role.STORE_ADMIN, null)).toBe(true);
    expect(isAccountAllowed("customer", Role.EMPLOYEE, null)).toBe(true);
    expect(isAccountAllowed("customer", Role.PLATFORM_ADMIN, null)).toBe(false);
    expect(isAccountAllowed("customer", Role.ENTERPRISE_ADMIN, null)).toBe(false);
    expect(isAccountAllowed("admin", Role.CUSTOMER, CustomerStatus.ACTIVE)).toBe(false);
    expect(isAccountAllowed("admin", Role.PLATFORM_ADMIN, null)).toBe(true);
    expect(isAccountAllowed("admin", Role.ENTERPRISE_ADMIN, null)).toBe(true);
    expect(isAccountAllowed("admin", Role.STORE_ADMIN, null)).toBe(true);
    expect(isAccountAllowed("admin", Role.EMPLOYEE, null)).toBe(true);
  });

  it("uses different API endpoints and cookie names", () => {
    expect(CUSTOMER_AUTH_BASE_PATH).toBe("/api/auth");
    expect(ADMIN_AUTH_BASE_PATH).toBe("/api/admin-auth");
    const customerCookies = Object.values(authCookieNames("customer")).map((cookie) => cookie.name);
    const adminCookies = Object.values(authCookieNames("admin")).map((cookie) => cookie.name);
    expect(customerCookies).not.toContain(adminCookies[0]);
    expect(new Set([...customerCookies, ...adminCookies]).size).toBe(customerCookies.length + adminCookies.length);
  });
});
