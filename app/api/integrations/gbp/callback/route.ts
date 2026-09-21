import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { oauthConnections, onboardingDrafts } from "@/lib/db/schema";
import {
  exchangeGbpCode,
  listGbpLocations,
  sealTokens,
} from "@/lib/integrations/gbp/client";
import { getActiveAccountId } from "@/lib/session";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");

  let mode = "new";
  let draftId: string | null = null;

  if (stateRaw) {
    try {
      const parsed = JSON.parse(
        Buffer.from(stateRaw, "base64url").toString("utf8"),
      ) as { draftId?: string; mode?: string };
      draftId = parsed.draftId ?? null;
      mode = parsed.mode === "add" ? "add" : "new";
    } catch {
      // ignore
    }
  }

  const onboardingUrl = new URL("/onboarding", request.url);
  if (mode === "add") onboardingUrl.searchParams.set("mode", "add");

  // User denied consent - same as "Pomiń": finish with current draft profile if any
  if (error) {
    try {
      const accountId = await getActiveAccountId();
      if (draftId) {
        const [draft] = await db
          .select()
          .from(onboardingDrafts)
          .where(eq(onboardingDrafts.id, draftId))
          .limit(1);
        if (draft?.profileId && draft.accountId === accountId) {
          const { unstable_update } = await import("@/lib/auth");
          await unstable_update({
            user: { activeProfileId: draft.profileId },
          });
          await db
            .delete(onboardingDrafts)
            .where(eq(onboardingDrafts.id, draft.id));
          return NextResponse.redirect(new URL("/pulpit", request.url));
        }
      }
    } catch {
      // fall through to onboarding
    }
    return NextResponse.redirect(onboardingUrl);
  }

  if (!code || !draftId) {
    onboardingUrl.searchParams.set("gbp", "error");
    return NextResponse.redirect(onboardingUrl);
  }

  try {
    const accountId = await getActiveAccountId();
    const [draft] = await db
      .select()
      .from(onboardingDrafts)
      .where(eq(onboardingDrafts.id, draftId))
      .limit(1);

    if (!draft || draft.accountId !== accountId) {
      onboardingUrl.searchParams.set("gbp", "error");
      return NextResponse.redirect(onboardingUrl);
    }

    const tokens = await exchangeGbpCode(code);
    const sealed = sealTokens(tokens);

    const [connection] = await db
      .insert(oauthConnections)
      .values({
        accountId,
        provider: "gbp",
        encryptedAccessToken: sealed.encryptedAccessToken,
        encryptedRefreshToken: sealed.encryptedRefreshToken,
        expiresAt: sealed.expiresAt,
        scopes: sealed.scopes,
      })
      .returning();

    const locations = await listGbpLocations(tokens.accessToken);

    await db
      .update(onboardingDrafts)
      .set({
        oauthConnectionId: connection.id,
        pendingGbpLocations: locations,
        step: "3",
        updatedAt: new Date(),
      })
      .where(eq(onboardingDrafts.id, draft.id));

    onboardingUrl.searchParams.set("gbp", "connected");
    return NextResponse.redirect(onboardingUrl);
  } catch {
    onboardingUrl.searchParams.set("gbp", "error");
    return NextResponse.redirect(onboardingUrl);
  }
}
