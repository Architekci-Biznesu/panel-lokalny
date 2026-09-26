import assert from "node:assert/strict";
import { buildRankGrid } from "./grid";
import { matchBusinessInResults } from "./match";
import { cityFromStorefrontAddress } from "./city-from-address";
import {
  RANK_GRID_SIZE,
  RANK_MAX_KEYWORDS,
  RANK_RADIUS_OPTIONS_KM,
  rankQueryCount,
} from "@/lib/config/rank-limits";

/** Grid: concentric rings; center on business; outer ring at radiusKm. */
{
  const lat = 52.23;
  const lng = 21.01;
  const radiusKm = 5;
  const points = buildRankGrid({
    lat,
    lng,
    gridSize: RANK_GRID_SIZE,
    radiusKm,
  });
  assert.equal(points.length, 25);

  const center = points[0];
  assert.ok(center);
  assert.ok(Math.abs(center.lat - lat) < 1e-6);
  assert.ok(Math.abs(center.lng - lng) < 1e-6);

  const distancesKm = points.slice(1).map((p) => {
    const dLat = (p.lat - lat) * 111;
    const dLng = (p.lng - lng) * 111 * Math.cos((lat * Math.PI) / 180);
    return Math.hypot(dLat, dLng);
  });
  const maxDist = Math.max(...distancesKm);
  assert.ok(
    Math.abs(maxDist - radiusKm) < 0.08,
    `outer ring ${maxDist} km vs ${radiusKm}`,
  );

  // Points are not a cartesian lattice (no unique row/col square corners).
  const uniqueAngles = new Set(
    points.slice(1).map((p) => {
      const dLat = p.lat - lat;
      const dLng = p.lng - lng;
      return Math.round((Math.atan2(dLng, dLat) * 180) / Math.PI);
    }),
  );
  assert.ok(uniqueAngles.size >= 8, "ring should fan around the center");
}

/** Match: place_id wins; name fallback only without place_id on result. */
{
  const byPlace = matchBusinessInResults({
    results: [
      {
        placeId: "other",
        title: "Sieć Fryzjer",
        address: "Ul. A 1",
        position: 1,
        rating: null,
        reviews: null,
      },
      {
        placeId: "ChIJ-target",
        title: "Sieć Fryzjer",
        address: "Ul. B 2",
        position: 2,
        rating: null,
        reviews: null,
      },
    ],
    placeId: "ChIJ-target",
    businessName: "Sieć Fryzjer",
    businessAddress: "Ul. B 2, Warszawa",
  });
  assert.equal(byPlace.matchMethod, "place_id");
  assert.equal(byPlace.position, 2);

  const fallback = matchBusinessInResults({
    results: [
      {
        placeId: null,
        title: "Barber Shop Test",
        address: "Marszalkowska 10, Warszawa",
        position: 1,
        rating: null,
        reviews: null,
      },
    ],
    placeId: "ChIJ-missing",
    businessName: "Barber Shop Test",
    businessAddress: "Marszalkowska 10, Warszawa",
  });
  assert.equal(fallback.matchMethod, "name_fallback");
  assert.equal(fallback.position, 1);
}

/** City extraction: locality only, never full street. */
{
  assert.equal(
    cityFromStorefrontAddress({
      addressLines: ["ul. Długa 1"],
      locality: "Kraków",
      postalCode: "30-001",
    }),
    "Kraków",
  );
  assert.equal(cityFromStorefrontAddress({ addressLines: ["ul. X"] }), null);
}

/** Config limits. */
{
  assert.equal(RANK_MAX_KEYWORDS, 10);
  assert.equal(rankQueryCount(5), 26);
  assert.deepEqual([...RANK_RADIUS_OPTIONS_KM], [5, 10, 15]);
}

console.log("rank smoke tests passed");
