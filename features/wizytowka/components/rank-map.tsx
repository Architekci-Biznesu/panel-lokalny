"use client";

import { useEffect, useMemo } from "react";
import L from "leaflet";
import { Minus, Plus } from "lucide-react";
import {
  MapContainer,
  Marker,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

/**
 * Podkład mapy - jedno miejsce do podmiany dostawcy.
 * OSM jest darmowy, ale jego serwery nie są przeznaczone do ruchu z aplikacji
 * komercyjnych; minimalistyczny wygląd daje filtr CSS na .rank-map-canvas
 * (styles/raporty.css). Przy przejściu na płatny podkład (np. Stadia
 * "alidade_smooth" albo MapTiler "dataviz") zmień URL i atrybucję, a filtr usuń.
 */
const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

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

function pinIcon(position: number | null, isCenter: boolean): L.DivIcon {
  const color = positionColor(position);
  const fill = hexToRgba(color, 0.92);
  return L.divIcon({
    className: `rank-map-pin${isCenter ? " is-center" : ""}`,
    html: `<span style="--pin-fill:${fill}">${pinLabel(position)}</span>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

/** Punkt siatki najbliżej środka = lokalizacja firmy (siatka jest koncentryczna). */
function centerIndex(points: RankMapPoint[]): number {
  if (points.length === 0) return -1;
  const lat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const lng = points.reduce((s, p) => s + p.lng, 0) / points.length;
  let best = 0;
  let bestD = Infinity;
  points.forEach((p, i) => {
    const d = (p.lat - lat) ** 2 + (p.lng - lng) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

/** Własne przyciski +/- (styl aplikacji) i atrybucja bez flagi Leafleta. */
function MapControls() {
  const map = useMap();
  useEffect(() => {
    map.attributionControl?.setPrefix(false);
  }, [map]);
  return (
    <div
      className="rank-map-zoom"
      ref={(el) => {
        if (el) {
          L.DomEvent.disableClickPropagation(el);
          L.DomEvent.disableScrollPropagation(el);
        }
      }}
    >
      <button
        type="button"
        aria-label="Przybliż mapę"
        onClick={() => map.zoomIn()}
      >
        <Plus aria-hidden />
      </button>
      <button
        type="button"
        aria-label="Oddal mapę"
        onClick={() => map.zoomOut()}
      >
        <Minus aria-hidden />
      </button>
    </div>
  );
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
  phrase,
  className,
  canvasHeight,
}: {
  points: RankMapPoint[];
  /** Fraza skanu - do podpowiedzi przy punktach. */
  phrase?: string;
  className?: string;
  /** Override default canvas height (px), e.g. compact Pulpit map. */
  canvasHeight?: number;
}) {
  const center = useMemo<[number, number]>(() => {
    if (points.length === 0) return [52.23, 21.01];
    const lat = points.reduce((s, p) => s + p.lat, 0) / points.length;
    const lng = points.reduce((s, p) => s + p.lng, 0) / points.length;
    return [lat, lng];
  }, [points]);
  const centerIdx = useMemo(() => centerIndex(points), [points]);

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
          zoomControl={false}
          className="rank-map-canvas"
          style={canvasHeight ? { height: canvasHeight } : undefined}
        >
          <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_URL} />
          <FitBounds points={points} />
          <MapControls />
          {points.map((point, index) => {
            const isCenter = index === centerIdx;
            return (
              <Marker
                key={`${point.lat}-${point.lng}-${index}`}
                position={[point.lat, point.lng]}
                icon={pinIcon(point.position, isCenter)}
                zIndexOffset={isCenter ? 1000 : 0}
              >
                <Tooltip
                  direction="top"
                  offset={[0, -18]}
                  className="rank-map-tip"
                >
                  <strong>
                    {isCenter ? "Twoja firma · punkt środkowy" : "Punkt siatki"}
                  </strong>
                  <span>
                    {point.position == null || point.position >= 21
                      ? "Poza top 20"
                      : `Pozycja ${point.position}`}
                    {phrase ? ` dla „${phrase}”` : ""}
                  </span>
                </Tooltip>
              </Marker>
            );
          })}
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
