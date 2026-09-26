import assert from "node:assert/strict";
import {
  buildCompetitorSeedPhrases,
  matchTypeToCategory,
} from "./competitor-insights";

{
  const phrases = buildCompetitorSeedPhrases({
    primaryDisplayName: "Mechanik samochodowy",
    city: "Kraków",
    title: "AutoFix | Wulkanizacja | Kraków",
    briefServices: "wulkanizacja, klimatyzacja samochodowa",
  });
  assert.equal(phrases.length, 3);
  assert.ok(phrases[0]?.includes("Mechanik"));
  assert.ok(phrases.some((p) => /wulkanizacja/i.test(p)));
  assert.ok(phrases.every((p) => p.includes("Kraków")));
}

{
  const available = [
    {
      name: "categories/gcid:auto_repair_shop",
      displayName: "Warsztat samochodowy",
    },
    {
      name: "categories/gcid:tire_shop",
      displayName: "Wulkanizacja",
    },
    {
      name: "categories/gcid:oil_change",
      displayName: "Wymiana oleju",
    },
  ];
  const tire = matchTypeToCategory("Wulkanizacja", available);
  assert.equal(tire?.name, "categories/gcid:tire_shop");
  const oil = matchTypeToCategory("Wymiana oleju", available);
  assert.equal(oil?.name, "categories/gcid:oil_change");
  const workshop = matchTypeToCategory("warsztat samochodowy", available);
  assert.equal(workshop?.name, "categories/gcid:auto_repair_shop");
  const bySlug = matchTypeToCategory("tire shop", available);
  assert.equal(bySlug?.name, "categories/gcid:tire_shop");
  const miss = matchTypeToCategory("Kawiarnia", available);
  assert.equal(miss, null);
}

console.log("competitor-insights tests passed");
