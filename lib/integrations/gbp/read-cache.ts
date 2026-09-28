/**
 * Short-lived memory of Google Business Profile reads for the panel pages
 * (Wizytówka, Pulpit). Moving between Wizytówka tabs or coming back within a
 * minute does not ask Google again. Every write to the listing clears it
 * (`invalidateGbpReads`), so saved changes show up at once.
 *
 * Per server instance: with several instances another one may show data up to
 * TTL_MS old. Actions, audits and publishing call Google directly - only
 * page reads go through here.
 */

const TTL_MS = 60_000;
/** Safety cap - old entries are dropped first. */
const MAX_ENTRIES = 500;

type Entry = { at: number; value: Promise<unknown> };

// Survives dev hot reloads, so the cache does not reset on every edit.
const globalStore = globalThis as typeof globalThis & {
  __gbpReadCache?: Map<string, Entry>;
};
const store = (globalStore.__gbpReadCache ??= new Map<string, Entry>());

/**
 * Returns the cached result of `load` for this profile and key, or runs it.
 * Concurrent calls share one request; a failed request is not remembered.
 */
export function cachedGbpRead<T>(
  profileId: string,
  key: string,
  load: () => Promise<T>,
): Promise<T> {
  const id = `${profileId}:${key}`;
  const now = Date.now();
  const hit = store.get(id);
  if (hit && now - hit.at < TTL_MS) return hit.value as Promise<T>;

  const value = load();
  store.set(id, { at: now, value });
  value.catch(() => {
    if (store.get(id)?.value === value) store.delete(id);
  });

  if (store.size > MAX_ENTRIES) {
    for (const [oldId, entry] of store) {
      if (now - entry.at >= TTL_MS || store.size > MAX_ENTRIES) {
        store.delete(oldId);
      }
      if (store.size <= MAX_ENTRIES) break;
    }
  }
  return value;
}

/** Forget Google reads - of one profile, or all when no id is given. */
export function invalidateGbpReads(profileId?: string): void {
  if (!profileId) {
    store.clear();
    return;
  }
  for (const id of store.keys()) {
    if (id.startsWith(`${profileId}:`)) store.delete(id);
  }
}
