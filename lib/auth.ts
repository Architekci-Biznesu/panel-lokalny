import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { accounts, profiles, users } from "@/lib/db/schema";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

async function resolveOwnProfileId(
  accountId: string,
  candidate: string | null | undefined,
): Promise<string | null> {
  if (!candidate) return null;
  const [profile] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(and(eq(profiles.id, candidate), eq(profiles.accountId, accountId)))
    .limit(1);
  return profile?.id ?? null;
}

async function profileExists(profileId: string): Promise<boolean> {
  const [profile] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .limit(1);
  return !!profile;
}

async function isStaffUserId(userId: string | undefined): Promise<boolean> {
  if (!userId) return false;
  const [user] = await db
    .select({ isStaff: users.isStaff })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user?.isStaff === true;
}

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

        await db
          .update(accounts)
          .set({ lastActiveAt: new Date() })
          .where(eq(accounts.id, user.accountId));

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
        token.adminImpersonating = false;
      }

      if (trigger === "update" && session) {
        const payload = session as {
          activeProfileId?: string | null;
          adminImpersonating?: boolean;
          user?: {
            activeProfileId?: string | null;
            adminImpersonating?: boolean;
          };
        };

        const nextProfileId =
          payload.activeProfileId !== undefined
            ? payload.activeProfileId
            : payload.user?.activeProfileId;

        if (nextProfileId !== undefined) {
          token.activeProfileId = nextProfileId;
        }

        const nextAdmin =
          payload.adminImpersonating !== undefined
            ? payload.adminImpersonating
            : payload.user?.adminImpersonating;

        if (nextAdmin !== undefined) {
          token.adminImpersonating = nextAdmin;
        }
      }

      const impersonating = token.adminImpersonating === true;

      if (impersonating) {
        const stillStaff = await isStaffUserId(token.id as string | undefined);
        if (!stillStaff) {
          token.adminImpersonating = false;
          token.activeProfileId = await resolveOwnProfileId(
            token.accountId as string,
            token.activeProfileId as string | null,
          );
        } else if (token.activeProfileId) {
          const exists = await profileExists(token.activeProfileId as string);
          if (!exists) {
            token.activeProfileId = null;
            token.adminImpersonating = false;
          }
        } else {
          token.adminImpersonating = false;
        }
      } else if (token.activeProfileId && token.accountId) {
        token.activeProfileId = await resolveOwnProfileId(
          token.accountId as string,
          token.activeProfileId as string,
        );
      }

      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.accountId = token.accountId as string;
      session.user.activeProfileId =
        (token.activeProfileId as string | null) ?? null;
      session.user.adminImpersonating = token.adminImpersonating === true;
      return session;
    },
  },
  trustHost: true,
});
