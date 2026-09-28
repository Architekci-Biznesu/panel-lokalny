/** Max length of a topic (it becomes the post title). */
export const TOPIC_MAX = 160;

function key(topic: string): string {
  return topic
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * Cleans the model's topic list: strings only, trimmed, no numbering or
 * quotes, no duplicates, nothing already used (`exclude`), at most `count`.
 */
export function normalizeTopics(
  raw: unknown,
  count: number,
  exclude: string[],
): string[] {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { topics?: unknown })?.topics)
      ? (raw as { topics: unknown[] }).topics
      : [];
  const seen = new Set(exclude.map(key));
  const topics: string[] = [];
  for (const item of list) {
    if (typeof item !== "string") continue;
    const topic = item
      .replace(/^\s*(\d+[.)]|[-*•])\s*/, "")
      .replace(/^["„”']+|["„”'.]+$/g, "")
      .replace(/\s*[\u2013\u2014]\s*/g, " - ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, TOPIC_MAX);
    const k = key(topic);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    topics.push(topic);
    if (topics.length >= count) break;
  }
  return topics;
}
