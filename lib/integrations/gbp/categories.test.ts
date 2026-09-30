import assert from "node:assert/strict";
import { listGbpCategories } from "./client";

/**
 * categories.list is paginated (max 100 per page). A fake Google with three
 * pages - the function must return categories from all of them and pass the
 * previous page's token on.
 */
async function main() {
  const pages: Record<string, { categories: unknown[]; next?: string }> = {
    "": {
      categories: [
        { name: "categories/gcid:a1", displayName: "A1" },
        { name: "categories/gcid:a2", displayName: "A2" },
      ],
      next: "tok-2",
    },
    "tok-2": {
      categories: [
        {
          name: "categories/gcid:b1",
          displayName: "B1",
          serviceTypes: [{ serviceTypeId: "job_type_id:x", displayName: "X" }],
        },
      ],
      next: "tok-3",
    },
    "tok-3": {
      categories: [
        { name: "categories/gcid:c1", displayName: "C1" },
        { name: "categories/gcid:c2" },
      ],
    },
  };

  const seen: Array<{ token: string; pageSize: string | null }> = [];
  const realFetch = globalThis.fetch;
  const realInfo = console.info;
  console.info = () => {};
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : input);
    const token = url.searchParams.get("pageToken") ?? "";
    seen.push({ token, pageSize: url.searchParams.get("pageSize") });
    const page = pages[token];
    assert.ok(page, `nieznany pageToken "${token}"`);
    return new Response(
      JSON.stringify({ categories: page.categories, nextPageToken: page.next }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;

  try {
    const categories = await listGbpCategories("fake-token");

    assert.deepEqual(
      categories.map((c) => c.name),
      [
        "categories/gcid:a1",
        "categories/gcid:a2",
        "categories/gcid:b1",
        "categories/gcid:c1",
      ],
      "kategorie ze wszystkich trzech stron (bez wpisu bez nazwy wyświetlanej)",
    );
    assert.deepEqual(categories[2].serviceTypes, [
      { serviceTypeId: "job_type_id:x", displayName: "X" },
    ]);
    assert.deepEqual(
      seen.map((s) => s.token),
      ["", "tok-2", "tok-3"],
      "każda kolejna strona z tokenem z poprzedniej odpowiedzi",
    );
    assert.ok(seen.every((s) => s.pageSize === "100"));
  } finally {
    globalThis.fetch = realFetch;
    console.info = realInfo;
  }

  console.log("categories.test: OK");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
