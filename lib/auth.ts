import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { profiles, users } from "@/lib/db/schema";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const email = parsed.data.email.toLowerCase();
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (!user) return null;

        const valid = await compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        const [profile] = await db
          .select({ id: profiles.id })
          .from(profiles)
          .where(eq(profiles.accountId, user.accountId))
          .limit(1);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          accountId: user.accountId,
          activeProfileId: profile?.id ?? null,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/logowanie",
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id!;
        token.accountId = user.accountId;
        token.activeProfileId = user.activeProfileId;
      }

      if (trigger === "update" && session) {
        const nextProfileId =
          "user" in session && session.user && "activeProfileId" in session.user
            ? session.user.activeProfileId
            : "activeProfileId" in session
              ? (session as { activeProfileId?: string | null }).activeProfileId
              : undefined;

        if (nextProfileId !== undefined) {
          token.activeProfileId = nextProfileId ?? null;
        }
      }

      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.accountId = token.accountId as string;
      session.user.activeProfileId = (token.activeProfileId as string | null) ?? null;
      return session;
    },
  },
  trustHost: true,
});
