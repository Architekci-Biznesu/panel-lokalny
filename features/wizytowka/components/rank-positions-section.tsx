"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "gooey-toast";
import {
  Check,
  Crosshair,
  Map as MapIcon,
  Pencil,
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
  acceptSuggestedRankPhrase,
  dismissSuggestedRankPhrase,
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
  rankQueryCount,
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
  suggestedPhrases: initialSuggested = [],
}: {
  placeId: string | null;
  businessName: string;
  keywords: RankKeywordView[];
  latestByKeyword: Record<string, RankScanView | null>;
  scansByKeywordDay: Record<string, Record<string, RankScanView>>;
  activeScan: RankScanView | null;
  suggestedPhrases?: string[];
}) {
  const [keywords, setKeywords] = useState(initialKeywords);
  const [suggestedPhrases, setSuggestedPhrases] = useState(initialSuggested);
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

  const [propsSnap, setPropsSnap] = useState({
    initialKeywords,
    initialLatest,
    initialByDay,
    initialSuggested,
    placeId,
  });
  if (
    initialKeywords !== propsSnap.initialKeywords ||
    initialLatest !== propsSnap.initialLatest ||
    initialByDay !== propsSnap.initialByDay ||
    initialSuggested !== propsSnap.initialSuggested ||
    placeId !== propsSnap.placeId
  ) {
    setPropsSnap({
      initialKeywords,
      initialLatest,
      initialByDay,
      initialSuggested,
      placeId,
    });
    setKeywords(initialKeywords);
    setSuggestedPhrases(initialSuggested);
    setLatestByKeyword(initialLatest);
    setScansByKeywordDay(initialByDay);
    setHasPlaceId(Boolean(placeId));
  }

  const selectedKeyword = keywords.find((k) => k.id === selectedKeywordId);

  const selectionScan =
    selectedDay && scansByKeywordDay[selectedKeywordId]?.[selectedDay]
      ? scansByKeywordDay[selectedKeywordId][selectedDay]
      : (latestByKeyword[selectedKeywordId] ?? null);
  const keepRunning =
    scan?.status === "running" && scan.keywordId === selectedKeywordId;
  const [scanSnap, setScanSnap] = useState({
    selectedKeywordId,
    selectedDay,
    selectionScan,
    keepRunning,
  });
  if (
    !keepRunning &&
    (selectedKeywordId !== scanSnap.selectedKeywordId ||
      selectedDay !== scanSnap.selectedDay ||
      selectionScan !== scanSnap.selectionScan)
  ) {
    setScanSnap({
      selectedKeywordId,
      selectedDay,
      selectionScan,
      keepRunning,
    });
    setScan(selectionScan);
  } else if (keepRunning !== scanSnap.keepRunning) {
    setScanSnap({
      selectedKeywordId,
      selectedDay,
      selectionScan,
      keepRunning,
    });
  }

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

  const hasMapData = scan && scan.status === "done" && scan.results.length > 0;

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

  function onAcceptSuggested(phraseValue: string) {
    startTransition(async () => {
      const res = await acceptSuggestedRankPhrase({ phrase: phraseValue });
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
      setSuggestedPhrases((prev) =>
        prev.filter((p) => p.toLowerCase() !== phraseValue.toLowerCase()),
      );
      setSelectedKeywordId(next.id);
      setSelectedDay(warsawTodayKey());
      setScan(null);
      toast.success({
        title: "Dodano frazę",
        description: "Kliknij „Skanuj teraz”, aby uruchomić raport.",
      });
    });
  }

  function onDismissSuggested(phraseValue: string) {
    startTransition(async () => {
      const res = await dismissSuggestedRankPhrase({ phrase: phraseValue });
      if (!res.ok) {
        toast.error({ title: "Nie odrzucono", description: res.error });
        return;
      }
      setSuggestedPhrases((prev) =>
        prev.filter((p) => p.toLowerCase() !== phraseValue.toLowerCase()),
      );
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
        setScan(nextId ? (latestByKeyword[nextId] ?? null) : null);
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
          k.id === selectedKeyword.id ? { ...k, runningScanId: res.scanId } : k,
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
  const isRunning =
    Boolean(selectedKeyword?.runningScanId) || scan?.status === "running";
  const queryTotal = rankQueryCount(scan?.gridSize ?? RANK_GRID_SIZE);
  const queryDone = isRunning
    ? Math.min(scan?.results.length ?? 0, queryTotal)
    : 0;
  const outsideTop20 =
    scan?.results.filter((p) => p.position == null || p.position > 20).length ??
    0;
  const packDelta = formatDeltaNum(
    scan?.deltaLocalPack != null ? Number(scan.deltaLocalPack) : null,
    "lower",
  );

  const scanMeta = useMemo(() => {
    if (!scan) return null;
    const when = scan.finishedAt ?? scan.startedAt;
    if (!when) return null;
    const d = new Date(when);
    const date = new Intl.DateTimeFormat("pl-PL", {
      timeZone: RANK_TIMEZONE,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d);
    const time = new Intl.DateTimeFormat("pl-PL", {
      timeZone: RANK_TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
    return `Skan ${date} · ${time} · ${scan.radiusKm} km · ${scan.phrase}`;
  }, [scan]);

  const phrasesAtLimit = keywords.length >= RANK_MAX_KEYWORDS;

  function renderAddControls(emptyContext = false) {
    if (adding) {
      return (
        <div className={`rank-add-row${emptyContext ? " rank-empty-add" : ""}`}>
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
      );
    }

    return (
      <button
        type="button"
        className="rank-add-phrase-btn"
        disabled={pending || phrasesAtLimit || !hasPlaceId}
        title={
          phrasesAtLimit
            ? `Limit ${RANK_MAX_KEYWORDS} fraz - usuń jedną, żeby dodać nową`
            : undefined
        }
        onClick={() => setAdding(true)}
      >
        <Plus aria-hidden />
        Dodaj frazę
      </button>
    );
  }

  return (
    <section className="rank-section">
      <div className="rank-section-head">
        <h2 className="rank-section-title">
          <MapIcon aria-hidden />
          Mapa siatki pozycji
        </h2>
        <p className="rank-section-sub">
          Pozycja w Mapach Google w siatce {RANK_GRID_SIZE}×{RANK_GRID_SIZE}{" "}
          wokół firmy · max {RANK_MAX_KEYWORDS} fraz · 1 skan frazy dziennie
        </p>
      </div>

      <div className="rank-kpi-row">
        <div className="ui-kpi rank-kpi-card">
          <div className="rank-kpi-top">
            <p className="wiz-report-kpi-label">AGR (śr. pozycja)</p>
            <span className="rank-kpi-icon-wrap rank-kpi-icon-brand">
              <Crosshair aria-hidden className="rank-kpi-icon" />
            </span>
          </div>
          <p className="wiz-report-kpi-value mono">
            {formatAgr(scan?.agr ?? null)}
          </p>
          {agrDelta ? (
            <span className={`rank-kpi-delta is-${agrDelta.tone} mono`}>
              {agrDelta.text}
            </span>
          ) : null}
        </div>
        <div className="ui-kpi rank-kpi-card">
          <div className="rank-kpi-top">
            <p className="wiz-report-kpi-label">ATGR (% w top 3)</p>
            <span className="rank-kpi-icon-wrap rank-kpi-icon-success">
              <TrendingUp aria-hidden className="rank-kpi-icon" />
            </span>
          </div>
          <p className="wiz-report-kpi-value mono">
            {formatAtgr(scan?.atgr ?? null)}
          </p>
          {atgrDelta ? (
            <span className={`rank-kpi-delta is-${atgrDelta.tone} mono`}>
              {atgrDelta.text}
            </span>
          ) : null}
        </div>
        <div className="ui-kpi rank-kpi-card">
          <div className="rank-kpi-top">
            <p className="wiz-report-kpi-label">Frazy kluczowe</p>
            <span className="rank-kpi-icon-wrap rank-kpi-icon-warn">
              <Pencil aria-hidden className="rank-kpi-icon" />
            </span>
          </div>
          <p className="wiz-report-kpi-value mono">
            {keywords.length} / {RANK_MAX_KEYWORDS}
          </p>
        </div>
        <div className="ui-kpi rank-kpi-card">
          <div className="rank-kpi-top">
            <p className="wiz-report-kpi-label">Wyszukiwarka</p>
            <span className="rank-kpi-icon-wrap rank-kpi-icon-info">
              <Search aria-hidden className="rank-kpi-icon" />
            </span>
          </div>
          <p className="wiz-report-kpi-value mono">
            {scan?.localPackPosition != null
              ? `poz. ${scan.localPackPosition}`
              : "-"}
          </p>
          {scan?.deltaLocalPack != null && packDelta ? (
            <span className={`rank-kpi-delta is-${packDelta.tone} mono`}>
              {packDelta.text}
            </span>
          ) : null}
        </div>
      </div>

      {!hasPlaceId ? (
        <div className="rank-place-gate">
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

      <div className="rank-main-grid">
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
                  <span className="rank-pill-radius mono">
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
          {renderAddControls(false)}
        </div>

        <div className="rank-main-left">
          {isRunning || hasMapData ? (
            <section className="rank-map-card">
              {isRunning ? (
                <div className="rank-running">
                  <div className="rank-running-grid" aria-hidden>
                    {Array.from({ length: queryTotal }, (_, i) => (
                      <span
                        key={i}
                        className={`rank-running-dot${
                          i < queryDone ? " is-on" : ""
                        }`}
                      />
                    ))}
                  </div>
                  <p className="rank-running-title">Skan w toku…</p>
                  <p className="rank-running-desc">
                    Trwa pobieranie pozycji w siatce…{" "}
                    <span className="mono">
                      {queryDone} / {queryTotal}
                    </span>
                  </p>
                  <button
                    type="button"
                    className="ui-btn ui-btn-primary ui-btn-sm"
                    disabled
                  >
                    Skan w toku…
                  </button>
                </div>
              ) : (
                <RankMap
                  points={scan!.results}
                  phrase={selectedKeyword?.phrase}
                />
              )}
              {selectedKeyword ? (
                <div className="rank-scan-bar">
                  <p className="rank-scan-meta mono">
                    {scanMeta ??
                      (isRunning
                        ? `Skan w toku · ${selectedKeyword.phrase}`
                        : null)}
                  </p>
                  <button
                    type="button"
                    className="ui-btn ui-btn-primary ui-btn-sm"
                    disabled={!canScan}
                    title={
                      selectedKeyword.scannedToday
                        ? "Dziś już wykonano skan tej frazy"
                        : undefined
                    }
                    onClick={onScan}
                  >
                    <RefreshCw aria-hidden />
                    {isRunning ? "Skan w toku…" : "Skanuj teraz"}
                  </button>
                </div>
              ) : null}
            </section>
          ) : (
            <div className="rank-empty">
              <MapIcon aria-hidden className="rank-empty-icon" />
              <p className="rank-empty-title">Brak danych skanowania</p>
              <p className="rank-empty-desc">
                Dodaj frazy kluczowe, a następnie kliknij „Skanuj teraz”, aby
                rozpocząć monitorowanie pozycji.
              </p>
              {keywords.length === 0 && suggestedPhrases.length > 0 ? (
                <div className="rank-suggested">
                  <p className="rank-suggested-title">
                    Sugerowane frazy z analizy
                  </p>
                  <ul className="rank-suggested-list">
                    {suggestedPhrases.map((phraseValue) => (
                      <li key={phraseValue} className="rank-suggested-item">
                        <span className="rank-suggested-phrase">
                          {phraseValue}
                        </span>
                        <div className="rank-suggested-actions">
                          <button
                            type="button"
                            className="ui-btn ui-btn-primary ui-btn-sm"
                            disabled={pending}
                            aria-label={`Dodaj frazę ${phraseValue}`}
                            onClick={() => onAcceptSuggested(phraseValue)}
                          >
                            <Check aria-hidden />
                          </button>
                          <button
                            type="button"
                            className="ui-btn ui-btn-ghost ui-btn-sm"
                            disabled={pending}
                            aria-label={`Odrzuć frazę ${phraseValue}`}
                            onClick={() => onDismissSuggested(phraseValue)}
                          >
                            <X aria-hidden />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {keywords.length === 0 ? renderAddControls(true) : null}
              {selectedKeyword && !selectedKeyword.scannedToday ? (
                <button
                  type="button"
                  className="ui-btn ui-btn-primary ui-btn-sm"
                  disabled={!canScan}
                  onClick={onScan}
                >
                  Skanuj teraz
                </button>
              ) : null}
              {selectedKeyword?.scannedToday ? (
                <div className="rank-limit-note">
                  <p>
                    Limit dzienny - dziś już wykonano skan tej frazy. Kolejny
                    będzie dostępny jutro.
                  </p>
                  <button
                    type="button"
                    className="ui-btn ui-btn-primary ui-btn-sm"
                    disabled
                  >
                    Skanuj teraz
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {selectedKeyword?.scannedToday && hasMapData ? (
            <p className="locked-note rank-daily-hint">
              Dziś już wykonano skan tej frazy - kolejny będzie dostępny jutro.
            </p>
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

        <div className="rank-main-right">
          <RankScanCalendar
            scanDays={scanDays}
            selectedDay={selectedDay}
            onSelectDay={(day) => {
              setSelectedDay(day);
              const found = scansByKeywordDay[selectedKeywordId]?.[day];
              if (found) setScan(found);
            }}
          >
            {scan ? (
              <div className="rank-scan-summary">
                <p className="rank-scan-summary-label">
                  Skan z{" "}
                  <span className="mono">
                    {(selectedDay &&
                    scansByKeywordDay[selectedKeywordId]?.[selectedDay]
                      ? selectedDay
                      : scan.startedAt.slice(0, 10)
                    )
                      .split("-")
                      .reverse()
                      .join(".")}
                  </span>
                </p>
                <div className="rank-scan-summary-row">
                  <span>Punkty siatki</span>
                  <span className="mono">
                    {(scan?.gridSize ?? RANK_GRID_SIZE) *
                      (scan?.gridSize ?? RANK_GRID_SIZE)}{" "}
                    + 1
                  </span>
                </div>
                <div className="rank-scan-summary-row">
                  <span>Zasięg</span>
                  <span className="mono">
                    {scan?.radiusKm ?? selectedKeyword?.defaultRadiusKm ?? "-"}{" "}
                    km
                  </span>
                </div>
                <div className="rank-scan-summary-row">
                  <span>Poza top 20</span>
                  <span className="mono">
                    {hasMapData ? outsideTop20 : "-"}
                  </span>
                </div>
              </div>
            ) : null}
          </RankScanCalendar>
        </div>
      </div>

      {businessName ? <p className="sr-only">Profil: {businessName}</p> : null}
    </section>
  );
}
