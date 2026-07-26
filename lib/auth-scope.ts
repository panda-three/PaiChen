import { CustomerStatus, Role } from "@prisma/client";

export type AuthScope = "customer" | "admin";

export const CUSTOMER_AUTH_BASE_PATH = "/api/auth";
export const ADMIN_AUTH_BASE_PATH = "/api/admin-auth";

export function isAccountAllowed(scope: AuthScope, role: Role, customerStatus: CustomerStatus | null) {
  if (scope === "customer") return role === Role.CUSTOMER && customerStatus === CustomerStatus.ACTIVE;
  return role !== Role.CUSTOMER;
}

export function authCookieNames(scope: AuthScope) {
  const prefix = `authjs.${scope}`;
  return {
    sessionToken: { name: `${prefix}.session-token` },
    callbackUrl: { name: `${prefix}.callback-url` },
    csrfToken: { name: `${prefix}.csrf-token` },
    pkceCodeVerifier: { name: `${prefix}.pkce.code-verifier` },
    state: { name: `${prefix}.state` },
    nonce: { name: `${prefix}.nonce` },
    webauthnChallenge: { name: `${prefix}.challenge` },
  };
}
