"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  CONSTANTS                                                          */
/* ------------------------------------------------------------------ */

const SERIES_COLORS = ["#CEB888", "#ffffff", "#4aff9e", "#ffdb4a", "#c74aff"];
const GRID_COLOR = "#1a1a1a";
const LABEL_COLOR = "#555";
const PLAYHEAD_COLOR = "#888888";
const BUY_DOT_COLOR = "#4aff9e";
const SELL_DOT_COLOR = "#ff4a4a";
const DOT_RADIUS = 4;
const PAD = { top: 16, right: 12, bottom: 28, left: 46 };

/* ------------------------------------------------------------------ */
/*  TYPES                                                              */
/* ------------------------------------------------------------------ */

interface DataPoint {
  ts: number;
  [key: string]: number;
}

interface BuySignal {
  ts: number;
  ticker: string;
}

interface PriceHistoryChartProps {
  /** Base URL for the inference server, e.g. "http://localhost:8080" */
  baseUrl: string;
  /** Current away team score from VLM */
  scoreA?: number;
  /** Current home team score from VLM */
  scoreB?: number;
  /** Current game clock string from VLM, e.g. "14:32" */
  gameClock?: string;
  /** Video progress fraction 0-1 for fallback playhead positioning */
  videoProgress?: number;
  /** Buy signals from the trade signal agent */
  buySignals?: BuySignal[];
  /** Sell signals from the trade signal agent */
  sellSignals?: BuySignal[];
  /** Called when the playhead moves, with a map of series key -> price at the playhead */
  onPriceAtPlayhead?: (prices: Record<string, number>) => void;
}

/* ------------------------------------------------------------------ */
/*  COMPONENT                                                          */
/* ------------------------------------------------------------------ */

export default function PriceHistoryChart({
  baseUrl,
  scoreA,
  scoreB,
  gameClock,
  videoProgress,
  buySignals,
  sellSignals,
  onPriceAtPlayhead,
}: PriceHistoryChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [data, setData] = useState<DataPoint[]>([]);
  const [seriesKeys, setSeriesKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoverInfo, setHoverInfo] = useState<{
    values: { key: string; value: number }[];
    time: string;
    score: string | null;
    clock: string | null;
    x: number;
    y: number;
  } | null>(null);

  // Play-by-play mappings for score+clock -> wallclock
  const scoreClockToWallclock = useRef<Record<string, string>>({});
  const scoreToWallclock = useRef<Record<string, string>>({});

  // Reverse mapping: sorted array of { ts, awayScore, homeScore, clock } for hover lookups
  const wallclockToScore = useRef<{ ts: number; awayScore: number; homeScore: number; clock: string }[]>([]);

  // Track when score-based playhead was last set
  const lastScorePlayhead = useRef(0);
  // Track current playhead fraction in a ref (avoids dependency cycle)
  const playheadFracRef = useRef<number | null>(null);

  // Playhead position as fraction 0-1 (null = hidden)
  const [playheadFrac, setPlayheadFrac] = useState<number | null>(null);

  /* ---- fetch price history + play-by-play ---- */

  useEffect(() => {
    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`${baseUrl}/price-history`).then((r) => r.json()),
      fetch(`${baseUrl}/play-by-play`)
        .then((r) => r.json())
        .catch(() => []),
    ])
      .then(([raw, plays]: [Record<string, unknown>[], { awayScore: number; homeScore: number; clock: string; wallclock: string }[]]) => {
        // Process price history
        if (!raw || raw.length === 0) {
          setData([]);
          setSeriesKeys([]);
        } else {
          const keys = Object.keys(raw[0]).filter((k) => k !== "timestamp");
          setSeriesKeys(keys);

          const points: DataPoint[] = raw.map((d) => {
            const entry: DataPoint = {
              ts: new Date(d.timestamp as string).getTime(),
            };
            for (const key of keys) {
              entry[key] = d[key] as number;
            }
            return entry;
          });
          setData(points);
        }

        // Build play-by-play lookups
        if (plays && plays.length > 0) {
          const scw: Record<string, string> = {};
          const sw: Record<string, string> = {};
          const seenScore = new Set<string>();
          for (const p of plays) {
            const scoreKey = p.awayScore + "-" + p.homeScore;
            const clockKey = scoreKey + "@" + p.clock;
            scw[clockKey] = p.wallclock;
            if (!seenScore.has(scoreKey)) {
              seenScore.add(scoreKey);
              sw[scoreKey] = p.wallclock;
            }
          }
          scoreClockToWallclock.current = scw;
          scoreToWallclock.current = sw;

          // Build sorted reverse mapping for hover lookups
          wallclockToScore.current = plays
            .map((p) => ({
              ts: new Date(p.wallclock).getTime(),
              awayScore: p.awayScore,
              homeScore: p.homeScore,
              clock: p.clock,
            }))
            .sort((a, b) => a.ts - b.ts);
        }
      })
      .catch(() => {
        setError("Network error");
        setData([]);
      })
      .finally(() => setLoading(false));
  }, [baseUrl]);

  /* ---- playhead: score-based positioning ---- */

  useEffect(() => {
    if (data.length === 0 || scoreA == null || scoreB == null) return;

    const minTs = data[0].ts;
    const maxTs = data[data.length - 1].ts;
    const range = maxTs - minTs;
    if (range <= 0) return;

    const plays = wallclockToScore.current;
    if (plays.length === 0) return;

    const parseClockSec = (c: string) => {
      const parts = c.split(":").map(Number);
      return parts.length === 2 ? parts[0] * 60 + parts[1] : NaN;
    };

    const targetClockSec = gameClock ? parseClockSec(gameClock) : NaN;

    // Filter plays matching the exact score
    const scoreMatches = plays.filter(
      (p) => p.awayScore === scoreA && p.homeScore === scoreB
    );

    let best: (typeof plays)[0] | null = null;

    // Only update playhead if there's an exact score match
    if (scoreMatches.length > 0) {
      if (!Number.isNaN(targetClockSec)) {
        // Among score-matching plays, find closest game clock
        let bestDiff = Infinity;
        for (const p of scoreMatches) {
          const pSec = parseClockSec(p.clock);
          if (Number.isNaN(pSec)) continue;
          const diff = Math.abs(pSec - targetClockSec);
          if (diff < bestDiff) {
            bestDiff = diff;
            best = p;
          }
        }
      }
      // If no clock match found, use the last play-by-play entry at this score
      if (!best) {
        best = scoreMatches[scoreMatches.length - 1];
      }
    }

    if (best) {
      // Snap to the closest kalshi data point by wallclock timestamp
      let closestIdx = 0;
      let closestDist = Math.abs(data[0].ts - best.ts);
      for (let i = 1; i < data.length; i++) {
        const dist = Math.abs(data[i].ts - best.ts);
        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = i;
        }
      }
      const frac = data.length > 1 ? closestIdx / (data.length - 1) : 0;
      playheadFracRef.current = frac;
      setPlayheadFrac(frac);
      lastScorePlayhead.current = Date.now();
    }
  }, [scoreA, scoreB, gameClock, data]);

  /* ---- playhead: fallback video-progress positioning ---- */

  useEffect(() => {
    if (videoProgress == null || videoProgress < 0 || videoProgress > 1) return;
    // Only use fallback if no score-based update in last 2s
    if (Date.now() - lastScorePlayhead.current < 2000) return;
    playheadFracRef.current = videoProgress;
    setPlayheadFrac(videoProgress);
  }, [videoProgress]);

  /* ---- notify parent of price at playhead ---- */

  useEffect(() => {
    if (!onPriceAtPlayhead || playheadFrac == null || data.length === 0 || seriesKeys.length === 0) return;
    const idx = Math.min(data.length - 1, Math.max(0, Math.round(playheadFrac * (data.length - 1))));
    const d = data[idx];
    const prices: Record<string, number> = {};
    for (const key of seriesKeys) {
      if (d[key] != null) prices[key] = d[key];
    }
    onPriceAtPlayhead(prices);
  }, [playheadFrac, data, seriesKeys, onPriceAtPlayhead]);

  /* ---- drawing ---- */

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0 || seriesKeys.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = rect.width;
    const h = rect.height;
    const plotW = w - PAD.left - PAD.right;
    const plotH = h - PAD.top - PAD.bottom;

    ctx.clearRect(0, 0, w, h);

    const minTs = data[0].ts;
    const maxTs = data[data.length - 1].ts;

    // Compute price range
    let lo = Infinity,
      hi = -Infinity;
    for (const d of data) {
      for (const key of seriesKeys) {
        if (d[key] != null) {
          lo = Math.min(lo, d[key]);
          hi = Math.max(hi, d[key]);
        }
      }
    }
    if (!Number.isFinite(lo)) {
      lo = 0;
      hi = 100;
    }
    const minPrice = Math.max(0, Math.floor(lo - 2));
    const maxPrice = Math.min(100, Math.ceil(hi + 2));

    const xOf = (ts: number) =>
      PAD.left + ((ts - minTs) / (maxTs - minTs || 1)) * plotW;
    const yOf = (price: number) =>
      PAD.top +
      (1 - (price - minPrice) / (maxPrice - minPrice || 1)) * plotH;

    // Grid
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    ctx.font = "9px monospace";
    ctx.fillStyle = LABEL_COLOR;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    const priceRange = maxPrice - minPrice;
    const step = priceRange > 40 ? 20 : priceRange > 15 ? 10 : 5;
    for (
      let p = Math.ceil(minPrice / step) * step;
      p <= maxPrice;
      p += step
    ) {
      const y = yOf(p);
      ctx.beginPath();
      ctx.moveTo(PAD.left, y);
      ctx.lineTo(w - PAD.right, y);
      ctx.stroke();
      ctx.fillText(p + "\u00a2", PAD.left - 4, y);
    }

    // Time labels
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const totalMs = maxTs - minTs;
    const labelCount = Math.min(6, Math.max(2, Math.floor(plotW / 70)));
    for (let i = 0; i <= labelCount; i++) {
      const ts = minTs + (totalMs * i) / labelCount;
      const d = new Date(ts);
      const label = d.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      ctx.fillText(label, xOf(ts), h - PAD.bottom + 6);
    }

    // Draw each series line
    for (let si = 0; si < seriesKeys.length; si++) {
      const key = seriesKeys[si];
      const color = SERIES_COLORS[si % SERIES_COLORS.length];

      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";
      ctx.beginPath();
      let started = false;
      for (const d of data) {
        const val = d[key];
        if (val == null) continue;
        const x = xOf(d.ts);
        const y = yOf(val);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }

    // Draw trade signal dots (buy = green, sell = red)
    const allSignals: { sig: BuySignal; color: string }[] = [];
    if (buySignals) for (const sig of buySignals) allSignals.push({ sig, color: BUY_DOT_COLOR });
    if (sellSignals) for (const sig of sellSignals) allSignals.push({ sig, color: SELL_DOT_COLOR });

    if (allSignals.length > 0 && data.length > 0) {
      for (const { sig, color } of allSignals) {
        if (sig.ts < minTs || sig.ts > maxTs) continue;
        let closestIdx = 0;
        let closestDist = Math.abs(data[0].ts - sig.ts);
        for (let i = 1; i < data.length; i++) {
          const dist = Math.abs(data[i].ts - sig.ts);
          if (dist < closestDist) {
            closestDist = dist;
            closestIdx = i;
          }
        }
        const d = data[closestIdx];
        const x = xOf(d.ts);
        const si = seriesKeys.indexOf(sig.ticker);
        const key = si >= 0 ? seriesKeys[si] : seriesKeys[0];
        const val = d[key];
        if (val == null) continue;
        const y = yOf(val);

        // Outer glow
        ctx.beginPath();
        ctx.arc(x, y, DOT_RADIUS + 2, 0, Math.PI * 2);
        ctx.fillStyle = `${color}33`;
        ctx.fill();

        // Solid dot
        ctx.beginPath();
        ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }
    }

    // Draw playhead
    if (playheadFrac != null && playheadFrac >= 0 && playheadFrac <= 1) {
      const px = PAD.left + playheadFrac * plotW;
      ctx.strokeStyle = PLAYHEAD_COLOR;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(px, PAD.top);
      ctx.lineTo(px, h - PAD.bottom);
      ctx.stroke();
      ctx.setLineDash([]);

      // Small triangle at top
      ctx.fillStyle = PLAYHEAD_COLOR;
      ctx.beginPath();
      ctx.moveTo(px, PAD.top - 2);
      ctx.lineTo(px - 4, PAD.top - 8);
      ctx.lineTo(px + 4, PAD.top - 8);
      ctx.closePath();
      ctx.fill();
    }
  }, [data, seriesKeys, playheadFrac, buySignals, sellSignals]);

  useEffect(() => {
    draw();
    const handler = () => draw();
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [draw]);

  /* ---- hover ---- */

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (data.length === 0) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const plotW = rect.width - PAD.left - PAD.right;
      const frac = (mx - PAD.left) / plotW;
      if (frac < 0 || frac > 1) {
        setHoverInfo(null);
        return;
      }

      const idx = Math.min(
        data.length - 1,
        Math.max(0, Math.round(frac * (data.length - 1)))
      );
      const d = data[idx];
      const ts = new Date(d.ts);
      const timeStr = ts.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      // Find nearest score from play-by-play
      let scoreStr: string | null = null;
      let clockStr: string | null = null;
      const plays = wallclockToScore.current;
      if (plays.length > 0) {
        // Binary search for nearest timestamp
        let lo = 0,
          hi = plays.length - 1;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (plays[mid].ts < d.ts) lo = mid + 1;
          else hi = mid;
        }
        // Check lo and lo-1 for closest
        let nearest = plays[lo];
        if (lo > 0 && Math.abs(plays[lo - 1].ts - d.ts) < Math.abs(plays[lo].ts - d.ts)) {
          nearest = plays[lo - 1];
        }
        scoreStr = `${nearest.awayScore} – ${nearest.homeScore}`;
        clockStr = nearest.clock;
      }

      setHoverInfo({
        values: seriesKeys.map((key) => ({ key, value: d[key] })),
        time: timeStr,
        score: scoreStr,
        clock: clockStr,
        x: mx,
        y: e.clientY - rect.top,
      });
    },
    [data, seriesKeys]
  );

  /* ---- render ---- */

  return (
    <div className="flex flex-col gap-2 h-full">
      {/* Legend */}
      <div className="flex items-center gap-3 text-[10px] font-mono text-muted flex-wrap">
        {seriesKeys.map((key, i) => (
          <span key={key} className="flex items-center gap-1">
            <span
              className="w-2.5 h-0.5 rounded-full inline-block"
              style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }}
            />
            <span style={{ color: SERIES_COLORS[i % SERIES_COLORS.length] }}>
              {key}
            </span>
          </span>
        ))}
      </div>

      {/* Chart */}
      <div ref={containerRef} className="relative flex-1 min-h-0">
        <div className="absolute inset-0 rounded-md border border-surface-border bg-surface overflow-hidden">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <span className="inline-block w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {error && !loading && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <span className="text-xs text-red-400">{error}</span>
            </div>
          )}
          {!loading && !error && data.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <span className="text-xs text-muted">No price data available</span>
            </div>
          )}

          <canvas
            ref={canvasRef}
            className="w-full h-full"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoverInfo(null)}
          />
        </div>

        {/* Tooltip — outside overflow:hidden container so it doesn't clip */}
        {hoverInfo && (
          <div
            className="absolute pointer-events-none z-30 bg-surface-light border border-surface-border rounded px-2 py-1 text-[10px] font-mono shadow-lg whitespace-nowrap"
            style={{
              left: Math.min(
                hoverInfo.x + 10,
                (containerRef.current?.clientWidth ?? 300) - 180
              ),
              top: Math.max(hoverInfo.y - 40, 0),
            }}
          >
            <div className="flex items-center gap-2">
              {hoverInfo.values.map((v, i) => (
                <span key={v.key}>
                  <span
                    style={{
                      color: SERIES_COLORS[i % SERIES_COLORS.length],
                    }}
                    className="font-bold"
                  >
                    {v.value?.toFixed(1)}¢
                  </span>
                </span>
              ))}
              <span className="text-muted">{hoverInfo.time}</span>
            </div>
            {(hoverInfo.score || hoverInfo.clock) && (
              <div className="flex items-center gap-2 text-foreground/70 mt-0.5">
                {hoverInfo.score && (
                  <span className="font-bold">{hoverInfo.score}</span>
                )}
                {hoverInfo.clock && (
                  <span className="text-muted">{hoverInfo.clock}</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
