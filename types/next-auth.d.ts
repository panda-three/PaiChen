import "next-auth";

declare module "next-auth" {
  interface User {
    role: "PLATFORM_ADMIN" | "ENTERPRISE_ADMIN" | "STORE_ADMIN" | "EMPLOYEE" | "CUSTOMER";
    storeId: string | null;
    enterpriseId: string | null;
  }

  interface Session {
    user: {
      id: string;
      name?: string | null;
      role: "PLATFORM_ADMIN" | "ENTERPRISE_ADMIN" | "STORE_ADMIN" | "EMPLOYEE" | "CUSTOMER";
      storeId: string | null;
      enterpriseId: string | null;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    userId?: string;
    role?: "PLATFORM_ADMIN" | "ENTERPRISE_ADMIN" | "STORE_ADMIN" | "EMPLOYEE" | "CUSTOMER";
    storeId?: string | null;
    enterpriseId?: string | null;
  }
}
