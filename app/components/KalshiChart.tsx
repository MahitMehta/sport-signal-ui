"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  TYPES                                                              */
/* ------------------------------------------------------------------ */

interface ForecastPoint {
  end_period_ts: number;
  numerical_forecast: number;
}

interface KalshiChartProps {
  ticker: string;
  startTs: number;
  endTs: number;
  onDataLoaded?: (data: ForecastPoint[]) => void;
}

/* ------------------------------------------------------------------ */
/*  CONSTANTS (matching polibetting-inference aesthetic)                */
/* ------------------------------------------------------------------ */

const LINE_COLOR = "#4a9eff";
const LINE_DIM = "rgba(74, 158, 255, 0.10)";
const GRID_COLOR = "#1a1a1a";
const LABEL_COLOR = "#555";
const PAD = { top: 16, right: 12, bottom: 28, left: 46 };

/** Return a unix timestamp (seconds) for 8:30 PM EST on the same calendar day as `refTs`. */
function get830pmEstTs(refTs: number): number {
  // EST is UTC-5
  const refMs = refTs * 1000;
  // Get the date in EST by shifting to UTC-5
  const estOffsetMs = 5 * 60 * 60 * 1000;
  const estDate = new Date(refMs - estOffsetMs);
  // Build 8:30 PM EST on that calendar day
  const year = estDate.getUTCFullYear();
  const month = estDate.getUTCMonth();
  const day = estDate.getUTCDate();
  // 8:30 PM EST = 20:30 EST = 01:30 next day UTC (20:30 + 5:00)
  const target = new Date(Date.UTC(year, month, day, 20 + 5, 30, 0));
  return Math.floor(target.getTime() / 1000);
}

/* ------------------------------------------------------------------ */
/*  COMPONENT                                                          */
/* ------------------------------------------------------------------ */

export type { ForecastPoint };

export default function KalshiChart({ ticker, startTs, endTs, onDataLoaded }: KalshiChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const onDataLoadedRef = useRef(onDataLoaded);
  onDataLoadedRef.current = onDataLoaded;

  const [data, setData] = useState<ForecastPoint[]>([]);
  const [marketLabel, setMarketLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoverInfo, setHoverInfo] = useState<{
    forecast: number;
    time: string;
    x: number;
    y: number;
  } | null>(null);

  /* ---- fetch ---- */

  const fetchData = useCallback(async (t: string, sTs: number, eTs: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/kalshi-candles?ticker=${encodeURIComponent(t)}&range=1D&start_ts=${sTs}&end_ts=${eTs}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to load");
        setData([]);
        return;
      }
      setMarketLabel(json.marketLabel || "");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const points: ForecastPoint[] = (json.forecast_history || [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((c: any) => ({
          end_period_ts: c.end_period_ts,
          numerical_forecast: c.numerical_forecast ?? 0,
        }))
        .filter((c: ForecastPoint) => c.numerical_forecast > 0);

      // Filter to only show data from 8:30 PM EST onward
      if (points.length > 0) {
        const cutoff = get830pmEstTs(points[0].end_period_ts);
        const filtered = points.filter((p) => p.end_period_ts >= cutoff);
        setData(filtered);
        onDataLoadedRef.current?.(filtered);
      } else {
        setData(points);
        onDataLoadedRef.current?.(points);
      }
    } catch {
      setError("Network error");
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ticker) fetchData(ticker, startTs, endTs);
  }, [ticker, startTs, endTs, fetchData]);

  /* ---- drawing ---- */

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

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

    // Compute ranges
    const timestamps = data.map((d) => d.end_period_ts * 1000);
    const minTs = timestamps[0];
    const maxTs = timestamps[timestamps.length - 1];

    let lo = Infinity,
      hi = -Infinity;
    for (const d of data) {
      const v = d.numerical_forecast;
      if (v > 0) {
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
    }
    if (!Number.isFinite(lo)) { lo = 0; hi = 100; }
    const pricePad = Math.max(2, (hi - lo) * 0.1);
    const minPrice = Math.max(0, lo - pricePad);
    const maxPrice = Math.min(100, hi + pricePad);

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
      ctx.fillText(p + "%", PAD.left - 4, y);
    }

    // Time labels (always show time of day)
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const totalMs = maxTs - minTs;
    const labelCount = Math.min(6, Math.max(2, Math.floor(plotW / 70)));
    for (let i = 0; i <= labelCount; i++) {
      const ts = minTs + (totalMs * i) / labelCount;
      const d = new Date(ts);
      const label = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      ctx.fillText(label, xOf(ts), h - PAD.bottom + 6);
    }

    // Draw forecast line with area fill
    // Area fill
    ctx.beginPath();
    let started = false;
    let firstX = 0;
    for (const d of data) {
      const val = d.numerical_forecast;
      if (val <= 0) continue;
      const x = xOf(d.end_period_ts * 1000);
      const y = yOf(val);
      if (!started) {
        ctx.moveTo(x, y);
        firstX = x;
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    if (started) {
      const lastD = [...data].reverse().find((d) => d.numerical_forecast > 0);
      if (lastD) {
        ctx.lineTo(xOf(lastD.end_period_ts * 1000), yOf(minPrice));
        ctx.lineTo(firstX, yOf(minPrice));
        ctx.closePath();
        const gradient = ctx.createLinearGradient(0, PAD.top, 0, h - PAD.bottom);
        gradient.addColorStop(0, LINE_DIM);
        gradient.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = gradient;
        ctx.fill();
      }
    }

    // Line
    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.beginPath();
    started = false;
    for (const d of data) {
      const val = d.numerical_forecast;
      if (val <= 0) continue;
      const x = xOf(d.end_period_ts * 1000);
      const y = yOf(val);
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // End dot
    const lastD = [...data].reverse().find((d) => d.numerical_forecast > 0);
    if (lastD) {
      const lx = xOf(lastD.end_period_ts * 1000);
      const ly = yOf(lastD.numerical_forecast);
      ctx.beginPath();
      ctx.arc(lx, ly, 3, 0, Math.PI * 2);
      ctx.fillStyle = LINE_COLOR;
      ctx.fill();
    }
  }, [data]);

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
      const ts = new Date(d.end_period_ts * 1000);
      const timeStr = ts.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      setHoverInfo({
        forecast: d.numerical_forecast,
        time: timeStr,
        x: mx,
        y: e.clientY - rect.top,
      });
    },
    [data]
  );

  /* ---- render ---- */

  return (
    <div className="flex flex-col gap-2 h-full">
      {/* Header row */}
      <div className="flex items-center gap-3 text-[10px] font-mono text-muted">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-0.5 rounded-full inline-block" style={{ background: LINE_COLOR }} />
          Forecast
        </span>
        {marketLabel && (
          <span className="text-muted/60 ml-1">{marketLabel}</span>
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
            className="absolute pointer-events-none z-20 bg-surface-light border border-surface-border rounded px-2 py-1 text-[10px] font-mono shadow-lg"
            style={{
              left: Math.min(hoverInfo.x + 10, (containerRef.current?.clientWidth ?? 300) - 120),
              top: Math.max(hoverInfo.y - 30, 4),
            }}
          >
            <span style={{ color: LINE_COLOR }} className="font-bold">{hoverInfo.forecast}%</span>
            <span className="text-muted ml-2">{hoverInfo.time}</span>
          </div>
        )}
      </div>
    </div>
  );
}
