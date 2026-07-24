import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";

const credentialsSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  providers: [
    Credentials({
      credentials: {
        username: { label: "账号", type: "text" },
        password: { label: "密码", type: "password" },
      },
      authorize: async (raw) => {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const user = await db.user.findUnique({
          where: { username: parsed.data.username },
          include: { store: true },
        });
        if (!user || !user.isActive || (user.store && !user.store.isActive)) return null;
        if (!(await compare(parsed.data.password, user.passwordHash))) return null;
        return { id: user.id, name: user.name, role: user.role, storeId: user.storeId };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.role = user.role;
        token.storeId = user.storeId;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.userId as string;
      session.user.role = token.role as "PLATFORM_ADMIN" | "STORE_ADMIN" | "EMPLOYEE";
      session.user.storeId = (token.storeId as string | null) ?? null;
      return session;
    },
  },
});
