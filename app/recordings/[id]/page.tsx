"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import Hls from "hls.js";
import {
  Activity,
  ArrowLeft,
  Calendar,
  Download,
  Play,
  Radio,
  Square,
  Trash2,
  TrendingUp,
  Trophy,
  Wallet,
  Zap,
} from "lucide-react";
import KalshiChart, { type ForecastPoint } from "@/app/components/KalshiChart";
import PriceHistoryChart from "@/app/components/PriceHistoryChart";

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
  flags: string[];
  latencyMs: number | null;
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

/* ------------------------------------------------------------------ */
/*  CONSTANTS                                                          */
/* ------------------------------------------------------------------ */

const SCALE_W = 480;
const INFER_URL = "http://localhost:8080/infer";
const DECISION_URL = "http://localhost:8080";

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
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
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
  const pregameTagsRef = useRef<{ game_tag: string; h_tag: string; a_tag: string; e_tag: string } | null>(null);
  const marketTickersRef = useRef<string[]>([]);

  /* state */
  const [capturing, setCapturing] = useState(false);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [inflight, setInflight] = useState(0);
  const [doneTotal, setDoneTotal] = useState(0);
  const [liveScoreA, setLiveScoreA] = useState(0);
  const [liveScoreB, setLiveScoreB] = useState(0);
  const [gameClock, setGameClock] = useState("00:00");
  const [period, setPeriod] = useState("1H");
  const [momentum, setMomentum] = useState("neutral 0");
  const [correction, setCorrection] = useState("");
  const [pregameStatus, setPregameStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [tradeLoading, setTradeLoading] = useState(false);
  const [tradeSignal, setTradeSignal] = useState<{
    analysis: string;
    signals: { market_ticker: string; yes_price: number | null; trend: string; action_taken: string }[];
  } | null>(null);
  const [videoProgress, setVideoProgress] = useState(0);
  const [buySignals, setBuySignals] = useState<{ ts: number; ticker: string }[]>([]);
  const [sellSignals, setSellSignals] = useState<{ ts: number; ticker: string }[]>([]);

  const [tradeResults, setTradeResults] = useState<TradeResult[]>([]);
  const [buyingPower, setBuyingPower] = useState<number | null>(null);
  const kalshiDataRef = useRef<ForecastPoint[]>([]);
  const priceAtPlayheadRef = useRef<Record<string, number>>({});


  /* ---- helpers ---- */

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

  const executeTrade = useCallback(
    (action: "buy" | "sell", ticker: string, side: string, contracts: number, price: number) => {
      fetch(`${DECISION_URL}/trade/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, side, contracts, price }),
      })
        .then((r) => r.json())
        .then((data) => {
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
          setBuyingPower(data.buying_power);
        })
        .catch((e) => console.error(`[trade/${action}] failed:`, e));
    },
    []
  );

  const fireInference = useCallback(
    (frame: { timestamp: number; base64: string }) => {
      const ts = `${Math.floor(frame.timestamp / 60)}:${(frame.timestamp % 60).toFixed(1).padStart(4, "0")}`;
      const entryId = `e${Date.now()}${Math.random().toString(36).slice(2, 6)}`;

      /* add pending entry */
      setEntries((prev) => [
        { id: entryId, ts, text: "...", pending: true, error: false, dim: false, flags: [], latencyMs: null },
        ...prev,
      ]);
      setInflight((n) => n + 1);

      const t0 = performance.now();
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
          const latencyMs = Math.round(performance.now() - t0);
          if (data.error) {
            setEntries((prev) =>
              prev.map((e) =>
                e.id === entryId
                  ? { ...e, pending: false, error: true, text: data.error, latencyMs }
                  : e
              )
            );
            return;
          }

          /* dual VLM mode (momentum + score fields) */
          if (data.momentum !== undefined) {
            const momentumStr = (data.momentum || "").trim();
            const scoreStr = (data.score || "").trim();
            const lines: string[] = [];
            if (momentumStr && momentumStr !== "NONE")
              lines.push(momentumStr);
            if (scoreStr && scoreStr !== "NONE")
              lines.push(`score: ${scoreStr}`);

            const isDim = lines.length === 0;
            const flags: string[] = Array.isArray(data.flags) ? data.flags : [];
            setEntries((prev) =>
              prev.map((e) =>
                e.id === entryId
                  ? {
                      ...e,
                      pending: false,
                      text: isDim ? "(no data)" : lines.join("\n"),
                      dim: isDim,
                      flags,
                      latencyMs,
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

              // Fire live trading call with the VLM action as the event
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
                      const playheadPrices = priceAtPlayheadRef.current;
                      const signals = (liveData.market_signals ?? []).map(
                        (s: {
                          market_ticker: string;
                          yes_price: number | null;
                          trend: string;
                          action_taken: string;
                        }) => {
                          const chartPrice = playheadPrices[s.market_ticker] ?? null;
                          return {
                            market_ticker: s.market_ticker,
                            yes_price: chartPrice != null ? chartPrice / 100 : (s.yes_price ?? null),
                            trend: s.trend,
                            action_taken: s.action_taken ?? "HOLD",
                          };
                        }
                      );
                      setTradeSignal({
                        analysis: liveData.analysis,
                        signals,
                      });
                      const now = Date.now();
                      const newBuys = signals
                        .filter((s: { action_taken: string }) => s.action_taken.startsWith("BUY"))
                        .map((s: { market_ticker: string }) => ({ ts: now, ticker: s.market_ticker }));
                      if (newBuys.length > 0) {
                        setBuySignals((prev) => [...prev, ...newBuys]);
                      }
                      const newSells = signals
                        .filter((s: { action_taken: string }) => s.action_taken.startsWith("SELL"))
                        .map((s: { market_ticker: string }) => ({ ts: now, ticker: s.market_ticker }));
                      if (newSells.length > 0) {
                        setSellSignals((prev) => [...prev, ...newSells]);
                      }

                      // Execute trades for BUY/SELL signals
                      for (const sig of signals) {
                        console.log("processing signal:", sig);
                        const parts = sig.action_taken.split(/\s+/);
                        const verb = parts[0]?.toUpperCase();
                        console.log("verb:", verb);
                        if (verb !== "BUY" && verb !== "SELL") continue;
                        const side = (parts[1] || "yes").toLowerCase();
                        console.log("side:", side);
                        const contractsStr = parts[2]?.replace(/c$/i, "");
                        const contracts = contractsStr ? parseInt(contractsStr, 10) : 1;
                    
  
                        executeTrade(
                          verb.toLowerCase() as "buy" | "sell",
                          sig.market_ticker,
                          side,
                          Number.isNaN(contracts) ? 1 : contracts,
                          sig.yes_price ?? 0,
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
            /* legacy single VLM mode */
            const resp = (data.response || "").trim();
            if (resp === "NONE" || resp === "") {
              setEntries((prev) =>
                prev.map((e) =>
                  e.id === entryId
                    ? {
                        ...e,
                        pending: false,
                        text: "(no score visible)",
                        dim: true,
                        latencyMs,
                      }
                    : e
                )
              );
            } else {
              setEntries((prev) =>
                prev.map((e) =>
                  e.id === entryId
                    ? { ...e, pending: false, text: resp, latencyMs }
                    : e
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
                ? { ...e, pending: false, error: true, text: err.message, latencyMs: Math.round(performance.now() - t0) }
                : e
            )
          );
        })
        .finally(() => {
          setInflight((n) => Math.max(0, n - 1));
          setDoneTotal((n) => n + 1);
        });
    },
    [executeTrade]
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
    } catch (e) {
      console.error("[pregame] failed:", e);
      setPregameStatus("error");
    }

    autoRunning.current = true;
    lastCaptureTime.current = -1;
    setCapturing(true);
    autoLoopRef.current();
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
    setGameClock("20:00");
    setPeriod("1H");
    setMomentum("neutral 0");
    setCorrection("");
    setTradeSignal(null);
    setBuySignals([]);
    setSellSignals([]);
    setTradeResults([]);
    setBuyingPower(null);
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

  /* track video progress for chart playhead */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTimeUpdate = () => {
      if (video.duration > 0) {
        setVideoProgress(video.currentTime / video.duration);
      }
    };
    video.addEventListener("timeupdate", onTimeUpdate);
    return () => video.removeEventListener("timeupdate", onTimeUpdate);
  }, []);

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
      video.addEventListener("loadedmetadata", () => video.play().catch(() => {}), { once: true });
    } else {
      video.src = streamUrl;
      video.addEventListener("loadedmetadata", () => video.play().catch(() => {}), { once: true });
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

  const winner = game.scoreA > game.scoreB ? "A" : "B";
  const eventCount = entries.filter((e) => !e.pending).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Navbar */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 border-b border-surface-border bg-background/80 backdrop-blur-xl"
      >
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium hidden sm:inline">Back</span>
          </Link>
          <div className="w-px h-5 bg-surface-border" />
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold tracking-tight">
              Sport<span className="text-accent">Signal</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className={`text-[10px] font-bold border rounded-md px-2 py-1 uppercase tracking-wider ${
            isLive
              ? "bg-green-500/10 border-green-500/30 text-green-400"
              : "bg-surface-light border-surface-border text-muted"
          }`}>
            {isLive ? "Live" : "Recording"}
          </span>
        </div>
      </motion.nav>

      {/* Game header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="border-b border-surface-border"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <Trophy className="w-5 h-5 text-accent" />
              <div>
                <h1 className="text-lg font-bold">
                  {game.teamA} vs {game.teamB}
                </h1>
                <div className="flex items-center gap-3 text-xs text-muted mt-0.5">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {game.date}
                  </span>
                  <span className="font-mono">{game.kalshiTicker}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div
                className={`text-sm font-bold px-3 py-1.5 rounded-sm ${
                  winner === "A"
                    ? "bg-accent/10 text-accent"
                    : "bg-surface-light text-muted"
                }`}
              >
                {game.teamAShort} {game.scoreA}
              </div>
              <span className="text-xs text-muted">—</span>
              <div
                className={`text-sm font-bold px-3 py-1.5 rounded-sm ${
                  winner === "B"
                    ? "bg-accent/10 text-accent"
                    : "bg-surface-light text-muted"
                }`}
              >
                {game.teamBShort} {game.scoreB}
              </div>
              <span className="text-xs bg-surface-light border border-surface-border rounded-md px-2 py-1 font-mono text-muted ml-2">
                {game.spread}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Dashboard grid — stream left, event stream right */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid lg:grid-cols-[1fr_380px] gap-6 h-[calc(100vh-220px)]">
          {/* Left: Recording / Stream */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-col gap-4"
          >
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-accent">
              {isLive ? <Radio className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isLive ? "Livestream" : "Recording"}
            </div>

            <div className="relative flex-1 rounded-md overflow-hidden border border-surface-border glow-gold">
              <div className="animated-border p-[1px] rounded-md h-full">
                <div className="bg-surface rounded-md h-full flex flex-col items-center justify-center gap-4">
                  {game.videoSrc || isLive ? (
                    <video
                      ref={videoRef}
                      src={game.videoSrc ?? undefined}
                      controls={!isLive}
                      muted={isLive}
                      playsInline
                      crossOrigin="anonymous"
                      className="w-full h-full rounded-md object-contain bg-black"
                    />
                  ) : (
                    <>
                      <Radio className="w-12 h-12 text-muted/40" />
                      <p className="text-muted text-sm text-center max-w-xs">
                        Game recording will be displayed here.
                        <br />
                        <span className="text-muted/60 text-xs">
                          Connect a recording source to replay.
                        </span>
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Capture bar */}
            <div className="flex items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={capturing ? stopCapturing : startCapturing}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-colors ${
                  capturing
                    ? "bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
                    : "bg-accent text-black hover:bg-accent-light"
                }`}
              >
                {capturing ? (
                  <>
                    <Square className="w-3.5 h-3.5" />
                    Stop Capturing
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    Start Capturing
                  </>
                )}
              </motion.button>
              <div className="ml-auto flex items-center gap-4 text-xs text-muted font-mono">
                <span>
                  inflight:{" "}
                  <span className="text-foreground">{inflight}</span>
                </span>
                <span>
                  done:{" "}
                  <span className="text-foreground">{doneTotal}</span>
                </span>
              </div>
            </div>

            {game.kalshiUrl && (
              <a
                href={game.kalshiUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-accent hover:underline"
              >
                View market on Kalshi →
              </a>
            )}

            {/* Price Chart */}
            {id === "1" ? (
              <>
                <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-accent">
                  <TrendingUp className="w-4 h-4" />
                  Market Price
                </div>
                <div className="h-52">
                  <PriceHistoryChart
                    baseUrl={DECISION_URL}
                    scoreA={liveScoreA}
                    scoreB={liveScoreB}
                    gameClock={gameClock}
                    videoProgress={videoProgress}
                    buySignals={buySignals}
                    sellSignals={sellSignals}
                    onPriceAtPlayhead={(prices) => { priceAtPlayheadRef.current = prices; }}
                  />
                </div>
              </>
            ) : null}
          </motion.div>

          {/* Right: Event Stream */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col gap-4 min-h-0 max-h-[calc(100vh-50px)]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-accent">
                <Activity className="w-4 h-4" />
                Event Stream
              </div>
              <span className="text-[10px] text-muted bg-surface-light border border-surface-border rounded-md px-2.5 py-0.5">
                {eventCount} events
              </span>
            </div>

            {/* Scoreboard */}
            <div className="rounded-md border border-surface-border bg-surface-light overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs font-bold uppercase tracking-wider text-muted">
                  {game.teamAShort}
                </span>
                <div className="text-center">
                  <div className="text-2xl font-bold font-mono tabular-nums tracking-wider">
                    {liveScoreA} – {liveScoreB}
                  </div>
                  <div className="flex items-center justify-center gap-2 mt-0.5">
                    <span className="text-xs font-mono text-muted">
                      {gameClock}
                    </span>
                    <span className="text-[10px] font-bold text-accent">
                      {period}
                    </span>
                  </div>
                  {correction && (
                    <span className="text-[10px] text-yellow-400 pulse-live">
                      {correction}
                    </span>
                  )}
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-muted">
                  {game.teamBShort}
                </span>
              </div>
              <div className="border-t border-surface-border px-4 py-1.5 text-center">
                <span className="text-[10px] text-muted">
                  momentum:{" "}
                  <span className="text-foreground font-mono">
                    {momentum}
                  </span>
                </span>
              </div>
            </div>

            {/* Trade Signal */}
            <div className="rounded-md border border-surface-border bg-surface-light overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-surface-border">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-accent">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Trade Signal
                </div>
                {tradeLoading && (
                  <span className="inline-block w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                )}
              </div>

              {pregameStatus === "idle" && (
                <p className="px-4 py-2.5 text-[11px] text-muted">
                  Start capturing to activate
                </p>
              )}
              {pregameStatus === "loading" && (
                <p className="px-4 py-2.5 text-[11px] text-muted animate-pulse">
                  Loading game memory…
                </p>
              )}
              {pregameStatus === "error" && (
                <p className="px-4 py-2.5 text-[11px] text-red-400">
                  Pregame load failed — signals unavailable
                </p>
              )}
              {pregameStatus === "ready" && !tradeSignal && (
                <p className="px-4 py-2.5 text-[11px] text-muted">
                  Waiting for first event…
                </p>
              )}
              {tradeSignal && (
                <div className="px-4 py-3 space-y-2.5">
                  <p className="text-[11px] text-foreground/70 leading-relaxed line-clamp-3">
                    {tradeSignal.analysis}
                  </p>
                  <div className="space-y-1.5">
                    {tradeSignal.signals.map((sig) => (
                      <div
                        key={sig.market_ticker}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="text-[10px] font-mono text-muted truncate">
                          {sig.market_ticker}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-sm ${
                              sig.action_taken === "HOLD"
                                ? "bg-surface text-muted border border-surface-border"
                                : sig.action_taken?.startsWith("BUY")
                                  ? "bg-green-500/20 text-green-400"
                                  : "bg-red-500/20 text-red-400"
                            }`}
                          >
                            {sig.action_taken}
                          </span>
                          {sig.yes_price != null && (
                            <span className="text-[10px] font-mono text-foreground/60">
                              ${sig.yes_price.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Trading Bar */}
            {tradeResults.length > 0 && (
              <div className="rounded-md border border-surface-border bg-surface-light overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 border-b border-surface-border">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-accent">
                    <Wallet className="w-3.5 h-3.5" />
                    Trades
                  </div>
                  <div className="flex items-center gap-3">
                    {buyingPower != null && (
                      <span className="text-[10px] font-mono text-muted">
                        BP{" "}
                        <span className="text-foreground">${buyingPower.toFixed(2)}</span>
                      </span>
                    )}
                    <span className={`text-[10px] font-bold font-mono ${
                      tradeResults.reduce((sum, t) => {
                        const mult = t.action === "buy" ? -1 : 1;
                        return sum + mult * t.contracts * t.price;
                      }, 0) >= 0
                        ? "text-green-400"
                        : "text-red-400"
                    }`}>
                      P/L{" "}
                      {(() => {
                        const pl = tradeResults.reduce((sum, t) => {
                          const mult = t.action === "buy" ? -1 : 1;
                          return sum + mult * t.contracts * t.price;
                        }, 0);
                        return `${pl >= 0 ? "+" : ""}$${pl.toFixed(2)}`;
                      })()}
                    </span>
                  </div>
                </div>
                <div className="max-h-28 overflow-y-auto divide-y divide-surface-border">
                  {tradeResults.map((t) => (
                    <div key={t.order_id} className="flex items-center justify-between px-4 py-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-sm ${
                          t.action === "buy"
                            ? "bg-green-500/20 text-green-400"
                            : "bg-red-500/20 text-red-400"
                        }`}>
                          {t.action}
                        </span>
                        <span className="text-[10px] font-mono text-muted truncate max-w-[120px]">
                          {t.ticker}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-mono text-foreground/60">
                        <span>{t.side?.toUpperCase()}</span>
                        <span>×{t?.contracts}</span>
                        <span>${t.price?.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Event log */}
            <div className="flex-1 rounded-md border border-surface-border bg-surface overflow-hidden flex flex-col min-h-0">
              <div className="flex-1 overflow-y-scroll">
                {entries.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 h-full">
                    <div className="w-12 h-12 rounded-md bg-surface-light border border-surface-border flex items-center justify-center">
                      <Activity className="w-5 h-5 text-muted/40" />
                    </div>
                    <p className="text-sm text-muted text-center">
                      No events recorded yet
                    </p>
                    <p className="text-xs text-muted/60 text-center max-w-[200px]">
                      Press &quot;Start Capturing&quot; while the video plays to
                      begin inference.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-surface-border">
                    {entries.map((entry) => (
                      <div
                        key={entry.id}
                        className={`px-3 py-2 text-xs font-mono transition-opacity ${
                          entry.dim ? "opacity-40" : ""
                        } ${entry.error ? "text-red-400" : ""}`}
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          {entry.pending && (
                            <span className="inline-block w-3 h-3 border-2 border-accent border-t-transparent rounded-md animate-spin" />
                          )}
                          <span className="text-muted">{entry.ts}</span>
                          {entry.latencyMs != null && (
                            <span className="text-muted/50">{entry.latencyMs}ms</span>
                          )}
                        </div>
                        <div className="whitespace-pre-wrap text-foreground/80 pl-5">
                          {entry.text}
                        </div>
                        {entry.flags.length > 0 && (
                          <div className="pl-5 mt-0.5 text-green-400 font-semibold">
                            {entry.flags.join(", ")}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom bar */}
              <div className="border-t border-surface-border px-4 py-3 flex items-center justify-between bg-surface-light/50">
                <span className="text-[10px] text-muted font-mono">
                  {game.kalshiTicker}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={exportCSV}
                    className="text-[10px] text-muted hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    CSV
                  </button>
                  <button
                    type="button"
                    onClick={clearLog}
                    className="text-[10px] text-muted hover:text-red-400 transition-colors flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Clear
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
