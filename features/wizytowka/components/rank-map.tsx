"use client";

import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export type RankMapPoint = {
  lat: number;
  lng: number;
  position: number | null;
};

/** Same bands/colors as gmb-rank-tracker. */
const LEGEND_ITEMS = [
  { label: "1-3", color: "#22c55e" },
  { label: "4-10", color: "#8DC505" },
  { label: "11-15", color: "#FFC211" },
  { label: "16-20", color: "#F87305" },
  { label: "21+", color: "#CD2B2E" },
] as const;

export function positionColor(position: number | null): string {
  if (position == null || position >= 21) return "#CD2B2E";
  if (position <= 3) return "#22c55e";
  if (position <= 10) return "#8DC505";
  if (position <= 15) return "#FFC211";
  return "#F87305";
}

function pinLabel(position: number | null): string {
  if (position == null || position >= 21) return "20+";
  return String(position);
}

function hexToRgba(hex: string, alpha: number): string {
  const raw = hex.replace("#", "");
  const n = Number.parseInt(raw, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function pinIcon(position: number | null): L.DivIcon {
  const color = positionColor(position);
  const fill = hexToRgba(color, 0.85);
  return L.divIcon({
    className: "rank-map-pin",
    html: `<span style="--pin-fill:${fill}">${pinLabel(position)}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function FitBounds({ points }: { points: RankMapPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
    const apply = () => {
      map.invalidateSize();
      map.fitBounds(bounds, {
        padding: [20, 20],
        maxZoom: 15,
        animate: false,
      });
    };
    apply();
    const t = window.setTimeout(apply, 80);
    return () => window.clearTimeout(t);
  }, [map, points]);
  return null;
}

export function RankMap({
  points,
  className,
}: {
  points: RankMapPoint[];
  className?: string;
}) {
  const center = useMemo<[number, number]>(() => {
    if (points.length === 0) return [52.23, 21.01];
    const lat = points.reduce((s, p) => s + p.lat, 0) / points.length;
    const lng = points.reduce((s, p) => s + p.lng, 0) / points.length;
    return [lat, lng];
  }, [points]);

  if (points.length === 0) {
    return (
      <div className={className ?? "rank-map"}>
        <p className="rank-map-empty">Brak punktów do wyświetlenia</p>
      </div>
    );
  }

  return (
    <div className={className ?? "rank-map"}>
      <div className="rank-map-frame">
        <MapContainer
          key={points
            .map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`)
            .join("|")}
          center={center}
          zoom={15}
          scrollWheelZoom={false}
          className="rank-map-canvas"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds points={points} />
          {points.map((point, index) => (
            <Marker
              key={`${point.lat}-${point.lng}-${index}`}
              position={[point.lat, point.lng]}
              icon={pinIcon(point.position)}
            />
          ))}
        </MapContainer>
        <ul className="rank-map-legend" aria-label="Legenda pozycji">
          {LEGEND_ITEMS.map((item) => (
            <li key={item.label}>
              <span
                className="rank-map-swatch"
                style={{ background: item.color }}
              />
              {item.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
