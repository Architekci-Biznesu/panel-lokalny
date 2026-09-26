import assert from "node:assert/strict";
import {
  isCategoryRefinement,
  reconcileAdditionalCategories,
} from "./reconcile-additional-categories";

{
  assert.equal(
    isCategoryRefinement("Serwis klimatyzacji", "Serwis klimatyzacji samochodowej"),
    true,
  );
  assert.equal(
    isCategoryRefinement(
      "Serwis silników Diesla",
      "Serwis klimatyzacji samochodowej",
    ),
    false,
  );
}

{
  const display = new Map([
    ["categories/gcid:oil_change", "Wymiana oleju"],
    ["categories/gcid:diesel_engine_repair", "Serwis silników Diesla"],
    ["categories/gcid:air_conditioning", "Serwis klimatyzacji"],
    [
      "categories/gcid:auto_air_conditioning_service",
      "Serwis klimatyzacji samochodowej",
    ],
    ["categories/gcid:tire_shop", "Wulkanizacja"],
  ]);

  const current = [
    "categories/gcid:tire_shop",
    "categories/gcid:oil_change",
    "categories/gcid:diesel_engine_repair",
    "categories/gcid:air_conditioning",
  ];
  const suggested = [
    "categories/gcid:tire_shop",
    "categories/gcid:oil_change",
    "categories/gcid:auto_air_conditioning_service",
  ];

  // No competitor signal: keep diesel + air even when AI drops them.
  const result = reconcileAdditionalCategories(
    current,
    suggested,
    display,
    "",
  );

  assert.deepEqual(result, [
    "categories/gcid:tire_shop",
    "categories/gcid:oil_change",
    "categories/gcid:diesel_engine_repair",
    "categories/gcid:air_conditioning",
    "categories/gcid:auto_air_conditioning_service",
  ]);
}

{
  const display = new Map([
    ["categories/gcid:oil_change", "Wymiana oleju"],
    ["categories/gcid:diesel_engine_repair", "Serwis silników Diesla"],
    ["categories/gcid:air_conditioning", "Serwis klimatyzacji"],
    [
      "categories/gcid:auto_air_conditioning_service",
      "Serwis klimatyzacji samochodowej",
    ],
    ["categories/gcid:tire_shop", "Wulkanizacja"],
  ]);

  const current = [
    "categories/gcid:tire_shop",
    "categories/gcid:oil_change",
    "categories/gcid:diesel_engine_repair",
    "categories/gcid:air_conditioning",
  ];
  const suggested = [
    "categories/gcid:tire_shop",
    "categories/gcid:oil_change",
    "categories/gcid:auto_air_conditioning_service",
  ];

  // Competitors have tire/oil/auto_air but not diesel or generic air → allow drop.
  const competitorGcids = new Set([
    "categories/gcid:tire_shop",
    "categories/gcid:oil_change",
    "categories/gcid:auto_air_conditioning_service",
  ]);
  const result = reconcileAdditionalCategories(
    current,
    suggested,
    display,
    "",
    { competitorGcids },
  );

  assert.deepEqual(result, [
    "categories/gcid:tire_shop",
    "categories/gcid:oil_change",
    "categories/gcid:auto_air_conditioning_service",
  ]);
}

{
  const display = new Map([
    ["categories/gcid:oil_change", "Wymiana oleju"],
    ["categories/gcid:tire_shop", "Wulkanizacja"],
  ]);
  const result = reconcileAdditionalCategories(
    ["categories/gcid:tire_shop", "categories/gcid:oil_change"],
    ["categories/gcid:tire_shop"],
    display,
    "wymiana oleju, olej",
  );
  assert.deepEqual(result, ["categories/gcid:tire_shop"]);
}

console.log("reconcile-additional-categories tests passed");
