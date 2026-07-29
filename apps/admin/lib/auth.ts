import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { getSql } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      const email = user.email;
      if (!email) return false;
      const sql = getSql();
      const rows = await sql`
        SELECT 1 FROM auth_allowlist WHERE email = ${email} LIMIT 1
      `;
      return rows.length > 0;
    },
    async session({ session, token }) {
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
});
