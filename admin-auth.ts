import NextAuth from "next-auth";
import { createAuthConfig } from "@/lib/create-auth-config";

export const { handlers, auth, signIn, signOut } = NextAuth(createAuthConfig("admin"));
