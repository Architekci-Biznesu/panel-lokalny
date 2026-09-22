"use server";

import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { AuthError } from "next-auth";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";
import { z } from "zod";
import { signIn, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import { accounts, users } from "@/lib/db/schema";

const registerSchema = z.object({
  name: z.string().trim().min(2, "Podaj imię i nazwisko"),
  email: z.string().trim().email("Nieprawidłowy e-mail"),
  password: z.string().min(8, "Hasło musi mieć min. 8 znaków"),
});

const loginSchema = z.object({
  email: z.string().trim().email("Nieprawidłowy e-mail"),
  password: z.string().min(1, "Podaj hasło"),
});

/** bcrypt cost - 10 is OWASP-acceptable and ~4x faster than 12 on slow CI/dev. */
const BCRYPT_ROUNDS = 10;

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function registerAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Błąd walidacji" };
  }

  const email = parsed.data.email.toLowerCase();

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    return { ok: false, error: "Konto z tym e-mailem już istnieje" };
  }

  const passwordHash = await hash(parsed.data.password, BCRYPT_ROUNDS);

  await db.transaction(async (tx) => {
    const [account] = await tx
      .insert(accounts)
      .values({ email })
      .returning({ id: accounts.id });

    await tx.insert(users).values({
      accountId: account.id,
      email,
      name: parsed.data.name,
      passwordHash,
      role: "owner",
    });
  });

  try {
    await signIn("credentials", {
      email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    if (error instanceof AuthError) {
      return {
        ok: false,
        error: "Konto utworzone, ale logowanie nie powiodło się",
      };
    }
    throw error;
  }

  redirect("/onboarding");
}

export async function loginAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Błąd walidacji" };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email.toLowerCase(),
      password: parsed.data.password,
      redirect: false,
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    if (error instanceof AuthError) {
      return { ok: false, error: "Nieprawidłowy e-mail lub hasło" };
    }
    throw error;
  }

  redirect("/pulpit");
}

export async function logoutAction() {
  await signOut({ redirectTo: "/logowanie" });
}
