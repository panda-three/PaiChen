import "next-auth";

declare module "next-auth" {
  interface User {
    role: "PLATFORM_ADMIN" | "STORE_ADMIN" | "EMPLOYEE";
    storeId: string | null;
  }

  interface Session {
    user: {
      id: string;
      name?: string | null;
      role: "PLATFORM_ADMIN" | "STORE_ADMIN" | "EMPLOYEE";
      storeId: string | null;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    userId?: string;
    role?: "PLATFORM_ADMIN" | "STORE_ADMIN" | "EMPLOYEE";
    storeId?: string | null;
  }
}
