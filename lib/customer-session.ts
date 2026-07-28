export const CUSTOMER_SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;
export const CUSTOMER_SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export function isCustomerSessionActive(session: { customerId:string; revokedAt:Date|null; expiresAt:Date }, customerId:string, now:Date) {
  return session.customerId === customerId && session.revokedAt === null && session.expiresAt.getTime() > now.getTime();
}

export function shouldTouchCustomerSession(lastActiveAt:Date, now:Date) {
  return now.getTime() - lastActiveAt.getTime() >= CUSTOMER_SESSION_TOUCH_INTERVAL_MS;
}
