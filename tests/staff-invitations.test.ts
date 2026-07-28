import { Role } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { invitationUnavailable, invitedRoleForActor, maskPhone, staffRegistrationSchema, tokenHash } from "../lib/staff-invitations";
import { staffProfileSettingsSchema } from "../lib/validation";

describe("staff invitations", () => {
  it("maps issuer roles without trusting a client role", () => {
    expect(invitedRoleForActor(Role.STORE_ADMIN)).toBe(Role.EMPLOYEE);
    expect(invitedRoleForActor(Role.PLATFORM_ADMIN)).toBe(Role.STORE_ADMIN);
    expect(invitedRoleForActor(Role.EMPLOYEE)).toBeNull();
  });

  it("rejects expired, revoked and used invitations", () => {
    const future = new Date("2030-01-01T00:00:00Z");
    const past = new Date("2020-01-01T00:00:00Z");
    expect(invitationUnavailable({ expiresAt: future, usedAt: null, revokedAt: null }, past)).toBeNull();
    expect(invitationUnavailable({ expiresAt: past, usedAt: null, revokedAt: null }, future)).toContain("过期");
    expect(invitationUnavailable({ expiresAt: future, usedAt: future, revokedAt: null }, past)).toContain("使用");
    expect(invitationUnavailable({ expiresAt: future, usedAt: null, revokedAt: future }, past)).toContain("撤销");
  });

  it("binds phone and never exposes a raw token hash", () => {
    expect(maskPhone("13812345678")).toBe("138****5678");
    expect(tokenHash("secret")).not.toContain("secret");
    expect(staffRegistrationSchema.safeParse({ invite:"x".repeat(32), name:"员工", username:"staff-1", phone:"13812345678", password:"password-123", role:Role.PLATFORM_ADMIN }).success).toBe(false);
  });
});

describe("staff card settings", () => {
  it("applies card field limits", () => {
    expect(staffProfileSettingsSchema.safeParse({ name:"员工", phone:"13812345678", wechat:"wx-1", title:"顾问", bio:"专业服务" }).success).toBe(true);
    expect(staffProfileSettingsSchema.safeParse({ name:"员工", phone:"123", wechat:"", title:"x".repeat(31), bio:"x".repeat(91) }).success).toBe(false);
  });
});
