"use client";

import { SessionProvider } from "next-auth/react";

export function AuthEndpointProvider({ basePath, children }: { basePath: string; children: React.ReactNode }) {
  return <SessionProvider basePath={basePath} session={null}>{children}</SessionProvider>;
}
