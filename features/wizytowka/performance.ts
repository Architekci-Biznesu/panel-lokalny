import type { DailyMetric } from "@/lib/integrations/gbp/client";

export type MetricPoint = {
  date: string;
  value: number;
};

export type MetricSeries = {
  metric: DailyMetric;
  label: string;
  total: number;
  points: MetricPoint[];
};

export type DateParts = { year: number; month: number; day: number };

export const CORE_METRICS: DailyMetric[] = [
  "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
  "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
  "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
  "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
  "CALL_CLICKS",
  "WEBSITE_CLICKS",
  "BUSINESS_DIRECTION_REQUESTS",
];

export const OPTIONAL_METRICS: DailyMetric[] = [
  "BUSINESS_CONVERSATIONS",
  "BUSINESS_BOOKINGS",
  "BUSINESS_FOOD_ORDERS",
  "BUSINESS_FOOD_MENU_CLICKS",
];

export const ALL_PERFORMANCE_METRICS: DailyMetric[] = [
  ...CORE_METRICS,
  ...OPTIONAL_METRICS,
];

export const IMPRESSION_METRICS: DailyMetric[] = [
  "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
  "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
  "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
  "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
];

export const ACTION_METRICS: DailyMetric[] = [
  "CALL_CLICKS",
  "WEBSITE_CLICKS",
  "BUSINESS_DIRECTION_REQUESTS",
];

export const METRIC_LABELS: Record<DailyMetric, string> = {
  BUSINESS_IMPRESSIONS_DESKTOP_MAPS: "Wyświetlenia - mapy (desktop)",
  BUSINESS_IMPRESSIONS_DESKTOP_SEARCH: "Wyświetlenia - wyszukiwarka (desktop)",
  BUSINESS_IMPRESSIONS_MOBILE_MAPS: "Wyświetlenia - mapy (mobile)",
  BUSINESS_IMPRESSIONS_MOBILE_SEARCH: "Wyświetlenia - wyszukiwarka (mobile)",
  CALL_CLICKS: "Kliknięcia telefonu",
  WEBSITE_CLICKS: "Kliknięcia witryny",
  BUSINESS_DIRECTION_REQUESTS: "Prośby o dojazd",
  BUSINESS_CONVERSATIONS: "Rozmowy",
  BUSINESS_BOOKINGS: "Rezerwacje",
  BUSINESS_FOOD_ORDERS: "Zamówienia jedzenia",
  BUSINESS_FOOD_MENU_CLICKS: "Kliknięcia menu",
};

export const METRIC_SHORT_LABELS: Record<DailyMetric, string> = {
  BUSINESS_IMPRESSIONS_DESKTOP_MAPS: "Mapy desktop",
  BUSINESS_IMPRESSIONS_DESKTOP_SEARCH: "Wyszukiwarka desktop",
  BUSINESS_IMPRESSIONS_MOBILE_MAPS: "Mapy mobile",
  BUSINESS_IMPRESSIONS_MOBILE_SEARCH: "Wyszukiwarka mobile",
  CALL_CLICKS: "Telefon",
  WEBSITE_CLICKS: "Witryna",
  BUSINESS_DIRECTION_REQUESTS: "Dojazd",
  BUSINESS_CONVERSATIONS: "Rozmowy",
  BUSINESS_BOOKINGS: "Rezerwacje",
  BUSINESS_FOOD_ORDERS: "Zamówienia",
  BUSINESS_FOOD_MENU_CLICKS: "Menu",
};

export const REPORT_COLORS = {
  maps: "#6d4de8",
  search: "#14b8a6",
  directions: "#f59e0b",
  calls: "#6d4de8",
  website: "#14b8a6",
} as const;

export const MAX_RANGE_MONTHS = 18;
export const DEFAULT_RANGE_DAYS = 30;

export function toDateParts(d: Date): DateParts {
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
  };
}

export function fromDateParts(parts: DateParts): Date {
  return new Date(parts.year, parts.month - 1, parts.day);
}

export function formatDateIso(parts: DateParts): string {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function formatDatePl(parts: DateParts): string {
  return `${parts.day}.${parts.month}.${parts.year}`;
}

export function parseDateIso(value: string | undefined | null): DateParts | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const d = new Date(year, month - 1, day);
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

export function yesterdayParts(): DateParts {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - 1);
  return toDateParts(d);
}

export function addMonths(parts: DateParts, months: number): DateParts {
  const d = fromDateParts(parts);
  d.setMonth(d.getMonth() + months);
  return toDateParts(d);
}

export function addDays(parts: DateParts, days: number): DateParts {
  const d = fromDateParts(parts);
  d.setDate(d.getDate() + days);
  return toDateParts(d);
}

export function daysBetween(start: DateParts, end: DateParts): number {
  const a = fromDateParts(start).getTime();
  const b = fromDateParts(end).getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

export function defaultRange(): { start: DateParts; end: DateParts } {
  const end = yesterdayParts();
  const start = addDays(end, -(DEFAULT_RANGE_DAYS - 1));
  return { start, end };
}

/** Clamp range to API limits: end <= yesterday, span <= 18 months. */
export function clampRange(
  startIn: DateParts,
  endIn: DateParts,
): { start: DateParts; end: DateParts } {
  const maxEnd = yesterdayParts();
  let end = endIn;
  let start = startIn;

  if (fromDateParts(end) > fromDateParts(maxEnd)) end = maxEnd;
  if (fromDateParts(start) > fromDateParts(end)) start = end;

  const minStart = addMonths(end, -MAX_RANGE_MONTHS);
  if (fromDateParts(start) < fromDateParts(minStart)) start = minStart;

  return { start, end };
}

export function resolveRangeFromSearchParams(params: {
  start?: string;
  end?: string;
}): { start: DateParts; end: DateParts } {
  const parsedStart = parseDateIso(params.start);
  const parsedEnd = parseDateIso(params.end);
  if (!parsedStart || !parsedEnd) return defaultRange();
  return clampRange(parsedStart, parsedEnd);
}

function datedValueToIso(date: {
  year?: number;
  month?: number;
  day?: number;
}): string | null {
  if (!date.year || !date.month || !date.day) return null;
  return formatDateIso({
    year: date.year,
    month: date.month,
    day: date.day,
  });
}

export function parsePerformancePayload(payload: unknown): MetricSeries[] {
  const root = payload as {
    multiDailyMetricTimeSeries?: Array<{
      dailyMetricTimeSeries?: Array<{
        dailyMetric?: string;
        timeSeries?: {
          datedValues?: Array<{
            date?: { year?: number; month?: number; day?: number };
            value?: string;
          }>;
        };
      }>;
    }>;
  };

  const out: MetricSeries[] = [];
  for (const block of root.multiDailyMetricTimeSeries ?? []) {
    for (const series of block.dailyMetricTimeSeries ?? []) {
      const metric = series.dailyMetric as DailyMetric | undefined;
      if (!metric) continue;
      const points: MetricPoint[] = [];
      let total = 0;
      for (const point of series.timeSeries?.datedValues ?? []) {
        const iso = datedValueToIso(point.date ?? {});
        const value = Number(point.value ?? 0);
        if (!iso || Number.isNaN(value)) continue;
        points.push({ date: iso, value });
        total += value;
      }
      points.sort((a, b) => a.date.localeCompare(b.date));
      out.push({
        metric,
        label: METRIC_LABELS[metric] ?? metric,
        total,
        points,
      });
    }
  }
  return out;
}

export function emptySeriesForMetrics(metrics: DailyMetric[]): MetricSeries[] {
  return metrics.map((metric) => ({
    metric,
    label: METRIC_LABELS[metric] ?? metric,
    total: 0,
    points: [],
  }));
}

export function kpiSeriesToShow(series: MetricSeries[]): MetricSeries[] {
  const byMetric = new Map(series.map((s) => [s.metric, s]));
  const core = CORE_METRICS.map(
    (m) =>
      byMetric.get(m) ?? {
        metric: m,
        label: METRIC_LABELS[m],
        total: 0,
        points: [],
      },
  );
  const optional = OPTIONAL_METRICS.map((m) => byMetric.get(m)).filter(
    (s): s is MetricSeries => Boolean(s && s.total > 0),
  );
  return [...core, ...optional];
}

export function metricTotal(
  series: MetricSeries[],
  metric: DailyMetric,
): number {
  return series.find((s) => s.metric === metric)?.total ?? 0;
}

export function formatIntPl(value: number): string {
  return Math.round(value).toLocaleString("pl-PL");
}

export function formatRatePl(value: number): string {
  return value.toLocaleString("pl-PL", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

export type ReportBreakdownRow = {
  key: string;
  label: string;
  value: number;
  color: string;
};

export type ReportSummary = {
  viewsTotal: number;
  viewsBreakdown: ReportBreakdownRow[];
  mobileViews: number;
  desktopViews: number;
  actionsTotal: number;
  actionsBreakdown: ReportBreakdownRow[];
  actionsPer100: number;
};

export function buildReportSummary(series: MetricSeries[]): ReportSummary {
  const mapsDesktop = metricTotal(series, "BUSINESS_IMPRESSIONS_DESKTOP_MAPS");
  const mapsMobile = metricTotal(series, "BUSINESS_IMPRESSIONS_MOBILE_MAPS");
  const searchDesktop = metricTotal(
    series,
    "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
  );
  const searchMobile = metricTotal(
    series,
    "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
  );
  const maps = mapsDesktop + mapsMobile;
  const search = searchDesktop + searchMobile;
  const viewsTotal = maps + search;
  const mobileViews = mapsMobile + searchMobile;
  const desktopViews = mapsDesktop + searchDesktop;

  const directions = metricTotal(series, "BUSINESS_DIRECTION_REQUESTS");
  const calls = metricTotal(series, "CALL_CLICKS");
  const website = metricTotal(series, "WEBSITE_CLICKS");
  const actionsTotal = directions + calls + website;

  return {
    viewsTotal,
    viewsBreakdown: [
      { key: "maps", label: "Mapy", value: maps, color: REPORT_COLORS.maps },
      {
        key: "search",
        label: "Wyszukiwarka",
        value: search,
        color: REPORT_COLORS.search,
      },
    ],
    mobileViews,
    desktopViews,
    actionsTotal,
    actionsBreakdown: [
      {
        key: "directions",
        label: "Dojazd",
        value: directions,
        color: REPORT_COLORS.directions,
      },
      {
        key: "calls",
        label: "Telefon",
        value: calls,
        color: REPORT_COLORS.calls,
      },
      {
        key: "website",
        label: "Witryna",
        value: website,
        color: REPORT_COLORS.website,
      },
    ],
    actionsPer100: viewsTotal > 0 ? (actionsTotal / viewsTotal) * 100 : 0,
  };
}

export function buildChartRows(
  series: MetricSeries[],
  metrics: DailyMetric[],
): Array<Record<string, string | number>> {
  const map = new Map<string, Record<string, string | number>>();
  for (const metric of metrics) {
    const item = series.find((s) => s.metric === metric);
    if (!item) continue;
    for (const point of item.points) {
      const row = map.get(point.date) ?? { date: point.date };
      row[metric] = point.value;
      map.set(point.date, row);
    }
  }
  return [...map.values()].sort((a, b) =>
    String(a.date).localeCompare(String(b.date)),
  );
}

function weekStartIso(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return formatDateIso(toDateParts(d));
}

function sumMetricOnDate(
  series: MetricSeries[],
  metrics: DailyMetric[],
  date: string,
): number {
  let sum = 0;
  for (const metric of metrics) {
    const item = series.find((s) => s.metric === metric);
    if (!item) continue;
    const point = item.points.find((p) => p.date === date);
    if (point) sum += point.value;
  }
  return sum;
}

export type WeeklyViewsRow = {
  date: string;
  maps: number;
  search: number;
};

export type WeeklyActionsRow = {
  date: string;
  directions: number;
  calls: number;
  website: number;
};

export function buildWeeklyViewsRows(series: MetricSeries[]): WeeklyViewsRow[] {
  const dates = new Set<string>();
  for (const metric of IMPRESSION_METRICS) {
    const item = series.find((s) => s.metric === metric);
    for (const point of item?.points ?? []) dates.add(point.date);
  }

  const weeks = new Map<string, WeeklyViewsRow>();
  for (const date of dates) {
    const week = weekStartIso(date);
    const row = weeks.get(week) ?? { date: week, maps: 0, search: 0 };
    row.maps += sumMetricOnDate(series, [
      "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
      "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
    ], date);
    row.search += sumMetricOnDate(series, [
      "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
      "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
    ], date);
    weeks.set(week, row);
  }

  return [...weeks.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function buildWeeklyActionsRows(
  series: MetricSeries[],
): WeeklyActionsRow[] {
  const dates = new Set<string>();
  for (const metric of ACTION_METRICS) {
    const item = series.find((s) => s.metric === metric);
    for (const point of item?.points ?? []) dates.add(point.date);
  }

  const weeks = new Map<string, WeeklyActionsRow>();
  for (const date of dates) {
    const week = weekStartIso(date);
    const row = weeks.get(week) ?? {
      date: week,
      directions: 0,
      calls: 0,
      website: 0,
    };
    row.directions += sumMetricOnDate(
      series,
      ["BUSINESS_DIRECTION_REQUESTS"],
      date,
    );
    row.calls += sumMetricOnDate(series, ["CALL_CLICKS"], date);
    row.website += sumMetricOnDate(series, ["WEBSITE_CLICKS"], date);
    weeks.set(week, row);
  }

  return [...weeks.values()].sort((a, b) => a.date.localeCompare(b.date));
}
