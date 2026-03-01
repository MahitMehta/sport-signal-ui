"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  TYPES                                                              */
/* ------------------------------------------------------------------ */

interface DataPoint {
  ts: number; // unix ms
  [key: string]: number;
}

interface BuySignal {
  ts: number;
  ticker: string;
}

interface KalshiChartProps {
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
/*  CONSTANTS                                                          */
/* ------------------------------------------------------------------ */

const SERIES_COLORS = ["#4a9eff", "#CEB888", "#4aff9e", "#ffdb4a", "#c74aff"];
const LINE_DIM = "rgba(74, 158, 255, 0.10)";
const FUTURE_LINE = "rgba(80, 80, 80, 0.55)";
const FUTURE_FILL = "rgba(40, 40, 40, 0.25)";
const GRID_COLOR = "#1a1a1a";
const LABEL_COLOR = "#555";
const ACCENT = "#CFB991"; // gold for "now" dot
const BUY_DOT_COLOR = "#4aff9e";
const SELL_DOT_COLOR = "#ff4a4a";
const DOT_RADIUS = 4;
const PAD = { top: 16, right: 12, bottom: 28, left: 46 };

/* ------------------------------------------------------------------ */
/*  COMPONENT                                                          */
/* ------------------------------------------------------------------ */

export default function KalshiChart({
  baseUrl,
  scoreA,
  scoreB,
  gameClock,
  videoProgress,
  buySignals,
  sellSignals,
  onPriceAtPlayhead,
}: KalshiChartProps) {
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

  // Play-by-play mappings
  const wallclockToScore = useRef<
    { ts: number; awayScore: number; homeScore: number; clock: string }[]
  >([]);

  // Playhead tracking
  const lastScorePlayhead = useRef(0);
  const [playheadIdx, setPlayheadIdx] = useState<number | null>(null);

  // Pulse animation for "now" dot
  const pulseRef = useRef(0);
  const rafRef = useRef<number | null>(null);

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
      .then(
        ([raw, plays]: [
          Record<string, unknown>[],
          {
            awayScore: number;
            homeScore: number;
            clock: string;
            wallclock: string;
          }[],
        ]) => {
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

          if (plays && plays.length > 0) {
            wallclockToScore.current = plays
              .map((p) => ({
                ts: new Date(p.wallclock).getTime(),
                awayScore: p.awayScore,
                homeScore: p.homeScore,
                clock: p.clock,
              }))
              .sort((a, b) => a.ts - b.ts);
          }
        }
      )
      .catch(() => {
        setError("Network error");
        setData([]);
      })
      .finally(() => setLoading(false));
  }, [baseUrl]);

  /* ---- playhead: score-based positioning ---- */

  useEffect(() => {
    if (data.length === 0 || scoreA == null || scoreB == null) return;

    const plays = wallclockToScore.current;
    if (plays.length === 0) return;

    const parseClockSec = (c: string) => {
      const parts = c.split(":").map(Number);
      return parts.length === 2 ? parts[0] * 60 + parts[1] : NaN;
    };

    const targetClockSec = gameClock ? parseClockSec(gameClock) : NaN;

    const scoreMatches = plays.filter(
      (p) => p.awayScore === scoreA && p.homeScore === scoreB
    );

    let best: (typeof plays)[0] | null = null;

    if (scoreMatches.length > 0) {
      if (!Number.isNaN(targetClockSec)) {
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
      if (!best) {
        best = scoreMatches[scoreMatches.length - 1];
      }
    }

    if (best) {
      let closestIdx = 0;
      let closestDist = Math.abs(data[0].ts - best.ts);
      for (let i = 1; i < data.length; i++) {
        const dist = Math.abs(data[i].ts - best.ts);
        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = i;
        }
      }
      setPlayheadIdx(closestIdx);
      lastScorePlayhead.current = Date.now();
    }
  }, [scoreA, scoreB, gameClock, data]);

  /* ---- playhead: fallback video-progress positioning ---- */

  useEffect(() => {
    if (videoProgress == null || videoProgress < 0 || videoProgress > 1) return;
    if (Date.now() - lastScorePlayhead.current < 2000) return;
    const idx = Math.min(
      data.length - 1,
      Math.max(0, Math.round(videoProgress * (data.length - 1)))
    );
    setPlayheadIdx(idx);
  }, [videoProgress, data]);

  /* ---- notify parent of price at playhead ---- */

  useEffect(() => {
    if (!onPriceAtPlayhead || playheadIdx == null || data.length === 0 || seriesKeys.length === 0)
      return;
    const d = data[playheadIdx];
    const prices: Record<string, number> = {};
    for (const key of seriesKeys) {
      if (d[key] != null) prices[key] = d[key];
    }
    onPriceAtPlayhead(prices);
  }, [playheadIdx, data, seriesKeys, onPriceAtPlayhead]);

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

    // Compute price range over all series
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
    const pricePad = Math.max(2, (hi - lo) * 0.1);
    const minPrice = Math.max(0, lo - pricePad);
    const maxPrice = Math.min(100, hi + pricePad);

    const xOf = (ts: number) =>
      PAD.left + ((ts - minTs) / (maxTs - minTs || 1)) * plotW;
    const yOf = (price: number) =>
      PAD.top + (1 - (price - minPrice) / (maxPrice - minPrice || 1)) * plotH;

    // ── Grid ────────────────────────────────────────────────────────
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    ctx.font = "9px monospace";
    ctx.fillStyle = LABEL_COLOR;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    const priceRange = maxPrice - minPrice;
    const step = priceRange > 40 ? 20 : priceRange > 15 ? 10 : 5;
    for (let p = Math.ceil(minPrice / step) * step; p <= maxPrice; p += step) {
      const y = yOf(p);
      ctx.beginPath();
      ctx.moveTo(PAD.left, y);
      ctx.lineTo(w - PAD.right, y);
      ctx.stroke();
      ctx.fillText(`${p}\u00a2`, PAD.left - 4, y);
    }

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

    // ── Draw each series with visible/future split ──────────────────
    const splitIdx = playheadIdx;

    for (let si = 0; si < seriesKeys.length; si++) {
      const key = seriesKeys[si];
      const color = SERIES_COLORS[si % SERIES_COLORS.length];

      // Build series-specific points
      type Pt = { ts: number; val: number };
      const pts: Pt[] = [];
      for (const d of data) {
        if (d[key] != null) pts.push({ ts: d.ts, val: d[key] });
      }
      if (pts.length === 0) continue;

      // Split into visible and future at playhead index
      let visible: Pt[];
      let future: Pt[];

      if (splitIdx != null) {
        const splitTs = data[splitIdx].ts;
        visible = pts.filter((p) => p.ts <= splitTs);
        future = pts.filter((p) => p.ts > splitTs);
      } else {
        visible = pts;
        future = [];
      }

      // Area fill helper
      const fillArea = (seg: Pt[], fillStyle: string | CanvasGradient) => {
        if (seg.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(xOf(seg[0].ts), yOf(seg[0].val));
        for (let i = 1; i < seg.length; i++) {
          ctx.lineTo(xOf(seg[i].ts), yOf(seg[i].val));
        }
        const last = seg[seg.length - 1];
        ctx.lineTo(xOf(last.ts), yOf(minPrice));
        ctx.lineTo(xOf(seg[0].ts), yOf(minPrice));
        ctx.closePath();
        ctx.fillStyle = fillStyle;
        ctx.fill();
      };

      // Stroke helper
      const strokeLine = (
        seg: Pt[],
        style: string,
        width: number,
        dashed = false
      ) => {
        if (seg.length === 0) return;
        ctx.strokeStyle = style;
        ctx.lineWidth = width;
        ctx.lineJoin = "round";
        if (dashed) ctx.setLineDash([4, 5]);
        ctx.beginPath();
        ctx.moveTo(xOf(seg[0].ts), yOf(seg[0].val));
        for (let i = 1; i < seg.length; i++) {
          ctx.lineTo(xOf(seg[i].ts), yOf(seg[i].val));
        }
        ctx.stroke();
        if (dashed) ctx.setLineDash([]);
      };

      // Draw future (dim, dashed)
      if (future.length > 0) {
        const lastVis = visible[visible.length - 1];
        const stitched = lastVis ? [lastVis, ...future] : future;
        fillArea(stitched, FUTURE_FILL);
        strokeLine(stitched, FUTURE_LINE, 1, true);
      }

      // Draw visible (full color)
      if (visible.length > 0) {
        // Only first series gets area fill gradient
        if (si === 0) {
          const grad = ctx.createLinearGradient(0, PAD.top, 0, h - PAD.bottom);
          grad.addColorStop(0, LINE_DIM);
          grad.addColorStop(1, "rgba(0,0,0,0)");
          fillArea(visible, grad);
        }
        strokeLine(visible, color, 1.5);
      }

      // End dot when no playhead and no future
      if (splitIdx == null && visible.length > 0 && future.length === 0) {
        const last = visible[visible.length - 1];
        const lx = xOf(last.ts);
        const ly = yOf(last.val);
        ctx.beginPath();
        ctx.arc(lx, ly, 3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }
    }

    // ── Trade signal dots ───────────────────────────────────────────
    const allSignals: { sig: BuySignal; color: string }[] = [];
    if (buySignals)
      for (const sig of buySignals)
        allSignals.push({ sig, color: BUY_DOT_COLOR });
    if (sellSignals)
      for (const sig of sellSignals)
        allSignals.push({ sig, color: SELL_DOT_COLOR });

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
        const keyIdx = seriesKeys.indexOf(sig.ticker);
        const key = keyIdx >= 0 ? seriesKeys[keyIdx] : seriesKeys[0];
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

    // ── Current-position indicator (gold dot + vertical line) ───────
    if (splitIdx != null && data.length > 0) {
      const d = data[splitIdx];
      const cx = xOf(d.ts);
      // Use first series for the gold dot position
      const primaryKey = seriesKeys[0];
      const primaryVal = d[primaryKey];

      // Vertical dashed "now" line
      ctx.strokeStyle = "rgba(207,185,145,0.22)";
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 5]);
      ctx.beginPath();
      ctx.moveTo(cx, PAD.top);
      ctx.lineTo(cx, h - PAD.bottom);
      ctx.stroke();
      ctx.setLineDash([]);

      if (primaryVal != null) {
        const cy = yOf(primaryVal);
        const pulse = pulseRef.current; // 0 → 1

        // Animated pulse ring (expands and fades out)
        const pulseRadius = 4 + pulse * 12;
        const pulseAlpha = 0.35 * (1 - pulse);
        ctx.beginPath();
        ctx.arc(cx, cy, pulseRadius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(207,185,145,${pulseAlpha})`;
        ctx.fill();

        // Static mid ring
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(207,185,145,0.18)";
        ctx.fill();

        // Core dot (gold)
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fillStyle = ACCENT;
        ctx.fill();

        // Price label next to dot
        const label = `${primaryVal.toFixed(1)}\u00a2`;
        ctx.font = "bold 9px monospace";
        ctx.fillStyle = ACCENT;
        ctx.textAlign = cx > w - 80 ? "right" : "left";
        ctx.textBaseline = "middle";
        ctx.fillText(label, cx + (cx > w - 80 ? -10 : 10), cy);
      }
    }
  }, [data, seriesKeys, playheadIdx, buySignals, sellSignals]);

  useEffect(() => {
    let startTime: number | null = null;
    const PULSE_DURATION = 1500; // ms per cycle

    const tick = (time: number) => {
      if (startTime === null) startTime = time;
      pulseRef.current = ((time - startTime) % PULSE_DURATION) / PULSE_DURATION;
      draw();
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    const handler = () => draw();
    window.addEventListener("resize", handler);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", handler);
    };
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
        let lo = 0,
          hi = plays.length - 1;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (plays[mid].ts < d.ts) lo = mid + 1;
          else hi = mid;
        }
        let nearest = plays[lo];
        if (
          lo > 0 &&
          Math.abs(plays[lo - 1].ts - d.ts) < Math.abs(plays[lo].ts - d.ts)
        ) {
          nearest = plays[lo - 1];
        }
        scoreStr = `${nearest.awayScore} \u2013 ${nearest.homeScore}`;
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

  const isProgressing = playheadIdx != null && data.length > 0;
  const visibleCount = isProgressing ? playheadIdx + 1 : data.length;
  const currentPrice =
    isProgressing && seriesKeys.length > 0
      ? (data[playheadIdx][seriesKeys[0]] ?? null)
      : null;

  return (
    <div className="flex flex-col gap-2 h-full">
      {/* Header row */}
      <div className="flex items-center gap-3 text-[10px] font-mono text-muted flex-wrap">
        {seriesKeys.map((key, i) => (
          <span key={key} className="flex items-center gap-1">
            <span
              className="w-2.5 h-0.5 rounded-full inline-block"
              style={{
                background: SERIES_COLORS[i % SERIES_COLORS.length],
              }}
            />
            <span
              style={{ color: SERIES_COLORS[i % SERIES_COLORS.length] }}
            >
              {key}
            </span>
          </span>
        ))}
        {isProgressing && currentPrice !== null && (
          <span className="ml-auto font-bold" style={{ color: ACCENT }}>
            {currentPrice.toFixed(1)}&cent;
            <span className="text-muted/40 font-normal ml-1.5">
              &middot; {visibleCount}/{data.length} pts
            </span>
          </span>
        )}
      </div>

      {/* Chart */}
      <div
        ref={containerRef}
        className="relative flex-1 min-h-0 rounded-md border border-surface-border bg-surface overflow-hidden"
      >
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

        {/* Tooltip */}
        {hoverInfo && (
          <div
            className="absolute pointer-events-none z-20 bg-surface-light border border-surface-border rounded px-2 py-1 text-[10px] font-mono shadow-lg whitespace-nowrap"
            style={{
              left: Math.min(
                hoverInfo.x + 10,
                (containerRef.current?.clientWidth ?? 300) - 180
              ),
              top: Math.max(hoverInfo.y - 40, 4),
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
                    {v.value?.toFixed(1)}&cent;
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

        {/* Live badge when progressing */}
        {isProgressing && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded px-1.5 py-0.5 border border-accent/20">
            <span className="w-1 h-1 rounded-full bg-accent pulse-live" />
            <span className="text-[9px] font-bold text-accent tracking-wider">
              LIVE
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
