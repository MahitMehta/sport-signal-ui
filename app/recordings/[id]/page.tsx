"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Hls from "hls.js";
import {
  Activity,
  ArrowLeft,
  ChevronRight,
  Code2,
  Download,
  Play,
  Radio,
  Square,
  Trash2,
  TrendingDown,
  TrendingUp,
  Minus,
  Wallet,
  Zap,
} from "lucide-react";
import KalshiChart from "@/app/components/KalshiChart";

/* ------------------------------------------------------------------ */
/*  DATA                                                               */
/* ------------------------------------------------------------------ */

interface Game {
  id: string;
  teamA: string;
  teamB: string;
  teamAShort: string;
  teamBShort: string;
  scoreA: number;
  scoreB: number;
  spread: string;
  kalshiTicker: string;
  kalshiStartTs: number;
  kalshiEndTs: number;
  kalshiUrl: string;
  date: string;
  videoSrc?: string;
  espnEventId?: string; // ESPN game summary event ID
}

const RECORDINGS: Record<string, Game> = {
  "1": {
    id: "1",
    teamA: "Arizona Wildcats",
    teamB: "Kansas Jayhawks",
    teamAShort: "ARIZ",
    teamBShort: "KU",
    scoreA: 67,
    scoreB: 72,
    spread: "KU -3.5",
    kalshiTicker: "KXNCAAMBGAME-26FEB09ARIZKU",
    kalshiStartTs: 1770494460,
    kalshiEndTs: 1770697320,
    kalshiUrl:
      "https://kalshi.com/markets/kxncaambgame/mens-college-basketball-mens-game/kxncaambgame-26feb09arizku",
    date: "Feb 9, 2026",
    videoSrc: "/recordings/26feb09arizku.mp4",
    espnEventId: "401820818",
  },
  "7": {
    id: "7",
    teamA: "Auburn Tigers",
    teamB: "Alabama Crimson Tide",
    teamAShort: "AUB",
    teamBShort: "BAMA",
    scoreA: 81,
    scoreB: 76,
    spread: "AUB -2.5",
    kalshiTicker: "KXNCAAMBGAME-26FEB06AUBBAMA",
    kalshiStartTs: 0,
    kalshiEndTs: 0,
    kalshiUrl:
      "https://kalshi.com/markets/kxncaambgame/mens-college-basketball-mens-game/kxncaambgame-26feb06aubbama",
    date: "Feb 26, 2026",
  },
  "8": {
    id: "8",
    teamA: "UConn Huskies",
    teamB: "Villanova Wildcats",
    teamAShort: "UCONN",
    teamBShort: "NOVA",
    scoreA: 69,
    scoreB: 63,
    spread: "UCONN -7.0",
    kalshiTicker: "KXNCAAMBGAME-26FEB05UCONNNOVA",
    kalshiStartTs: 0,
    kalshiEndTs: 0,
    kalshiUrl:
      "https://kalshi.com/markets/kxncaambgame/mens-college-basketball-mens-game/kxncaambgame-26feb05uconnnova",
    date: "Feb 26, 2026",
  },
};

/* ------------------------------------------------------------------ */
/*  TYPES                                                              */
/* ------------------------------------------------------------------ */

interface LogEntry {
  id: string;
  ts: string;
  text: string;
  pending: boolean;
  error: boolean;
  dim: boolean;
}

interface TradeResult {
  order_id: string;
  ticker: string;
  action: string;
  side: string;
  contracts: number;
  price: number;
  buying_power: number;
  ts: number;
}

interface Position {
  side: "yes" | "no";
  contracts: number;
  avg_price: number;
}

interface PositionsData {
  buying_power: number;
  positions: Record<string, Position>;
  trade_history: {
    ts: number;
    ticker: string;
    action: string;
    contracts: number;
    price: number;
  }[];
}

/* ------------------------------------------------------------------ */
/*  CONSTANTS                                                          */
/* ------------------------------------------------------------------ */

const SCALE_W = 480;
const INFER_URL = "http://localhost:8080/infer";
const DECISION_URL = "http://localhost:8080";

/* ------------------------------------------------------------------ */
/*  SCORE ANIMATION                                                    */
/* ------------------------------------------------------------------ */

/** One digit slot — old digit exits up, new enters from below (slot machine). */
function ScoreDigit({ char, highlight }: { char: string; highlight: boolean }) {
  return (
    <span
      className="relative inline-block overflow-hidden"
      style={{ height: "1em", minWidth: char === " " ? "0.35em" : "0.6em" }}
    >
      <AnimatePresence initial={false}>
        <motion.span
          key={char}
          initial={{ y: "100%", opacity: 0.5 }}
          animate={{ y: "0%", opacity: 1 }}
          exit={{ y: "-100%", opacity: 0.5 }}
          transition={{ type: "spring", stiffness: 500, damping: 38, mass: 0.75 }}
          className={`absolute inset-0 flex items-center justify-center font-mono font-black tabular-nums leading-none select-none ${
            highlight ? "text-accent" : "text-foreground/35"
          }`}
        >
          {char}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Full animated score number with per-digit roll + floating +N delta badge.
 *  Pads to 2 digits so key indices stay stable (avoids phantom "0" on rollover). */
function AnimatedScore({
  value,
  highlight,
}: {
  value: number;
  highlight: boolean;
}) {
  const prevRef = useRef(value);
  const [deltas, setDeltas] = useState<{ id: number; val: number }[]>([]);

  useEffect(() => {
    if (value > prevRef.current) {
      const diff = value - prevRef.current;
      const id = Date.now() + Math.random();
      setDeltas((d) => [...d, { id, val: diff }]);
      const t = setTimeout(
        () => setDeltas((d) => d.filter((x) => x.id !== id)),
        1600
      );
      return () => clearTimeout(t);
    }
    prevRef.current = value;
  }, [value]);

  // Pad to 2 chars so digit slot keys are stable across 1-digit → 2-digit transitions.
  // Leading zero slot is hidden when value < 10 via opacity so it doesn't show.
  const padded = String(value).padStart(2, "0");
  const chars = padded.split("");
  const hideLeading = value < 10; // hide the "0" pad when score is a single digit

  return (
    <div className="relative inline-flex items-center text-5xl sm:text-6xl">
      {chars.map((char, i) => (
        <span key={i} className={i === 0 && hideLeading ? "opacity-0 w-0 overflow-hidden" : ""}>
          <ScoreDigit char={char} highlight={highlight} />
        </span>
      ))}

      {/* Floating +N badges */}
      {deltas.map(({ id, val }) => (
        <span
          key={id}
          className="delta-rise absolute -top-2 left-1/2 -translate-x-1/2 text-base sm:text-lg font-black text-accent whitespace-nowrap"
          style={{ textShadow: "0 0 16px rgba(207,185,145,0.9)" }}
        >
          +{val}
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  OBSERVATION PARSING                                                */
/* ------------------------------------------------------------------ */

interface ParsedObs {
  description: string | null;
  team: "A" | "B" | null;
  magnitude: number | null;
  eventType: string | null;
  scoreA: number | null;
  scoreB: number | null;
  clock: string | null;
  period: string | null;
}

function parseObservation(text: string): ParsedObs {
  const result: ParsedObs = {
    description: null,
    team: null,
    magnitude: null,
    eventType: null,
    scoreA: null,
    scoreB: null,
    clock: null,
    period: null,
  };

  for (const line of text.trim().split("\n")) {
    if (line.startsWith("score: ")) {
      const cols = line.slice(7).split(",");
      const a = parseInt(cols[0]);
      const b = parseInt(cols[1]);
      if (!isNaN(a)) result.scoreA = a;
      if (!isNaN(b)) result.scoreB = b;
      result.clock = cols[2]?.trim() || null;
      const per = parseInt(cols[3]);
      if (!isNaN(per)) result.period = `${per}H`;
    } else if (line.trim()) {
      // Momentum CSV: "53.0,Arizona scores on fast break,team_A,5,quick transition"
      const cols = line.split(",");
      if (cols.length >= 2 && !isNaN(parseFloat(cols[0]))) {
        result.description = cols[1]?.trim() || null;
        const t = cols[2]?.trim();
        result.team = t === "team_A" ? "A" : t === "team_B" ? "B" : null;
        const mag = parseInt(cols[3]);
        result.magnitude = isNaN(mag) ? null : Math.min(5, Math.max(1, mag));
        result.eventType = cols[4]?.trim().replace(/_/g, " ") || null;
      } else {
        result.description = line.trim();
      }
    }
  }
  return result;
}

function ObservationEntry({
  entry,
  teamAShort,
  teamBShort,
  isLatest,
  rawMode,
}: {
  entry: LogEntry;
  teamAShort: string;
  teamBShort: string;
  isLatest: boolean;
  rawMode: boolean;
}) {
  if (entry.pending) {
    return (
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-surface-border/40">
        <span className="w-2.5 h-2.5 border border-accent border-t-transparent rounded-full animate-spin shrink-0" />
        <span className="text-[11px] text-muted/40">Analyzing frame…</span>
      </div>
    );
  }

  if (entry.error) {
    return (
      <div className="flex gap-3 px-4 py-3 border-b border-surface-border/40">
        <div className="w-0.5 bg-red-500/50 rounded-full shrink-0 self-stretch" />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-red-400/80 leading-snug">{entry.text}</p>
          <p className="text-[10px] text-muted/25 font-mono mt-0.5">{entry.ts}</p>
        </div>
      </div>
    );
  }

  // Hide dim "no data" entries — they clutter without adding value
  if (entry.dim) return null;

  // Raw mode — show the unformatted text from the model
  if (rawMode) {
    return (
      <div
        className={`px-4 py-3 border-b border-surface-border/30 last:border-0 ${
          isLatest ? "bg-surface-light/25" : ""
        }`}
      >
        <pre className="text-[10px] font-mono text-muted/60 whitespace-pre-wrap break-all leading-relaxed">
          {entry.text}
        </pre>
        <p className="text-[9px] font-mono text-muted/25 mt-1">{entry.ts}</p>
      </div>
    );
  }

  const obs = parseObservation(entry.text);
  const teamLabel =
    obs.team === "A" ? teamAShort : obs.team === "B" ? teamBShort : null;

  const description = obs.description
    ? obs.description.charAt(0).toUpperCase() + obs.description.slice(1)
    : null;

  const eventLabel = obs.eventType
    ? obs.eventType.charAt(0).toUpperCase() + obs.eventType.slice(1)
    : null;

  return (
    <div
      className={`flex gap-3 px-4 py-3 border-b border-surface-border/30 last:border-0 ${
        isLatest ? "bg-surface-light/25" : ""
      }`}
    >
      <div className="w-0.5 rounded-full shrink-0 self-stretch bg-green-500/35" />
      <div className="flex-1 min-w-0">
        {/* Main description */}
        {description && (
          <p className="text-[12px] text-foreground/80 leading-snug mb-1.5">
            {description}
          </p>
        )}

        {/* Metadata chips */}
        <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
          {teamLabel && (
            <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-sm bg-accent/10 text-accent border border-accent/15">
              {teamLabel}
            </span>
          )}
          {eventLabel && (
            <span className="text-[10px] text-muted/50 capitalize">{eventLabel}</span>
          )}
          {obs.magnitude !== null && (
            <span className="flex items-center gap-[2px]" title={`Intensity ${obs.magnitude}/5`}>
              {[1, 2, 3, 4, 5].map((i) => (
                <span
                  key={i}
                  className={`inline-block w-1 h-1 rounded-full ${
                    i <= obs.magnitude! ? "bg-accent/70" : "bg-muted/15"
                  }`}
                />
              ))}
            </span>
          )}

          {/* Score + clock — right-aligned */}
          {obs.scoreA !== null && obs.scoreB !== null && (
            <span className="ml-auto text-[10px] font-mono text-muted/35">
              {obs.scoreA}–{obs.scoreB}
              {obs.clock ? ` · ${obs.clock}` : ""}
              {obs.period ? ` · ${obs.period}` : ""}
            </span>
          )}
          {obs.scoreA === null && (
            <span className="ml-auto text-[10px] font-mono text-muted/25">
              {entry.ts}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  HELPERS                                                            */
/* ------------------------------------------------------------------ */

function getActionStyle(action: string) {
  const upper = action?.toUpperCase() ?? "";
  if (upper.startsWith("BUY") || upper.includes("BUY"))
    return {
      bg: "bg-green-500/10",
      border: "border-green-500/25",
      text: "text-green-400",
      badge: "bg-green-500/20 border-green-500/30 text-green-400",
      glow: "shadow-[0_0_40px_rgba(34,197,94,0.08)]",
      icon: <TrendingUp className="w-5 h-5" />,
    };
  if (action === "SELL" || action?.startsWith("SELL"))
    return {
      bg: "bg-red-500/10",
      border: "border-red-500/25",
      text: "text-red-400",
      badge: "bg-red-500/20 border-red-500/30 text-red-400",
      glow: "shadow-[0_0_40px_rgba(239,68,68,0.08)]",
      icon: <TrendingDown className="w-5 h-5" />,
    };
  return {
    bg: "bg-surface-light",
    border: "border-surface-border",
    text: "text-muted",
    badge: "bg-surface border-surface-border text-muted",
    glow: "",
    icon: <Minus className="w-5 h-5" />,
  };
}

/* ------------------------------------------------------------------ */
/*  PAGE                                                               */
/* ------------------------------------------------------------------ */

export default function RecordingDashboard({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const streamUrl = id === "live" ? searchParams.get("stream") : null;
  const isLive = id === "live" && !!streamUrl;

  const game = isLive
    ? {
        id: "live",
        teamA: "Team A",
        teamB: "Team B",
        teamAShort: "A",
        teamBShort: "B",
        scoreA: 0,
        scoreB: 0,
        spread: "—",
        kalshiTicker: "",
        kalshiStartTs: 0,
        kalshiEndTs: 0,
        kalshiUrl: "",
        date: new Date().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
      }
    : RECORDINGS[id];

  /* refs */
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const autoRunning = useRef(false);
  const rafId = useRef<number | null>(null);
  const lastCaptureTime = useRef(-1);
  const sequenceRef = useRef(0);
  const pregameTagsRef = useRef<{
    game_tag: string;
    h_tag: string;
    a_tag: string;
    e_tag: string;
  } | null>(null);
  const marketTickersRef = useRef<string[]>([]);

  /* state */
  const [capturing, setCapturing] = useState(false);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [rawMode, setRawMode] = useState(false);
  const [inflight, setInflight] = useState(0);
  const [doneTotal, setDoneTotal] = useState(0);
  const [liveScoreA, setLiveScoreA] = useState(0);
  const [liveScoreB, setLiveScoreB] = useState(0);
  const [gameClock, setGameClock] = useState("—");
  const [period, setPeriod] = useState("—");
  const [momentum, setMomentum] = useState("—");
  const [correction, setCorrection] = useState("");
  const [pregameStatus, setPregameStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const chartPricesRef = useRef<Record<string, number>>({});
  const [chartPrices, setChartPrices] = useState<Record<string, number>>({});
  const [tradeLoading, setTradeLoading] = useState(false);
  const [tradeResults, setTradeResults] = useState<TradeResult[]>([]);
  const [positionsData, setPositionsData] = useState<PositionsData | null>(null);
  const [tradeSignal, setTradeSignal] = useState<{
    analysis: string;
    signals: {
      market_ticker: string;
      yes_price: number | null;
      trend: string;
      action_taken: string;
    }[];
  } | null>(null);

  const pnl = useMemo(() => {
    const cashFlow = tradeResults.reduce((sum, t) => {
      const mult = t.action.toLowerCase().includes("buy") ? -1 : 1;
      return sum + mult * t.contracts * t.price;
    }, 0);
    let unrealized = 0;
    if (positionsData) {
      for (const [ticker, pos] of Object.entries(positionsData.positions)) {
        const currentPrice = chartPrices[ticker] / 100;
        if (currentPrice != null) {
          unrealized += pos.side === "yes"
            ? pos.contracts * currentPrice
            : pos.contracts * (1 - currentPrice);
        }
      }
    }
    return cashFlow + unrealized;
  }, [tradeResults, positionsData, chartPrices]);

  const onPriceAtPlayhead = useCallback((prices: Record<string, number>) => {
    chartPricesRef.current = prices;
    setChartPrices((prev) => {
      const keys = Object.keys(prices);
      if (keys.length === Object.keys(prev).length && keys.every((k) => prev[k] === prices[k])) return prev;
      return prices;
    });
  }, []);

  /* ---- trade helpers ---- */

  const executeTrade = useCallback(
    (action: "buy" | "sell", ticker: string, side: string, contracts: number, price: number) => {
      fetch(`${DECISION_URL}/trade/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, side, contracts, price }),
      })
        .then((r) => {
          if (!r.ok) throw new Error(`${r.status}`);
          return r.json();
        })
        .then((data) => {
          if (!data.order_id) return;
          const result: TradeResult = {
            order_id: data.order_id,
            ticker: data.ticker,
            action: data.action,
            side: data.side,
            contracts: data.contracts,
            price: data.price,
            buying_power: data.buying_power,
            ts: Date.now(),
          };
          setTradeResults((prev) => [result, ...prev]);
          fetchPositions();
        })
        .catch((e) => console.error(`[trade/${action}] failed:`, e));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const fetchPositions = useCallback(() => {
    fetch(`${DECISION_URL}/positions`)
      .then((r) => r.json())
      .then((data: PositionsData) => setPositionsData(data))
      .catch((e) => console.error("[positions] failed:", e));
  }, []);

  /* ---- capture helpers ---- */

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const scale = Math.min(1, SCALE_W / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return {
      timestamp: video.currentTime,
      base64: canvas.toDataURL("image/jpeg", 0.5).split(",")[1],
    };
  }, []);

  const fireInference = useCallback(
    (frame: { timestamp: number; base64: string }) => {
      const mins = Math.floor(frame.timestamp / 60);
      const secs = Math.floor(frame.timestamp % 60);
      const ts = `${mins}:${String(secs).padStart(2, "0")}`;
      const entryId = `e${Date.now()}${Math.random().toString(36).slice(2, 6)}`;

      setEntries((prev) => [
        { id: entryId, ts, text: "...", pending: true, error: false, dim: false },
        ...prev,
      ]);
      setInflight((n) => n + 1);

      fetch(INFER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timestamp: frame.timestamp,
          base64: frame.base64,
          prompt: "",
        }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.error) {
            setEntries((prev) =>
              prev.map((e) =>
                e.id === entryId
                  ? { ...e, pending: false, error: true, text: data.error }
                  : e
              )
            );
            return;
          }

          if (data.momentum !== undefined) {
            const momentumStr = (data.momentum || "").trim();
            const scoreStr = (data.score || "").trim();
            const lines: string[] = [];
            if (momentumStr && momentumStr !== "NONE") lines.push(momentumStr);
            if (scoreStr && scoreStr !== "NONE")
              lines.push(`score: ${scoreStr}`);

            const isDim = lines.length === 0;
            setEntries((prev) =>
              prev.map((e) =>
                e.id === entryId
                  ? {
                      ...e,
                      pending: false,
                      text: isDim ? "(no data)" : lines.join("\n"),
                      dim: isDim,
                    }
                  : e
              )
            );

            if (scoreStr && scoreStr !== "NONE") {
              const cols = scoreStr.split(",");
              if (cols.length >= 3) {
                const a = parseInt(cols[0], 10);
                const b = parseInt(cols[1], 10);
                const clock = cols[2]?.trim() || "";
                const per = cols[3] ? parseInt(cols[3].trim(), 10) : null;
                if (!Number.isNaN(a)) setLiveScoreA(a);
                if (!Number.isNaN(b)) setLiveScoreB(b);
                if (clock) setGameClock(clock);
                if (per && !Number.isNaN(per)) setPeriod(`${per}H`);
              }
            }

            if (momentumStr && momentumStr !== "NONE") {
              const mCols = momentumStr.split(",");
              if (mCols.length >= 5) {
                setMomentum(
                  `${mCols[2]?.trim() || "neutral"} ${mCols[3]?.trim() || "0"}`
                );
              }

              const tags = pregameTagsRef.current;
              const tickers = marketTickersRef.current;
              if (tags && tickers.length > 0) {
                const action = mCols[1]?.trim() || momentumStr;
                const seqNum = sequenceRef.current++;
                const scoreCols = scoreStr ? scoreStr.split(",") : [];
                const clockStr = scoreCols[2]?.trim() || undefined;
                setTradeLoading(true);
                fetch(`${DECISION_URL}/live`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    game_tag: tags.game_tag,
                    h_tag: tags.h_tag,
                    a_tag: tags.a_tag,
                    e_tag: tags.e_tag,
                    event: action,
                    game_time: clockStr,
                    sequence: seqNum,
                    market_tickers: tickers,
                    current_time: Math.floor(Date.now() / 1000),
                  }),
                })
                  .then((r) => r.json())
                  .then((liveData) => {
                    if (liveData.analysis) {
                      setTradeSignal({
                        analysis: liveData.analysis,
                        signals: (liveData.market_signals ?? []).map(
                          (s: {
                            market_ticker: string;
                            yes_price: number | null;
                            trend: string;
                            action_taken: string;
                          }) => ({
                            market_ticker: s.market_ticker,
                            yes_price: s.yes_price ?? null,
                            trend: s.trend,
                            action_taken: s.action_taken ?? "HOLD",
                          })
                        ),
                      });

                      // Execute trades for BUY/SELL signals
                      const signals = liveData.market_signals ?? [];
                      for (const sig of signals) {
                        const parts = sig.action_taken.split(/\s+/);
                        const verb = parts[0]?.toUpperCase();
                        if (verb !== "BUY" && verb !== "SELL") continue;
                        const side = (parts[1] || "yes").toLowerCase();
                        const contractsStr = parts[2]?.replace(/c$/i, "");
                        const contracts = contractsStr ? parseInt(contractsStr, 10) : 5;
                        const chartPrice = chartPricesRef.current[sig.market_ticker] ?? Object.values(chartPricesRef.current)[0];
                        executeTrade(
                          verb.toLowerCase() as "buy" | "sell",
                          sig.market_ticker,
                          side,
                          Number.isNaN(contracts) ? 5 : contracts,
                          sig.yes_price ?? chartPrice / 100,
                        );
                      }
                    }
                  })
                  .catch((e) => console.error("[live] failed:", e))
                  .finally(() => setTradeLoading(false));
              }
            }

            if (data.clock_correction) {
              if (data.clock_correction.accepted) {
                setCorrection("");
              } else {
                if (data.clock_correction.corrected_display) {
                  setGameClock(data.clock_correction.corrected_display);
                }
                setCorrection(
                  `CORRECTING (${data.clock_correction.outlier_streak}/30)`
                );
              }
            }
          } else {
            const resp = (data.response || "").trim();
            if (resp === "NONE" || resp === "") {
              setEntries((prev) =>
                prev.map((e) =>
                  e.id === entryId
                    ? { ...e, pending: false, text: "(no score visible)", dim: true }
                    : e
                )
              );
            } else {
              setEntries((prev) =>
                prev.map((e) =>
                  e.id === entryId ? { ...e, pending: false, text: resp } : e
                )
              );

              const lines = resp.split("\n");
              for (const line of lines) {
                const cols = line.split(",");
                if (cols.length >= 8) {
                  const a = parseInt(cols[2], 10);
                  const b = parseInt(cols[3], 10);
                  const clock = cols[4]?.trim() || "";
                  if (!Number.isNaN(a)) setLiveScoreA(a);
                  if (!Number.isNaN(b)) setLiveScoreB(b);
                  if (clock) setGameClock(clock);
                  const mTeam = cols[5]?.trim() || "neutral";
                  const mScore = cols[6]?.trim() || "0";
                  setMomentum(`${mTeam} ${mScore}`);
                }
              }
            }
          }
        })
        .catch((err) => {
          setEntries((prev) =>
            prev.map((e) =>
              e.id === entryId
                ? { ...e, pending: false, error: true, text: err.message }
                : e
            )
          );
        })
        .finally(() => {
          setInflight((n) => Math.max(0, n - 1));
          setDoneTotal((n) => n + 1);
        });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  /* ---- auto capture loop ---- */

  const autoLoopRef = useRef<() => void>(() => {});

  useEffect(() => {
    autoLoopRef.current = () => {
      if (!autoRunning.current) return;
      rafId.current = requestAnimationFrame(autoLoopRef.current);

      const video = videoRef.current;
      if (!video || video.paused || video.ended) return;

      const tRounded = Math.floor(video.currentTime);
      if (tRounded === lastCaptureTime.current) return;
      lastCaptureTime.current = tRounded;

      const frame = captureFrame();
      if (frame) fireInference(frame);
    };
  }, [captureFrame, fireInference]);

  const startCapturing = useCallback(async () => {
    setPregameStatus("loading");
    sequenceRef.current = 0;

    try {
      const [configRes, priceRes] = await Promise.all([
        fetch("http://localhost:8080/config").then((r) => r.json()),
        fetch("http://localhost:8080/price-history").then((r) => r.json()),
      ]);

      if (priceRes.length > 0) {
        marketTickersRef.current = Object.keys(priceRes[0]).filter(
          (k) => k !== "timestamp"
        );
      }

      const homeTeam: string = configRes.team_b?.name;
      const awayTeam: string = configRes.team_a?.name;

      if (homeTeam && awayTeam) {
        const resp = await fetch(`${DECISION_URL}/pregame`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ home_team: homeTeam, away_team: awayTeam }),
        });
        if (!resp.ok) throw new Error(`Pregame failed: ${resp.status}`);
        const tags = await resp.json();
        pregameTagsRef.current = tags;
      }

      setPregameStatus("ready");
      fetchPositions();
    } catch (e) {
      console.error("[pregame] failed:", e);
      setPregameStatus("error");
    }

    autoRunning.current = true;
    lastCaptureTime.current = -1;
    setCapturing(true);
    autoLoopRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopCapturing = useCallback(() => {
    autoRunning.current = false;
    if (rafId.current) cancelAnimationFrame(rafId.current);
    setCapturing(false);
  }, []);

  const clearLog = useCallback(() => {
    setEntries([]);
    setDoneTotal(0);
    setLiveScoreA(0);
    setLiveScoreB(0);
    setGameClock("—");
    setPeriod("—");
    setMomentum("—");
    setCorrection("");
    setTradeSignal(null);
    setTradeResults([]);
    setPositionsData(null);
    sequenceRef.current = 0;
  }, []);

  const exportCSV = useCallback(() => {
    const header =
      "timestamp,action,team_a_score,team_b_score,game_clock,momentum_team,momentum_score,momentum_reason";
    const rows = entries
      .filter((e) => !e.pending && !e.error && !e.dim)
      .reverse()
      .map((e) => e.text);
    const blob = new Blob([`${header}\n${rows.join("\n")}`], {
      type: "text/csv",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "inference_log.csv";
    a.click();
  }, [entries]);

  /* cleanup on unmount */
  useEffect(() => {
    return () => {
      autoRunning.current = false;
      if (rafId.current) cancelAnimationFrame(rafId.current);
      if (hlsRef.current) hlsRef.current.destroy();
    };
  }, []);

  /* attach HLS livestream */
  useEffect(() => {
    if (!isLive || !streamUrl) return;
    const video = videoRef.current;
    if (!video) return;

    const isHls = streamUrl.includes(".m3u8");

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      hlsRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) console.error("[hls] fatal error:", data.type);
      });
    } else if (isHls && video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = streamUrl;
      video.addEventListener(
        "loadedmetadata",
        () => video.play().catch(() => {}),
        { once: true }
      );
    } else {
      video.src = streamUrl;
      video.addEventListener(
        "loadedmetadata",
        () => video.play().catch(() => {}),
        { once: true }
      );
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [isLive, streamUrl]);

  if (!game) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Recording not found</h1>
          <Link
            href="/"
            className="text-accent hover:underline inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  const eventCount = entries.filter((e) => !e.pending).length;
  const aWinning = liveScoreA > liveScoreB;
  const bWinning = liveScoreB > liveScoreA;

  /* Primary trade signal = first non-HOLD, or first signal */
  const primarySignal =
    tradeSignal?.signals.find((s) => s.action_taken !== "HOLD") ??
    tradeSignal?.signals[0] ??
    null;
  const primaryStyle = getActionStyle(primarySignal?.action_taken ?? "HOLD");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <canvas ref={canvasRef} className="hidden" />

      {/* ── NAVBAR ──────────────────────────────────────────────────── */}
      <motion.nav
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="sticky top-0 z-50 h-14 flex items-center justify-between px-6 border-b border-surface-border bg-background/95 backdrop-blur-xl shrink-0"
      >
        <Link
          href="/"
          className="group flex items-center gap-2 text-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span className="text-sm font-medium hidden sm:inline">Back</span>
        </Link>

        <span className="text-base font-bold tracking-tight absolute left-1/2 -translate-x-1/2">
          Vision<span className="text-accent">Signal</span>
        </span>

        <div className="flex items-center gap-2">
          {isLive ? (
            <span className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded border bg-green-500/10 border-green-500/25 text-green-400 uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 pulse-live" />
              Live
            </span>
          ) : (
            <span className="text-[10px] font-bold px-2.5 py-1 rounded border bg-surface-light border-surface-border text-muted uppercase tracking-wider">
              Recording
            </span>
          )}
        </div>
      </motion.nav>

      {/* ── SCOREBOARD HERO ─────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.05 }}
        className="relative border-b border-surface-border shrink-0 overflow-hidden"
        style={{
          background:
            "radial-gradient(ellipse 80% 140% at 50% 100%, rgba(207,185,145,0.05) 0%, transparent 70%), #0d0d0d",
        }}
      >
        {/* subtle grid lines */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(207,185,145,1) 1px, transparent 1px), linear-gradient(90deg, rgba(207,185,145,1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        <div className="relative max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between gap-4">
            {/* Team A */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="flex-1 min-w-0"
            >
              <p className="text-[10px] text-muted/50 uppercase tracking-widest mb-1.5">
                Home
              </p>
              <h2 className="text-xl sm:text-2xl font-bold leading-tight truncate">
                {game.teamA}
              </h2>
              <p
                className={`text-sm font-mono font-bold mt-1.5 transition-colors duration-700 ${
                  aWinning ? "text-accent" : "text-muted/40"
                }`}
              >
                {game.teamAShort}
              </p>
            </motion.div>

            {/* Live Score — animated slot machine digits */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="flex flex-col items-center shrink-0"
            >
              <div className="flex items-center gap-5 sm:gap-8">
                <AnimatedScore value={liveScoreA} highlight={aWinning} />

                {/* Clock / period center */}
                <div className="flex flex-col items-center gap-0.5 self-stretch justify-center">
                  <span className="text-muted/15 text-xl leading-none select-none font-thin">|</span>
                  <span className="text-sm font-mono font-semibold text-foreground/55 tabular-nums">
                    {gameClock}
                  </span>
                  <span className="text-[10px] font-bold text-accent tracking-widest">
                    {period}
                  </span>
                  <span className="text-muted/15 text-xl leading-none select-none font-thin">|</span>
                </div>

                <AnimatedScore value={liveScoreB} highlight={bWinning} />
              </div>

              {/* Momentum + correction */}
              <div className="mt-3 flex items-center gap-3">
                <span className="text-[11px] text-muted/40 font-mono">
                  momentum:{" "}
                  <span className="text-foreground/55">{momentum}</span>
                </span>
                {game.spread && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-surface border border-surface-border rounded font-mono text-muted/50">
                    {game.spread}
                  </span>
                )}
              </div>
              {correction && (
                <p className="mt-1 text-[10px] text-yellow-400 pulse-live font-mono">
                  {correction}
                </p>
              )}
            </motion.div>

            {/* Team B */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="flex-1 min-w-0 text-right"
            >
              <p className="text-[10px] text-muted/50 uppercase tracking-widest mb-1.5">
                Away
              </p>
              <h2 className="text-xl sm:text-2xl font-bold leading-tight truncate">
                {game.teamB}
              </h2>
              <p
                className={`text-sm font-mono font-bold mt-1.5 transition-colors ${
                  bWinning ? "text-accent" : "text-muted/40"
                }`}
              >
                {game.teamBShort}
              </p>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* ── MAIN CONTENT ────────────────────────────────────────────── */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">
        <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">

          {/* ── LEFT COLUMN: Video + Chart ────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.2 }}
            className="flex flex-col gap-5"
          >
            {/* Video player */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                {isLive ? (
                  <Radio className="w-3.5 h-3.5 text-accent" />
                ) : (
                  <Play className="w-3.5 h-3.5 text-accent" />
                )}
                <span className="text-[10px] font-bold uppercase tracking-widest text-accent">
                  {isLive ? "Livestream" : "Game Recording"}
                </span>
              </div>

              <div
                className={`rounded-xl overflow-hidden transition-all duration-500 ${
                  capturing
                    ? "border border-accent/40 shadow-[0_0_60px_-10px_rgba(207,185,145,0.15)]"
                    : "border border-surface-border"
                }`}
              >
                <div className="aspect-video bg-black relative flex items-center justify-center">
                  {game.videoSrc || isLive ? (
                    <video
                      ref={videoRef}
                      src={game.videoSrc ?? undefined}
                      controls={!isLive}
                      muted={isLive}
                      playsInline
                      crossOrigin="anonymous"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-surface-light border border-surface-border flex items-center justify-center">
                        <Radio className="w-6 h-6 text-muted/30" />
                      </div>
                      <p className="text-muted/40 text-xs text-center max-w-[180px] leading-relaxed">
                        No recording source connected
                      </p>
                    </div>
                  )}

                  <AnimatePresence>
                    {capturing && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.85 }}
                        className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/80 backdrop-blur-sm rounded-full px-3 py-1.5 border border-accent/20"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-accent pulse-live" />
                        <span className="text-[10px] font-bold text-accent tracking-wider">
                          AI ACTIVE
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Capture controls */}
              <div className="mt-4 flex flex-col gap-3">
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={capturing ? stopCapturing : startCapturing}
                  className={`w-full flex items-center justify-center gap-2.5 py-3 rounded-lg text-sm font-bold transition-all duration-200 ${
                    capturing
                      ? "bg-red-500/10 text-red-400 border border-red-500/25 hover:bg-red-500/15"
                      : "bg-accent text-black hover:bg-accent-light"
                  }`}
                >
                  {capturing ? (
                    <>
                      <Square className="w-4 h-4" />
                      Stop AI Analysis
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      Start AI Analysis
                    </>
                  )}
                </motion.button>

                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] text-muted/60">
                    {inflight > 0 ? (
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block w-2.5 h-2.5 border border-accent border-t-transparent rounded-full animate-spin" />
                        Analyzing {inflight} frame{inflight > 1 ? "s" : ""}…
                      </span>
                    ) : capturing ? (
                      "Watching for activity…"
                    ) : (
                      "AI analysis paused"
                    )}
                  </span>
                  <span className="text-[11px] text-muted/40 font-mono">
                    {doneTotal} frames analyzed
                  </span>
                </div>
              </div>

              {game.kalshiUrl && (
                <a
                  href={game.kalshiUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-[11px] text-accent/70 hover:text-accent transition-colors"
                >
                  View on Kalshi
                  <ChevronRight className="w-3 h-3" />
                </a>
              )}
            </div>

            {/* Price Chart */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-3.5 h-3.5 text-accent" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-accent">
                  Market Price History
                </span>
              </div>
              <div className="rounded-xl border border-surface-border overflow-hidden bg-surface h-72">
                <KalshiChart
                  baseUrl={DECISION_URL}
                  scoreA={liveScoreA}
                  scoreB={liveScoreB}
                  gameClock={gameClock}
                  onPriceAtPlayhead={onPriceAtPlayhead}
                />
              </div>
            </div>
          </motion.div>

          {/* ── RIGHT COLUMN: Trade Signal + Feed ─────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.28 }}
            className="flex flex-col gap-5"
          >
            {/* ── TRADE SIGNAL CARD ── */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-3.5 h-3.5 text-accent" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-accent">
                  AI Trade Signal
                </span>
                {tradeLoading && (
                  <span className="ml-auto inline-block w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                )}
              </div>

              <AnimatePresence mode="wait">
                {/* Idle / Loading / Error states */}
                {!tradeSignal && (
                  <motion.div
                    key={pregameStatus}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="rounded-xl border border-surface-border bg-surface p-6 text-center"
                  >
                    {pregameStatus === "idle" && (
                      <>
                        <div className="w-12 h-12 rounded-2xl bg-surface-light border border-surface-border flex items-center justify-center mx-auto mb-3">
                          <Zap className="w-5 h-5 text-muted/30" />
                        </div>
                        <p className="text-sm font-medium text-foreground/60">
                          Ready to analyze
                        </p>
                        <p className="text-[11px] text-muted/40 mt-1 max-w-[180px] mx-auto leading-relaxed">
                          Press &quot;Start AI Analysis&quot; to get live trade
                          signals
                        </p>
                      </>
                    )}
                    {pregameStatus === "loading" && (
                      <>
                        <div className="w-12 h-12 rounded-2xl bg-surface-light border border-surface-border flex items-center justify-center mx-auto mb-3">
                          <span className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                        </div>
                        <p className="text-sm font-medium text-foreground/60 animate-pulse">
                          Loading game context…
                        </p>
                      </>
                    )}
                    {pregameStatus === "error" && (
                      <>
                        <p className="text-sm font-medium text-red-400">
                          Connection failed
                        </p>
                        <p className="text-[11px] text-muted/40 mt-1">
                          Could not reach the AI server
                        </p>
                      </>
                    )}
                    {pregameStatus === "ready" && (
                      <>
                        <div className="w-12 h-12 rounded-2xl bg-surface-light border border-surface-border flex items-center justify-center mx-auto mb-3">
                          <span className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                        </div>
                        <p className="text-sm font-medium text-foreground/60">
                          Watching the game…
                        </p>
                        <p className="text-[11px] text-muted/40 mt-1">
                          Signal will appear soon
                        </p>
                      </>
                    )}
                  </motion.div>
                )}

                {/* Active trade signal */}
                {tradeSignal && primarySignal && (
                  <motion.div
                    key="signal"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={`rounded-xl border overflow-hidden ${primaryStyle.border} ${primaryStyle.bg} ${primaryStyle.glow}`}
                  >
                    {/* Big action hero */}
                    <div className="px-5 py-5 border-b border-white/5">
                      <div className="flex items-center gap-3">
                        <div className={`${primaryStyle.text}`}>
                          {primaryStyle.icon}
                        </div>
                        <span
                          className={`text-4xl font-mono font-black tracking-tight ${primaryStyle.text}`}
                        >
                          {primarySignal.action_taken}
                        </span>
                        {primarySignal.yes_price != null && (
                          <span className="ml-auto text-2xl font-mono font-bold text-foreground/70">
                            {(primarySignal.yes_price * 100).toFixed(0)}
                            <span className="text-base text-muted/60">¢</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-foreground/50 leading-relaxed mt-3 line-clamp-3">
                        {tradeSignal.analysis}
                      </p>
                    </div>

                    {/* All signals */}
                    {tradeSignal.signals.length > 1 && (
                      <div className="px-4 py-3 space-y-1.5">
                        {tradeSignal.signals.map((sig) => {
                          const style = getActionStyle(sig.action_taken);
                          return (
                            <div
                              key={sig.market_ticker}
                              className="flex items-center justify-between gap-2"
                            >
                              <span className="text-[10px] font-mono text-muted/50 truncate flex-1">
                                {sig.market_ticker}
                              </span>
                              <div className="flex items-center gap-2 shrink-0">
                                {sig.yes_price != null && (
                                  <span className="text-[10px] font-mono text-foreground/35">
                                    ${sig.yes_price.toFixed(2)}
                                  </span>
                                )}
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-sm border ${style.badge}`}
                                >
                                  {sig.action_taken}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── POSITIONS & TRADES ── */}
            {(positionsData || tradeResults.length > 0) && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Wallet className="w-3.5 h-3.5 text-accent" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-accent">
                    Positions & Trades
                  </span>
                </div>

                <div className="rounded-xl border border-surface-border bg-surface overflow-hidden">
                  {/* Summary bar */}
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-surface-border bg-surface-light/50">
                    {positionsData && (
                      <span className="text-[10px] font-mono text-muted">
                        BP{" "}
                        <span className="text-foreground font-semibold">
                          ${positionsData.buying_power.toFixed(2)}
                        </span>
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-bold font-mono ${
                        pnl >= 0 ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      P/L {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                    </span>
                  </div>

                  {/* Open positions */}
                  {positionsData && Object.keys(positionsData.positions).length > 0 && (
                    <div className="border-b border-surface-border">
                      <div className="px-4 py-1.5">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-muted/40">
                          Open Positions
                        </span>
                      </div>
                      <div className="divide-y divide-surface-border/50">
                        {Object.entries(positionsData.positions).map(([ticker, pos]) => (
                          <div key={ticker} className="flex items-center justify-between px-4 py-1.5">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-sm ${
                                  pos.side === "yes"
                                    ? "bg-green-500/20 text-green-400"
                                    : "bg-red-500/20 text-red-400"
                                }`}
                              >
                                {pos.side}
                              </span>
                              <span className="text-[10px] font-mono text-muted truncate max-w-[120px]">
                                {ticker}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] font-mono text-foreground/60">
                              <span>&times;{pos.contracts}</span>
                              <span>@ ${pos.avg_price.toFixed(2)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Trade history */}
                  {tradeResults.length > 0 && (
                    <div>
                      <div className="px-4 py-1.5">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-muted/40">
                          Trade History
                        </span>
                      </div>
                      <div className="max-h-28 overflow-y-auto divide-y divide-surface-border/50">
                        {tradeResults.map((t) => (
                          <div key={t.order_id} className="flex items-center justify-between px-4 py-1.5">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-sm ${
                                  t.action === "buy"
                                    ? "bg-green-500/20 text-green-400"
                                    : "bg-red-500/20 text-red-400"
                                }`}
                              >
                                {t.action}
                              </span>
                              <span className="text-[10px] font-mono text-muted truncate max-w-[120px]">
                                {t.ticker}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] font-mono text-foreground/60">
                              <span>{t.side?.toUpperCase()}</span>
                              <span>&times;{t?.contracts}</span>
                              <span>${t.price?.toFixed(2)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── AI OBSERVATIONS FEED ── */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-3.5 h-3.5 text-accent" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-accent">
                  AI Observations
                </span>
                <span className="ml-auto text-[10px] text-muted/50 font-mono">
                  {eventCount} events
                </span>
                <div className="flex items-center gap-2 ml-2">
                  <button
                    type="button"
                    onClick={() => setRawMode((v) => !v)}
                    title={rawMode ? "Switch to readable view" : "Switch to raw view"}
                    className={`transition-colors ${rawMode ? "text-accent" : "text-muted/40 hover:text-foreground"}`}
                  >
                    <Code2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={exportCSV}
                    title="Export CSV"
                    className="text-muted/40 hover:text-foreground transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={clearLog}
                    title="Clear log"
                    className="text-muted/40 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div
                className="rounded-xl border border-surface-border bg-surface overflow-hidden flex flex-col"
                style={{ height: "340px" }}
              >
                <div className="flex-1 overflow-y-auto">
                  {entries.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center gap-3 p-8">
                      <div className="w-10 h-10 rounded-xl bg-surface-light border border-surface-border flex items-center justify-center">
                        <Activity className="w-4 h-4 text-muted/25" />
                      </div>
                      <p className="text-sm text-muted/50 text-center">
                        No observations yet
                      </p>
                      <p className="text-[11px] text-muted/30 text-center max-w-[160px] leading-relaxed">
                        The AI will log what it sees each second
                      </p>
                    </div>
                  ) : (
                    <div>
                      {entries.map((entry, idx) => (
                        <ObservationEntry
                          key={entry.id}
                          entry={entry}
                          teamAShort={game.teamAShort}
                          teamBShort={game.teamBShort}
                          isLatest={idx === 0}
                          rawMode={rawMode}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
