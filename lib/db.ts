import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function runtimeDatabaseUrl(value: string | undefined) {
  if (!value) return value;
  const url = new URL(value);
  if (url.port === "6543") {
    if (!url.searchParams.has("pgbouncer")) url.searchParams.set("pgbouncer", "true");
    if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", "1");
  }
  return url.toString();
}

export const db = globalForPrisma.prisma ?? new PrismaClient({ datasources: { db: { url: runtimeDatabaseUrl(process.env.DATABASE_URL) } } });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
