"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getTextProvider } from "@/lib/ai";
import { unstable_update } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  companyContext,
  onboardingDrafts,
  profileBriefs,
  profileGroups,
  profiles,
  publishGroups,
  type OnboardingDraft,
} from "@/lib/db/schema";
import {
  getGbpAuthUrl,
  scheduleGbpAnalysis,
  type GbpLocation,
} from "@/lib/integrations/gbp/client";
import { scrapeWebsite } from "@/lib/scrape/website";
import { getActiveAccountId, listAccountProfiles } from "@/lib/session";

const modeSchema = z.enum(["new", "add"]).default("new");

function now() {
  return new Date();
}

async function getDraft(mode: "new" | "add"): Promise<OnboardingDraft> {
  const accountId = await getActiveAccountId();
  const [existing] = await db
    .select()
    .from(onboardingDrafts)
    .where(
      and(
        eq(onboardingDrafts.accountId, accountId),
        eq(onboardingDrafts.mode, mode),
      ),
    )
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(onboardingDrafts)
    .values({
      accountId,
      mode,
      step: "1",
    })
    .returning();

  return created;
}

export async function loadOnboardingState(modeRaw: string | undefined) {
  const mode = modeSchema.parse(modeRaw ?? "new");
  const draft = await getDraft(mode);
  const accountProfiles = await listAccountProfiles();

  return {
    mode,
    draft: {
      id: draft.id,
      step: draft.step,
      profileId: draft.profileId,
      websiteUrl: draft.websiteUrl,
      manualDescription: draft.manualDescription,
      scrapeWarning: draft.scrapeWarning,
      services: draft.services ?? "",
      tone: draft.tone ?? "",
      targetAudience: draft.targetAudience ?? "",
      differentiators: draft.differentiators ?? "",
      pendingLocations: (draft.pendingGbpLocations as GbpLocation[] | null) ?? [],
      hasConnection: !!draft.oauthConnectionId,
    },
    profiles: accountProfiles.map((p) => ({ id: p.id, name: p.name })),
  };
}

const step1Schema = z.discriminatedUnion("path", [
  z.object({
    path: z.literal("website"),
    websiteUrl: z.string().trim().min(3, "Podaj adres strony"),
    mode: modeSchema,
  }),
  z.object({
    path: z.literal("manual"),
    description: z.string().trim().min(20, "Opisz firmę w kilku zdaniach"),
    mode: modeSchema,
  }),
]);

export type StepResult =
  | { ok: true; warning?: string }
  | { ok: false; error: string };

export async function submitOnboardingStep1(
  input: z.infer<typeof step1Schema>,
): Promise<StepResult> {
  const parsed = step1Schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Błąd walidacji" };
  }

  const accountId = await getActiveAccountId();
  const mode = parsed.data.mode;
  const draft = await getDraft(mode);

  let scrapeText = "";
  let scrapeWarning: string | null = null;
  let websiteUrl: string | null = null;
  let manualDescription: string | null = null;
  let profileName = "Mój biznes";
  let websiteScrape: Awaited<ReturnType<typeof scrapeWebsite>> | null = null;

  if (parsed.data.path === "website") {
    websiteUrl = parsed.data.websiteUrl.trim();
    websiteScrape = await scrapeWebsite(websiteUrl);
    scrapeText = websiteScrape.text;
    scrapeWarning = websiteScrape.warning ?? null;
    if (websiteScrape.title) profileName = websiteScrape.title.slice(0, 120);
    else {
      try {
        profileName = new URL(
          /^https?:\/\//i.test(websiteUrl) ? websiteUrl : `https://${websiteUrl}`,
        ).hostname.replace(/^www\./, "");
      } catch {
        profileName = websiteUrl.slice(0, 120);
      }
    }
  } else {
    manualDescription = parsed.data.description.trim();
    scrapeText = manualDescription;
    profileName = "Mój biznes";
  }

  let profileId = draft.profileId;
  if (!profileId) {
    const [profile] = await db
      .insert(profiles)
      .values({
        accountId,
        name: profileName,
        kind: "local_business",
      })
      .returning();
    profileId = profile.id;
  } else {
    await db
      .update(profiles)
      .set({ name: profileName })
      .where(and(eq(profiles.id, profileId), eq(profiles.accountId, accountId)));
  }

  if (websiteScrape) {
    await db.insert(companyContext).values({
      profileId,
      source: "website",
      rawData: {
        url: websiteScrape.url,
        title: websiteScrape.title,
        description: websiteScrape.description,
        headings: websiteScrape.headings,
        text: websiteScrape.text,
        ok: websiteScrape.ok,
        warning: websiteScrape.warning ?? null,
      },
      fetchedAt: now(),
    });
  }

  await db
    .update(onboardingDrafts)
    .set({
      profileId,
      websiteUrl,
      manualDescription,
      scrapeText,
      scrapeWarning,
      step: "2",
      services: null,
      tone: null,
      targetAudience: null,
      differentiators: null,
      briefDirty: "0",
      updatedAt: now(),
    })
    .where(eq(onboardingDrafts.id, draft.id));

  // Generate brief immediately for step 2
  try {
    const provider = getTextProvider();
    const brief = await provider.generateBrief({
      sourceText: scrapeText || "Brak materiału źródłowego - zaproponuj ogólny brief dla lokalnej firmy.",
      websiteUrl,
      companyNameHint: profileName,
    });
    await db
      .update(onboardingDrafts)
      .set({
        services: brief.services,
        tone: brief.tone,
        targetAudience: brief.targetAudience,
        differentiators: brief.differentiators,
        briefDirty: "0",
        updatedAt: now(),
      })
      .where(eq(onboardingDrafts.id, draft.id));
  } catch {
    scrapeWarning = [
      scrapeWarning,
      "Nie udało się wygenerować briefu AI - uzupełnij pola ręcznie.",
    ]
      .filter(Boolean)
      .join(" ");
    await db
      .update(onboardingDrafts)
      .set({
        services: "",
        tone: "",
        targetAudience: "",
        differentiators: "",
        scrapeWarning,
        updatedAt: now(),
      })
      .where(eq(onboardingDrafts.id, draft.id));
  }

  return { ok: true, warning: scrapeWarning ?? undefined };
}

export async function regenerateBriefAction(input: {
  mode: string;
  note: string;
  currentServices: string;
  currentTone: string;
  currentTargetAudience: string;
  currentDifferentiators: string;
}): Promise<StepResult> {
  const mode = modeSchema.parse(input.mode);
  const note = input.note.trim();

  const draft = await getDraft(mode);
  if (!draft.profileId) {
    return { ok: false, error: "Najpierw ukończ krok 1" };
  }

  try {
    const provider = getTextProvider();
    const brief = await provider.generateBrief({
      sourceText:
        draft.scrapeText ||
        draft.manualDescription ||
        "Brak materiału źródłowego - zaproponuj ogólny brief dla lokalnej firmy.",
      websiteUrl: draft.websiteUrl,
      currentBrief: {
        services: input.currentServices,
        tone: input.currentTone,
        targetAudience: input.currentTargetAudience,
        differentiators: input.currentDifferentiators,
      },
      guidanceNote: note || null,
    });
    await db
      .update(onboardingDrafts)
      .set({
        services: brief.services,
        tone: brief.tone,
        targetAudience: brief.targetAudience,
        differentiators: brief.differentiators,
        briefDirty: "0",
        updatedAt: now(),
      })
      .where(eq(onboardingDrafts.id, draft.id));
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "Regeneracja nie powiodła się. Możesz wypełnić pola ręcznie.",
    };
  }
}

const briefSaveSchema = z.object({
  mode: modeSchema,
  services: z.string(),
  tone: z.string(),
  targetAudience: z.string(),
  differentiators: z.string(),
});

export async function saveBriefAndContinue(
  input: z.infer<typeof briefSaveSchema>,
): Promise<StepResult> {
  const parsed = briefSaveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Błąd walidacji" };
  }

  const accountId = await getActiveAccountId();
  const draft = await getDraft(parsed.data.mode);
  if (!draft.profileId) {
    return { ok: false, error: "Brak profilu w draftcie" };
  }

  await requireDraftProfile(draft.profileId, accountId);

  const [existing] = await db
    .select()
    .from(profileBriefs)
    .where(eq(profileBriefs.profileId, draft.profileId))
    .limit(1);

  if (existing) {
    await db
      .update(profileBriefs)
      .set({
        services: parsed.data.services,
        tone: parsed.data.tone,
        targetAudience: parsed.data.targetAudience,
        differentiators: parsed.data.differentiators,
        websiteUrl: draft.websiteUrl,
        notes: draft.manualDescription,
        updatedAt: now(),
      })
      .where(eq(profileBriefs.id, existing.id));
  } else {
    await db.insert(profileBriefs).values({
      profileId: draft.profileId,
      services: parsed.data.services,
      tone: parsed.data.tone,
      targetAudience: parsed.data.targetAudience,
      differentiators: parsed.data.differentiators,
      websiteUrl: draft.websiteUrl,
      notes: draft.manualDescription,
    });
  }

  await db
    .update(onboardingDrafts)
    .set({
      services: parsed.data.services,
      tone: parsed.data.tone,
      targetAudience: parsed.data.targetAudience,
      differentiators: parsed.data.differentiators,
      step: "3",
      briefDirty: "0",
      updatedAt: now(),
    })
    .where(eq(onboardingDrafts.id, draft.id));

  return { ok: true };
}

export async function goToOnboardingStep(modeRaw: string, step: "1" | "2" | "3") {
  const mode = modeSchema.parse(modeRaw);
  const draft = await getDraft(mode);
  await db
    .update(onboardingDrafts)
    .set({ step, updatedAt: now() })
    .where(eq(onboardingDrafts.id, draft.id));
  return { ok: true as const };
}

/** Disconnect Google from onboarding draft and stay on step 3 connect screen. */
export async function disconnectGbpAction(
  modeRaw: string,
): Promise<StepResult> {
  const mode = modeSchema.parse(modeRaw);
  const accountId = await getActiveAccountId();
  const draft = await getDraft(mode);

  if (draft.oauthConnectionId) {
    const { oauthConnections } = await import("@/lib/db/schema");
    const [connection] = await db
      .select({ id: oauthConnections.id })
      .from(oauthConnections)
      .where(
        and(
          eq(oauthConnections.id, draft.oauthConnectionId),
          eq(oauthConnections.accountId, accountId),
        ),
      )
      .limit(1);

    if (connection) {
      await db
        .update(onboardingDrafts)
        .set({
          oauthConnectionId: null,
          pendingGbpLocations: null,
          step: "3",
          updatedAt: now(),
        })
        .where(eq(onboardingDrafts.id, draft.id));

      await db
        .delete(oauthConnections)
        .where(eq(oauthConnections.id, connection.id));
    }
  } else {
    await db
      .update(onboardingDrafts)
      .set({
        oauthConnectionId: null,
        pendingGbpLocations: null,
        step: "3",
        updatedAt: now(),
      })
      .where(eq(onboardingDrafts.id, draft.id));
  }

  return { ok: true };
}

async function requireDraftProfile(profileId: string, accountId: string) {
  const [profile] = await db
    .select()
    .from(profiles)
    .where(and(eq(profiles.id, profileId), eq(profiles.accountId, accountId)))
    .limit(1);
  if (!profile) {
    throw new Error("Profil draftu nie należy do konta");
  }
  return profile;
}

export async function skipGbpAndFinish(modeRaw: string) {
  const mode = modeSchema.parse(modeRaw);
  const accountId = await getActiveAccountId();
  const draft = await getDraft(mode);
  if (!draft.profileId) {
    redirect(`/onboarding${mode === "add" ? "?mode=add" : ""}`);
  }

  await requireDraftProfile(draft.profileId, accountId);

  // Ensure brief exists even if user jumped somehow
  if (
    draft.services != null ||
    draft.tone != null ||
    draft.targetAudience != null ||
    draft.differentiators != null
  ) {
    const [existing] = await db
      .select()
      .from(profileBriefs)
      .where(eq(profileBriefs.profileId, draft.profileId))
      .limit(1);
    if (!existing) {
      await db.insert(profileBriefs).values({
        profileId: draft.profileId,
        services: draft.services ?? "",
        tone: draft.tone ?? "",
        targetAudience: draft.targetAudience ?? "",
        differentiators: draft.differentiators ?? "",
        websiteUrl: draft.websiteUrl,
        notes: draft.manualDescription,
      });
    }
  }

  await unstable_update({ user: { activeProfileId: draft.profileId } });
  await db
    .delete(onboardingDrafts)
    .where(eq(onboardingDrafts.id, draft.id));

  redirect("/pulpit");
}

export async function startGbpOAuth(modeRaw: string) {
  const mode = modeSchema.parse(modeRaw);
  const draft = await getDraft(mode);
  const state = Buffer.from(
    JSON.stringify({ draftId: draft.id, mode }),
    "utf8",
  ).toString("base64url");
  redirect(getGbpAuthUrl(state));
}

const confirmLocationsSchema = z.object({
  mode: modeSchema,
  locationNames: z.array(z.string().min(1)).min(1),
  groupMode: z.enum(["none", "new", "existing"]).default("none"),
  groupName: z.string().optional(),
  existingGroupId: z.string().uuid().optional(),
});

export async function confirmGbpLocations(
  input: z.infer<typeof confirmLocationsSchema>,
): Promise<StepResult> {
  const parsed = confirmLocationsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Błąd walidacji" };
  }

  const accountId = await getActiveAccountId();
  const draft = await getDraft(parsed.data.mode);
  if (!draft.profileId || !draft.oauthConnectionId) {
    return { ok: false, error: "Brak połączenia Google lub profilu" };
  }

  const pending = (draft.pendingGbpLocations as GbpLocation[] | null) ?? [];
  const selected = pending.filter((loc) =>
    parsed.data.locationNames.includes(loc.name),
  );
  if (selected.length === 0) {
    return { ok: false, error: "Wybierz co najmniej jedną lokalizację" };
  }

  const brief = {
    services: draft.services ?? "",
    tone: draft.tone ?? "",
    targetAudience: draft.targetAudience ?? "",
    differentiators: draft.differentiators ?? "",
    websiteUrl: draft.websiteUrl,
    notes: draft.manualDescription,
  };

  let groupId: string | null = null;
  if (selected.length > 1 && parsed.data.groupMode === "new") {
    const [group] = await db
      .insert(publishGroups)
      .values({
        accountId,
        name: parsed.data.groupName?.trim() || "Grupa publikacji",
      })
      .returning();
    groupId = group.id;
  } else if (selected.length > 1 && parsed.data.groupMode === "existing") {
    if (!parsed.data.existingGroupId) {
      return { ok: false, error: "Wybierz istniejącą grupę" };
    }
    const [group] = await db
      .select()
      .from(publishGroups)
      .where(
        and(
          eq(publishGroups.id, parsed.data.existingGroupId),
          eq(publishGroups.accountId, accountId),
        ),
      )
      .limit(1);
    if (!group) return { ok: false, error: "Nie znaleziono grupy" };
    groupId = group.id;
  }

  const { decryptSecret } = await import("@/lib/crypto/secrets");
  const { oauthConnections } = await import("@/lib/db/schema");
  const {
    fetchGbpLocationDetails,
    refreshGbpAccessToken,
  } = await import("@/lib/integrations/gbp/client");

  const [connection] = await db
    .select()
    .from(oauthConnections)
    .where(
      and(
        eq(oauthConnections.id, draft.oauthConnectionId),
        eq(oauthConnections.accountId, accountId),
      ),
    )
    .limit(1);

  if (!connection) {
    return { ok: false, error: "Brak połączenia OAuth" };
  }

  let accessToken = decryptSecret(connection.encryptedAccessToken);
  if (connection.expiresAt && connection.expiresAt.getTime() < Date.now() + 60_000) {
    if (!connection.encryptedRefreshToken) {
      return { ok: false, error: "Sesja Google wygasła - połącz ponownie" };
    }
    const refreshed = await refreshGbpAccessToken(connection.encryptedRefreshToken);
    const { sealTokens } = await import("@/lib/integrations/gbp/client");
    const sealed = sealTokens(refreshed);
    await db
      .update(oauthConnections)
      .set({
        encryptedAccessToken: sealed.encryptedAccessToken,
        expiresAt: sealed.expiresAt,
        updatedAt: now(),
      })
      .where(eq(oauthConnections.id, connection.id));
    accessToken = refreshed.accessToken;
  }

  const createdProfileIds: string[] = [];
  const errors: string[] = [];

  for (let i = 0; i < selected.length; i++) {
    const loc = selected[i];
    try {
      const details = await fetchGbpLocationDetails(accessToken, loc.name);
      let profileId: string;

      if (i === 0 && draft.profileId) {
        profileId = draft.profileId;
        await db
          .update(profiles)
          .set({
            name: loc.title.slice(0, 120),
            gbpLocationId: loc.name,
            oauthConnectionId: connection.id,
          })
          .where(
            and(eq(profiles.id, profileId), eq(profiles.accountId, accountId)),
          );
      } else {
        const [created] = await db
          .insert(profiles)
          .values({
            accountId,
            name: loc.title.slice(0, 120),
            kind: "local_business",
            gbpLocationId: loc.name,
            oauthConnectionId: connection.id,
          })
          .returning();
        profileId = created.id;
      }

      await db.insert(companyContext).values({
        profileId,
        source: "gbp",
        rawData: details,
        fetchedAt: now(),
      });

      const [existingBrief] = await db
        .select()
        .from(profileBriefs)
        .where(eq(profileBriefs.profileId, profileId))
        .limit(1);

      if (existingBrief) {
        await db
          .update(profileBriefs)
          .set({
            services: brief.services,
            tone: brief.tone,
            targetAudience: brief.targetAudience,
            differentiators: brief.differentiators,
            websiteUrl: brief.websiteUrl,
            notes: brief.notes,
            updatedAt: now(),
          })
          .where(eq(profileBriefs.id, existingBrief.id));
      } else {
        await db.insert(profileBriefs).values({
          profileId,
          services: brief.services,
          tone: brief.tone,
          targetAudience: brief.targetAudience,
          differentiators: brief.differentiators,
          websiteUrl: brief.websiteUrl,
          notes: brief.notes,
        });
      }

      if (groupId) {
        await db.insert(profileGroups).values({ profileId, groupId });
      }

      await scheduleGbpAnalysis(profileId);
      createdProfileIds.push(profileId);
    } catch (error) {
      errors.push(
        `${loc.title}: ${error instanceof Error ? error.message : "błąd"}`,
      );
    }
  }

  if (createdProfileIds.length === 0) {
    return {
      ok: false,
      error: `Nie udało się utworzyć profili. ${errors.join("; ")}`,
    };
  }

  await unstable_update({ user: { activeProfileId: createdProfileIds[0] } });
  await db.delete(onboardingDrafts).where(eq(onboardingDrafts.id, draft.id));

  if (errors.length) {
    // Still finish - report via query string would be nice; redirect with cookie
  }

  redirect("/pulpit");
}

export async function switchActiveProfile(profileId: string) {
  const accountId = await getActiveAccountId();
  const [profile] = await db
    .select()
    .from(profiles)
    .where(and(eq(profiles.id, profileId), eq(profiles.accountId, accountId)))
    .limit(1);
  if (!profile) {
    return { ok: false as const, error: "Profil nie należy do konta" };
  }
  await unstable_update({ user: { activeProfileId: profile.id } });
  return { ok: true as const };
}

export async function listPublishGroupsForAccount() {
  const accountId = await getActiveAccountId();
  return db
    .select()
    .from(publishGroups)
    .where(eq(publishGroups.accountId, accountId));
}
