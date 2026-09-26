"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "gooey-toast";
import {
  Check,
  Crosshair,
  Map as MapIcon,
  Plus,
  RefreshCw,
  Search,
  TrendingUp,
  X,
} from "lucide-react";
import { RankLocalPackTable } from "@/features/wizytowka/components/rank-local-pack-table";
import { RankScanCalendar } from "@/features/wizytowka/components/rank-scan-calendar";
import {
  addRankKeyword,
  getRankScanStatus,
  refreshGbpPlaceIdAction,
  removeRankKeyword,
  startRankScan,
} from "@/features/wizytowka/rank/actions";
import type {
  RankKeywordView,
  RankScanView,
} from "@/features/wizytowka/rank/load-raport";
import {
  RANK_GRID_SIZE,
  RANK_MAX_KEYWORDS,
  RANK_RADIUS_OPTIONS_KM,
  RANK_TIMEZONE,
  type RankRadiusKm,
} from "@/lib/config/rank-limits";

const PHRASE_INPUT_MIN_CH = 22;

const RankMap = dynamic(
  () =>
    import("@/features/wizytowka/components/rank-map").then((m) => m.RankMap),
  {
    ssr: false,
    loading: () => (
      <div className="rank-map rank-map-loading">Ładowanie mapy…</div>
    ),
  },
);

function warsawTodayKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: RANK_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatAgr(value: number | null): string {
  if (value == null) return "-";
  return value.toLocaleString("pl-PL", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function formatAtgr(value: number | null): string {
  if (value == null) return "-";
  return `${(value * 100).toLocaleString("pl-PL", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function formatDeltaNum(
  delta: number | null,
  betterWhen: "lower" | "higher",
): { text: string; tone: "good" | "bad" | "neutral" } | null {
  if (delta == null) return { text: "- 0.0", tone: "neutral" };
  if (Math.abs(delta) < 0.05) return { text: "- 0.0", tone: "neutral" };
  const improved = betterWhen === "lower" ? delta < 0 : delta > 0;
  const abs = Math.abs(delta).toLocaleString("pl-PL", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  });
  const sign = delta > 0 ? "+" : "-";
  return {
    text: `${sign}${abs}`,
    tone: improved ? "good" : "bad",
  };
}

export function RankPositionsSection({
  placeId,
  businessName,
  keywords: initialKeywords,
  latestByKeyword: initialLatest,
  scansByKeywordDay: initialByDay,
  activeScan: initialActive,
}: {
  placeId: string | null;
  businessName: string;
  keywords: RankKeywordView[];
  latestByKeyword: Record<string, RankScanView | null>;
  scansByKeywordDay: Record<string, Record<string, RankScanView>>;
  activeScan: RankScanView | null;
}) {
  const [keywords, setKeywords] = useState(initialKeywords);
  const [latestByKeyword, setLatestByKeyword] = useState(initialLatest);
  const [scansByKeywordDay, setScansByKeywordDay] = useState(initialByDay);
  const [selectedKeywordId, setSelectedKeywordId] = useState(
    initialActive?.keywordId ?? initialKeywords[0]?.id ?? "",
  );
  const [selectedDay, setSelectedDay] = useState<string | null>(
    initialActive
      ? new Intl.DateTimeFormat("en-CA", {
          timeZone: RANK_TIMEZONE,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(initialActive.finishedAt ?? initialActive.startedAt))
      : warsawTodayKey(),
  );
  const [scan, setScan] = useState<RankScanView | null>(initialActive);
  const [hasPlaceId, setHasPlaceId] = useState(Boolean(placeId));
  const [adding, setAdding] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [addRadius, setAddRadius] = useState<RankRadiusKm>(10);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setKeywords(initialKeywords);
    setLatestByKeyword(initialLatest);
    setScansByKeywordDay(initialByDay);
    setHasPlaceId(Boolean(placeId));
  }, [initialKeywords, initialLatest, initialByDay, placeId]);

  const selectedKeyword = keywords.find((k) => k.id === selectedKeywordId);

  useEffect(() => {
    if (scan?.status === "running" && scan.keywordId === selectedKeywordId) {
      return;
    }
    const dayMap = scansByKeywordDay[selectedKeywordId] ?? {};
    if (selectedDay && dayMap[selectedDay]) {
      setScan(dayMap[selectedDay]);
      return;
    }
    setScan(latestByKeyword[selectedKeywordId] ?? null);
  }, [
    selectedKeywordId,
    selectedDay,
    scansByKeywordDay,
    latestByKeyword,
    scan?.status,
    scan?.keywordId,
  ]);

  useEffect(() => {
    if (!scan || scan.status !== "running") return;
    let cancelled = false;
    const timer = setInterval(() => {
      void (async () => {
        const res = await getRankScanStatus({ scanId: scan.id });
        if (cancelled || !res.ok) return;
        if (res.scan.status === "running") return;
        const day = new Intl.DateTimeFormat("en-CA", {
          timeZone: RANK_TIMEZONE,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(
          new Date(res.scan.finishedAt ?? res.scan.startedAt ?? Date.now()),
        );
        const view: RankScanView = {
          ...scan,
          status: res.scan.status,
          agr: res.scan.agr != null ? Number(res.scan.agr) : null,
          atgr: res.scan.atgr != null ? Number(res.scan.atgr) : null,
          localPackPosition: res.scan.localPackPosition,
          localPackResults: Array.isArray(res.scan.localPackResults)
            ? res.scan.localPackResults
            : [],
          finishedAt: res.scan.finishedAt
            ? new Date(res.scan.finishedAt).toISOString()
            : null,
          error: res.scan.error,
          results: res.results,
          deltaAgr: null,
          deltaAtgr: null,
          deltaLocalPack: null,
        };
        setScan(view);
        setLatestByKeyword((prev) => ({ ...prev, [view.keywordId]: view }));
        setScansByKeywordDay((prev) => ({
          ...prev,
          [view.keywordId]: { ...(prev[view.keywordId] ?? {}), [day]: view },
        }));
        setSelectedDay(day);
        setKeywords((prev) =>
          prev.map((k) =>
            k.id === view.keywordId
              ? {
                  ...k,
                  runningScanId: null,
                  scannedToday: view.status === "done" ? true : k.scannedToday,
                  scanDays: k.scanDays.includes(day)
                    ? k.scanDays
                    : [...k.scanDays, day],
                }
              : k,
          ),
        );
        if (view.status === "done") {
          toast.success({
            title: "Skan zakończony",
            description: "Mapa pozycji zaktualizowana.",
          });
        } else {
          toast.error({
            title: "Skan nieudany",
            description: view.error ?? "Spróbuj ponownie później.",
          });
        }
      })();
    }, 3000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [scan]);

  const phraseInputWidthCh = Math.min(
    48,
    Math.max(PHRASE_INPUT_MIN_CH, phrase.length + 2),
  );

  const canScan =
    hasPlaceId &&
    Boolean(selectedKeyword) &&
    !selectedKeyword?.scannedToday &&
    !selectedKeyword?.runningScanId &&
    scan?.status !== "running" &&
    !pending;

  const agrDelta = formatDeltaNum(scan?.deltaAgr ?? null, "lower");
  const atgrDelta = formatDeltaNum(
    scan?.deltaAtgr != null ? scan.deltaAtgr * 100 : null,
    "higher",
  );

  const hasMapData =
    scan &&
    scan.status === "done" &&
    scan.results.length > 0;

  function onConfirmAdd() {
    const value = phrase.trim();
    if (!value) {
      toast.error({ title: "Podaj frazę" });
      return;
    }
    if (keywords.length >= RANK_MAX_KEYWORDS) {
      toast.error({
        title: "Limit fraz",
        description: `Możesz mieć max ${RANK_MAX_KEYWORDS} fraz.`,
      });
      return;
    }
    startTransition(async () => {
      const res = await addRankKeyword({ phrase: value, radiusKm: addRadius });
      if (!res.ok) {
        toast.error({ title: "Nie dodano frazy", description: res.error });
        return;
      }
      const next: RankKeywordView = {
        id: res.keyword.id,
        phrase: res.keyword.phrase,
        defaultRadiusKm: res.keyword.defaultRadiusKm,
        createdAt: res.keyword.createdAt,
        scannedToday: false,
        runningScanId: null,
        scanDays: [],
      };
      setKeywords((prev) => [next, ...prev]);
      setLatestByKeyword((prev) => ({ ...prev, [next.id]: null }));
      setScansByKeywordDay((prev) => ({ ...prev, [next.id]: {} }));
      setSelectedKeywordId(next.id);
      setSelectedDay(warsawTodayKey());
      setScan(null);
      setPhrase("");
      setAdding(false);
      toast.success({ title: "Dodano frazę" });
    });
  }

  function onRemove(keywordId: string) {
    startTransition(async () => {
      const res = await removeRankKeyword({ keywordId });
      if (!res.ok) {
        toast.error({ title: "Nie usunięto", description: res.error });
        return;
      }
      const remaining = keywords.filter((k) => k.id !== keywordId);
      setKeywords(remaining);
      setLatestByKeyword((prev) => {
        const copy = { ...prev };
        delete copy[keywordId];
        return copy;
      });
      setScansByKeywordDay((prev) => {
        const copy = { ...prev };
        delete copy[keywordId];
        return copy;
      });
      if (selectedKeywordId === keywordId) {
        const nextId = remaining[0]?.id ?? "";
        setSelectedKeywordId(nextId);
        setScan(nextId ? latestByKeyword[nextId] ?? null : null);
        setSelectedDay(remaining[0]?.scanDays[0] ?? warsawTodayKey());
      }
      toast.success({ title: "Usunięto frazę" });
    });
  }

  function onScan() {
    if (!selectedKeyword) return;
    const radiusKm = selectedKeyword.defaultRadiusKm as RankRadiusKm;
    startTransition(async () => {
      const res = await startRankScan({
        keywordId: selectedKeyword.id,
        radiusKm,
      });
      if (!res.ok) {
        toast.error({ title: "Nie uruchomiono skanu", description: res.error });
        return;
      }
      toast.info({
        title: "Skan uruchomiony",
        description: "Trwa pobieranie pozycji w siatce…",
      });
      setKeywords((prev) =>
        prev.map((k) =>
          k.id === selectedKeyword.id
            ? { ...k, runningScanId: res.scanId }
            : k,
        ),
      );
      setScan({
        id: res.scanId,
        keywordId: selectedKeyword.id,
        phrase: selectedKeyword.phrase,
        status: "running",
        gridSize: RANK_GRID_SIZE,
        radiusKm,
        zoom: 14,
        agr: null,
        atgr: null,
        localPackPosition: null,
        localPackResults: [],
        startedAt: new Date().toISOString(),
        finishedAt: null,
        error: null,
        results: [],
        deltaAgr: null,
        deltaAtgr: null,
        deltaLocalPack: null,
      });
    });
  }

  function onRefreshPlaceId() {
    startTransition(async () => {
      const res = await refreshGbpPlaceIdAction();
      if (!res.ok) {
        toast.error({
          title: "Nie pobrano place_id",
          description: res.error,
        });
        setHasPlaceId(false);
        return;
      }
      setHasPlaceId(true);
      toast.success({ title: "Zaktualizowano identyfikator wizytówki" });
    });
  }

  const scanDays = selectedKeyword?.scanDays ?? [];

  const blockReason = useMemo(() => {
    if (!hasPlaceId) {
      return "Nie można zidentyfikować wizytówki w wynikach - pobierz ponownie dane z Google.";
    }
    if (!selectedKeyword) return null;
    if (selectedKeyword.runningScanId || scan?.status === "running") {
      return "Skan w toku…";
    }
    if (selectedKeyword.scannedToday) {
      return "Dziś już wykonano skan tej frazy - kolejny będzie dostępny jutro.";
    }
    return null;
  }, [hasPlaceId, selectedKeyword, scan?.status]);

  return (
    <section className="rank-section">
      <div className="rank-kpi-row">
        <div className="ui-kpi rank-kpi-card">
          <div className="rank-kpi-top">
            <p className="wiz-report-kpi-label">AGR (śr. pozycja)</p>
            <Crosshair aria-hidden className="rank-kpi-icon rank-kpi-icon-brand" />
          </div>
          <p className="wiz-report-kpi-value mono">{formatAgr(scan?.agr ?? null)}</p>
          {agrDelta ? (
            <p className={`rank-kpi-delta is-${agrDelta.tone} mono`}>
              {agrDelta.text}
            </p>
          ) : null}
        </div>
        <div className="ui-kpi rank-kpi-card">
          <div className="rank-kpi-top">
            <p className="wiz-report-kpi-label">ATGR (% w top 3)</p>
            <TrendingUp aria-hidden className="rank-kpi-icon rank-kpi-icon-success" />
          </div>
          <p className="wiz-report-kpi-value mono">
            {formatAtgr(scan?.atgr ?? null)}
          </p>
          {atgrDelta ? (
            <p className={`rank-kpi-delta is-${atgrDelta.tone} mono`}>
              {atgrDelta.text}
            </p>
          ) : null}
        </div>
        <div className="ui-kpi rank-kpi-card">
          <div className="rank-kpi-top">
            <p className="wiz-report-kpi-label">Frazy kluczowe</p>
            <span className="rank-kpi-icon rank-kpi-icon-warn" aria-hidden>
              ▮
            </span>
          </div>
          <p className="wiz-report-kpi-value mono">{keywords.length}</p>
        </div>
        <div className="ui-kpi rank-kpi-card">
          <div className="rank-kpi-top">
            <p className="wiz-report-kpi-label">Wyszukiwarka</p>
            <Search aria-hidden className="rank-kpi-icon rank-kpi-icon-info" />
          </div>
          <p className="wiz-report-kpi-value mono">
            {scan?.localPackPosition != null
              ? `poz. ${scan.localPackPosition}`
              : "-"}
          </p>
        </div>
      </div>

      {!hasPlaceId ? (
        <div className="locked-note rank-place-gate">
          <p>
            Nie można zidentyfikować wizytówki w wynikach. Pobierz ponownie dane
            z Google, zanim uruchomisz skan.
          </p>
          <button
            type="button"
            className="ui-btn ui-btn-outline ui-btn-sm"
            disabled={pending}
            onClick={onRefreshPlaceId}
          >
            <RefreshCw aria-hidden />
            Pobierz ponownie z Google
          </button>
        </div>
      ) : null}

      <div className="rank-toolbar">
        <div className="rank-toolbar-left">
          <h2 className="rank-section-title">
            <MapIcon aria-hidden />
            Mapa siatki pozycji
          </h2>
          <div className="rank-pills">
            {keywords.map((k) => {
              const active = k.id === selectedKeywordId;
              return (
                <div
                  key={k.id}
                  className={active ? "rank-pill is-active" : "rank-pill"}
                >
                  <button
                    type="button"
                    className="rank-pill-label"
                    onClick={() => {
                      setSelectedKeywordId(k.id);
                      const days = k.scanDays;
                      setSelectedDay(days[0] ?? warsawTodayKey());
                    }}
                  >
                    <span className="rank-pill-phrase">{k.phrase}</span>
                    <span className="rank-pill-radius">
                      {k.defaultRadiusKm} km
                    </span>
                  </button>
                  {active ? (
                    <button
                      type="button"
                      className="rank-pill-x"
                      aria-label={`Usuń frazę ${k.phrase}`}
                      disabled={pending || Boolean(k.runningScanId)}
                      onClick={() => onRemove(k.id)}
                    >
                      <X aria-hidden />
                    </button>
                  ) : null}
                </div>
              );
            })}
            {keywords.length > 0 ? (
              !adding ? (
              <button
                type="button"
                className="rank-add-phrase-btn"
                disabled={pending || keywords.length >= RANK_MAX_KEYWORDS}
                onClick={() => setAdding(true)}
              >
                <Plus aria-hidden />
                Fraza
              </button>
            ) : (
              <div className="rank-add-row">
                <input
                  className="ui-field rank-add-input"
                  value={phrase}
                  onChange={(e) => setPhrase(e.target.value)}
                  placeholder="np. dentysta Warszawa"
                  maxLength={120}
                  autoFocus
                  disabled={pending}
                  style={{ width: `${phraseInputWidthCh}ch` }}
                />
                <div className="rank-radius-seg" role="group" aria-label="Zasięg">
                  {RANK_RADIUS_OPTIONS_KM.map((km) => (
                    <button
                      key={km}
                      type="button"
                      className={
                        addRadius === km
                          ? "rank-radius-opt is-active"
                          : "rank-radius-opt"
                      }
                      onClick={() => setAddRadius(km)}
                      disabled={pending}
                    >
                      {km} km
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="rank-add-confirm"
                  aria-label="Dodaj frazę"
                  disabled={pending || !phrase.trim()}
                  onClick={onConfirmAdd}
                >
                  <Check aria-hidden />
                </button>
                <button
                  type="button"
                  className="rank-add-cancel"
                  aria-label="Anuluj"
                  disabled={pending}
                  onClick={() => {
                    setAdding(false);
                    setPhrase("");
                  }}
                >
                  <X aria-hidden />
                </button>
              </div>
            )
            ) : null}
          </div>
        </div>
      </div>

      <div className="rank-main-grid">
        <div className="rank-main-left">
          {hasMapData ? (
            <RankMap points={scan!.results} />
          ) : (
            <div className="rank-empty">
              <MapIcon aria-hidden className="rank-empty-icon" />
              <p className="rank-empty-title">Brak danych skanowania</p>
              <p className="rank-empty-desc">
                Dodaj frazy kluczowe, a następnie kliknij „Skanuj teraz” aby
                rozpocząć monitorowanie pozycji.
              </p>
              {keywords.length === 0 ? (
                adding ? (
                  <div className="rank-add-row rank-empty-add">
                    <input
                      className="ui-field rank-add-input"
                      value={phrase}
                      onChange={(e) => setPhrase(e.target.value)}
                      placeholder="np. dentysta Warszawa"
                      maxLength={120}
                      autoFocus
                      disabled={pending}
                      style={{ width: `${phraseInputWidthCh}ch` }}
                    />
                    <div
                      className="rank-radius-seg"
                      role="group"
                      aria-label="Zasięg"
                    >
                      {RANK_RADIUS_OPTIONS_KM.map((km) => (
                        <button
                          key={km}
                          type="button"
                          className={
                            addRadius === km
                              ? "rank-radius-opt is-active"
                              : "rank-radius-opt"
                          }
                          onClick={() => setAddRadius(km)}
                          disabled={pending}
                        >
                          {km} km
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="rank-add-confirm"
                      aria-label="Dodaj frazę"
                      disabled={pending || !phrase.trim()}
                      onClick={onConfirmAdd}
                    >
                      <Check aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="rank-add-cancel"
                      aria-label="Anuluj"
                      disabled={pending}
                      onClick={() => {
                        setAdding(false);
                        setPhrase("");
                      }}
                    >
                      <X aria-hidden />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="ui-btn ui-btn-primary"
                    disabled={
                      pending ||
                      !hasPlaceId ||
                      keywords.length >= RANK_MAX_KEYWORDS
                    }
                    onClick={() => setAdding(true)}
                  >
                    <Plus aria-hidden />
                    Dodaj frazę
                  </button>
                )
              ) : null}
              {selectedKeyword ? (
                <button
                  type="button"
                  className="ui-btn ui-btn-primary"
                  disabled={!canScan}
                  onClick={onScan}
                >
                  {scan?.status === "running" ? "Skan w toku…" : "Skanuj teraz"}
                </button>
              ) : null}
              {blockReason ? (
                <p className="locked-note rank-empty-note">{blockReason}</p>
              ) : null}
            </div>
          )}

          {hasMapData && canScan ? (
            <div className="rank-scan-bar">
              <button
                type="button"
                className="ui-btn ui-btn-primary"
                disabled={!canScan}
                onClick={onScan}
              >
                Skanuj teraz
              </button>
              {blockReason ? (
                <p className="text-sm text-muted-foreground">{blockReason}</p>
              ) : null}
            </div>
          ) : null}

          {hasMapData ? (
            <RankLocalPackTable
              rows={scan!.localPackResults}
              ownPlaceId={placeId}
              ownPosition={scan!.localPackPosition}
              errorHint={scan!.error}
            />
          ) : null}
        </div>

        <RankScanCalendar
          scanDays={scanDays}
          selectedDay={selectedDay}
          onSelectDay={(day) => {
            setSelectedDay(day);
            const found = scansByKeywordDay[selectedKeywordId]?.[day];
            if (found) setScan(found);
          }}
        />
      </div>

      {businessName ? (
        <p className="sr-only">Profil: {businessName}</p>
      ) : null}
    </section>
  );
}
