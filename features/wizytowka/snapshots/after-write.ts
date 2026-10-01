import type { Profile } from "@/lib/db/schema";
import {
  fetchGbpLocationDetails,
  getGbpLocationAttributes,
} from "@/lib/integrations/gbp/client";
import {
  peekGbpSnapshot,
  saveGbpSnapshot,
} from "@/features/wizytowka/snapshots/read";
import {
  buildLocationSnapshot,
  type LocationSnapshot,
} from "@/features/wizytowka/snapshots/sources";

/**
 * After a successful write the listing snapshot is updated from what Google
 * returned - the customer sees the change at once, without another read.
 * A failure here never fails the save: the snapshot is then refreshed later.
 */

type Raw = Record<string, unknown>;

/** Fields named by the update mask, taken from Google's answer (or what we sent). */
function mergePatched(
  base: Raw,
  body: Raw,
  response: Raw,
  updateMask: string[],
): Raw {
  const merged: Raw = { ...base };
  for (const path of updateMask) {
    const top = path.split(".")[0];
    const value = top in response ? response[top] : body[top];
    if (value === undefined) delete merged[top];
    else merged[top] = value;
  }
  return merged;
}

export async function saveLocationAfterPatch(
  profile: Profile,
  accessToken: string,
  write: {
    body: Raw;
    updateMask: string[];
    response: Raw;
    /** Listing read from Google just before the write (skips the snapshot as base). */
    freshBase?: Raw | null;
  },
): Promise<void> {
  const locationName = profile.gbpLocationId!;
  try {
    const previous = await peekGbpSnapshot(profile, "location", locationName);
    const base =
      write.freshBase ??
      previous?.raw ??
      (await fetchGbpLocationDetails(accessToken, locationName));
    const raw = mergePatched(
      base,
      write.body,
      write.response,
      write.updateMask,
    );
    const snapshot = await buildLocationSnapshot(
      accessToken,
      locationName,
      raw,
      previous,
      { afterWrite: true },
    );
    await saveGbpSnapshot(profile, "location", locationName, snapshot);
  } catch (error) {
    console.error("GBP snapshot update after write failed:", error);
  }
}

/** Saves a listing just read from Google (e.g. when a save found newer data). */
export async function saveFreshLocation(
  profile: Profile,
  accessToken: string,
  raw: Raw,
): Promise<void> {
  const locationName = profile.gbpLocationId!;
  try {
    const previous = await peekGbpSnapshot(profile, "location", locationName);
    const snapshot = await buildLocationSnapshot(
      accessToken,
      locationName,
      raw,
      previous,
    );
    await saveGbpSnapshot(profile, "location", locationName, snapshot);
  } catch (error) {
    console.error("GBP snapshot update failed:", error);
  }
}

type Attribute = Record<string, unknown> & { name?: string };

/**
 * Attribute values after `updateGbpLocationAttributes`: masked attributes are
 * taken from Google's answer; a set/unset of a repeated value cannot be
 * worked out locally, so then the current values are read once.
 */
export async function saveAttributesAfterPatch(
  profile: Profile,
  accessToken: string,
  write: {
    sent: Attribute[];
    attributeMask: string[];
    response: unknown;
  },
): Promise<void> {
  const locationName = profile.gbpLocationId!;
  try {
    const previous: LocationSnapshot | null = await peekGbpSnapshot(
      profile,
      "location",
      locationName,
    );
    if (!previous) return;

    const returned = Array.isArray(
      (write.response as { attributes?: unknown })?.attributes,
    )
      ? ((write.response as { attributes: Attribute[] }).attributes ?? [])
      : [];
    const byName = new Map(
      (previous.attributes as Attribute[]).map((a) => [a.name, a]),
    );

    let needsRead = false;
    for (const name of write.attributeMask) {
      const fromGoogle = returned.find((a) => a.name === name);
      const sent = write.sent.find((a) => a.name === name);
      if (fromGoogle) byName.set(name, fromGoogle);
      else if (!sent) byName.delete(name);
      else if (sent.repeatedEnumValue) needsRead = true;
      else byName.set(name, sent);
    }

    const attributes = needsRead
      ? ((await getGbpLocationAttributes(accessToken, locationName))
          .attributes ?? [])
      : [...byName.values()];

    await saveGbpSnapshot(profile, "location", locationName, {
      ...previous,
      attributes,
    });
  } catch (error) {
    console.error("GBP attributes snapshot update failed:", error);
  }
}
