export type GridPoint = {
  lat: number;
  lng: number;
  row: number;
  col: number;
};

/**
 * Concentric-ring grid (same geometry as gmb-rank-tracker).
 * Always returns gridSize² points: 1 center + rings out to radiusKm.
 */
export function buildRankGrid(input: {
  lat: number;
  lng: number;
  gridSize: number;
  radiusKm: number;
}): GridPoint[] {
  const { lat, lng, gridSize, radiusKm } = input;
  if (gridSize < 1 || !Number.isInteger(gridSize)) {
    throw new Error("gridSize must be a positive integer");
  }
  if (!(radiusKm > 0)) {
    throw new Error("radiusKm must be positive");
  }

  const totalPoints = gridSize * gridSize;
  const latDegPerKm = 1 / 111;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const lngDegPerKm =
    Math.abs(cosLat) < 1e-6 ? 1 / 111 : 1 / (111 * cosLat);

  const points: GridPoint[] = [
    {
      lat: roundCoord(lat),
      lng: roundCoord(lng),
      row: Math.floor(gridSize / 2),
      col: Math.floor(gridSize / 2),
    },
  ];

  if (totalPoints === 1) return points;

  const remaining = totalPoints - 1;
  let numRings = Math.floor(gridSize / 2) + (gridSize % 2 === 0 ? 1 : 0);
  if (numRings < 1) numRings = 1;

  const ringWeights = Array.from({ length: numRings }, (_, i) => i + 1);
  const totalWeight = ringWeights.reduce((s, w) => s + w, 0);

  const ringPointCounts: number[] = [];
  let assigned = 0;
  for (let i = 0; i < ringWeights.length; i++) {
    if (i === ringWeights.length - 1) {
      ringPointCounts.push(remaining - assigned);
    } else {
      const count = Math.max(
        3,
        Math.round((remaining * ringWeights[i]) / totalWeight),
      );
      ringPointCounts.push(count);
      assigned += count;
    }
  }

  let idx = 0;
  for (let ringIdx = 0; ringIdx < ringPointCounts.length; ringIdx++) {
    const count = ringPointCounts[ringIdx]!;
    const ringRadiusKm = (radiusKm * (ringIdx + 1)) / ringPointCounts.length;

    for (let p = 0; p < count; p++) {
      const angle = (2 * Math.PI * p) / count;
      const dLat = ringRadiusKm * Math.cos(angle) * latDegPerKm;
      const dLng = ringRadiusKm * Math.sin(angle) * lngDegPerKm;
      points.push({
        lat: roundCoord(lat + dLat),
        lng: roundCoord(lng + dLng),
        row: Math.floor(idx / gridSize),
        col: idx % gridSize,
      });
      idx += 1;
    }
  }

  return points.slice(0, totalPoints);
}

function roundCoord(value: number): number {
  return Math.round(value * 1e7) / 1e7;
}
