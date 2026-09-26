"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { profileBriefs } from "@/lib/db/schema";
import { getActiveProfile } from "@/lib/session";

const briefSchema = z.object({
  services: z.string().trim().min(1, "Podaj usługi").max(4000),
  tone: z.string().trim().min(1, "Podaj ton").max(2000),
  targetAudience: z.string().trim().min(1, "Podaj grupę docelową").max(2000),
  differentiators: z.string().trim().max(2000).optional().default(""),
  serviceArea: z.string().trim().max(2000).optional().default(""),
  avoid: z.string().trim().max(4000).optional().default(""),
  outOfScope: z.string().trim().max(2000).optional().default(""),
  websiteUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .default("")
    .refine(
      (v) => !v || /^https?:\/\//i.test(v),
      "Adres strony musi zaczynać się od http:// lub https://",
    ),
  notes: z.string().trim().max(4000).optional().default(""),
});

export type SaveKontekstResult =
  { ok: true; suggestReaudit: boolean } | { ok: false; error: string };

export async function saveKontekstAction(
  input: unknown,
): Promise<SaveKontekstResult> {
  const parsed = briefSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Niepoprawne dane",
    };
  }

  try {
    const profile = await getActiveProfile();
    const data = parsed.data;
    const [existing] = await db
      .select()
      .from(profileBriefs)
      .where(eq(profileBriefs.profileId, profile.id))
      .limit(1);

    if (existing) {
      await db
        .update(profileBriefs)
        .set({
          services: data.services,
          tone: data.tone,
          targetAudience: data.targetAudience,
          differentiators: data.differentiators || null,
          serviceArea: data.serviceArea || null,
          avoid: data.avoid || null,
          outOfScope: data.outOfScope || null,
          websiteUrl: data.websiteUrl || null,
          notes: data.notes || null,
          updatedAt: new Date(),
        })
        .where(eq(profileBriefs.id, existing.id));
    } else {
      await db.insert(profileBriefs).values({
        profileId: profile.id,
        services: data.services,
        tone: data.tone,
        targetAudience: data.targetAudience,
        differentiators: data.differentiators || null,
        serviceArea: data.serviceArea || null,
        avoid: data.avoid || null,
        outOfScope: data.outOfScope || null,
        websiteUrl: data.websiteUrl || null,
        notes: data.notes || null,
      });
    }

    revalidatePath("/ustawienia/kontekst");
    revalidatePath("/wizytowka", "layout");
    return {
      ok: true,
      suggestReaudit: Boolean(profile.gbpLocationId),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Nie udało się zapisać",
    };
  }
}
