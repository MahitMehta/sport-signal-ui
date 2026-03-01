"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  TYPES                                                              */
/* ------------------------------------------------------------------ */

interface ForecastPoint {
  end_period_ts: number; // unix seconds
  numerical_forecast: number; // 0–100
}

interface KalshiChartProps {
  ticker: string;
  startTs: number;
  endTs: number;
  /** When set, only draw the chart up to this unix-second timestamp.
   *  Everything beyond is shown dimmed+dashed as "future". */
  progressTs?: number;
}

/* ------------------------------------------------------------------ */
/*  CONSTANTS                                                          */
/* ------------------------------------------------------------------ */

const LINE_COLOR = "#4a9eff";
const LINE_DIM = "rgba(74, 158, 255, 0.10)";
const FUTURE_LINE = "rgba(80, 80, 80, 0.55)";
const FUTURE_FILL = "rgba(40, 40, 40, 0.25)";
const GRID_COLOR = "#1a1a1a";
const LABEL_COLOR = "#555";
const ACCENT = "#CFB991"; // gold for "now" dot
const PAD = { top: 16, right: 12, bottom: 28, left: 46 };

/** Return a unix timestamp (seconds) for 9:00 PM EST on the same calendar day as `refTs`. */
function get9pmEstTs(refTs: number): number {
  const refMs = refTs * 1000;
  const estOffsetMs = 5 * 60 * 60 * 1000; // EST is UTC-5
  const estDate = new Date(refMs - estOffsetMs);
  const year = estDate.getUTCFullYear();
  const month = estDate.getUTCMonth();
  const day = estDate.getUTCDate();
  // 9:00 PM EST = 2:00 AM UTC next day (21 + 5 = 26 → overflows to 02:00)
  const target = new Date(Date.UTC(year, month, day, 21 + 5, 0, 0));
  return Math.floor(target.getTime() / 1000);
}

/* ------------------------------------------------------------------ */
/*  COMPONENT                                                          */
/* ------------------------------------------------------------------ */

export default function KalshiChart({
  ticker,
  startTs,
  endTs,
  progressTs,
}: KalshiChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const fetchData = useCallback(
    async (t: string, sTs: number, eTs: number) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/kalshi-candles?ticker=${encodeURIComponent(t)}&range=1D&start_ts=${sTs}&end_ts=${eTs}`
        );
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
          .filter((c: ForecastPoint) => c.numerical_forecast > 0)
          .sort((a: ForecastPoint, b: ForecastPoint) => a.end_period_ts - b.end_period_ts);

        if (points.length > 0) {
          const cutoff = get9pmEstTs(points[0].end_period_ts);
          setData(points.filter((p) => p.end_period_ts >= cutoff));
        } else {
          setData(points);
        }
      } catch {
        setError("Network error");
        setData([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (ticker) fetchData(ticker, startTs, endTs);
  }, [ticker, startTs, endTs, fetchData]);

  /* ---- drawing ---- */

  const draw = useCallback(
    (pTs?: number) => {
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

      // Axes computed over ALL data so they never jump as progressTs advances
      const minTs = data[0].end_period_ts * 1000;
      const maxTs = data[data.length - 1].end_period_ts * 1000;

      let lo = Infinity, hi = -Infinity;
      for (const d of data) {
        if (d.numerical_forecast > 0) {
          lo = Math.min(lo, d.numerical_forecast);
          hi = Math.max(hi, d.numerical_forecast);
        }
      }
      if (!Number.isFinite(lo)) { lo = 0; hi = 100; }
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
        ctx.fillText(p + "%", PAD.left - 4, y);
      }

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

      // ── Split data at progressTs ────────────────────────────────────
      const progressTsMs = pTs !== undefined ? pTs * 1000 : undefined;
      const visible =
        progressTsMs !== undefined
          ? data.filter((d) => d.end_period_ts * 1000 <= progressTsMs && d.numerical_forecast > 0)
          : data.filter((d) => d.numerical_forecast > 0);
      const future =
        progressTsMs !== undefined
          ? data.filter((d) => d.end_period_ts * 1000 > progressTsMs && d.numerical_forecast > 0)
          : [];

      // ── Helper: draw area fill ──────────────────────────────────────
      const fillArea = (pts: ForecastPoint[], fillStyle: string | CanvasGradient) => {
        if (pts.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(xOf(pts[0].end_period_ts * 1000), yOf(pts[0].numerical_forecast));
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(xOf(pts[i].end_period_ts * 1000), yOf(pts[i].numerical_forecast));
        }
        const last = pts[pts.length - 1];
        ctx.lineTo(xOf(last.end_period_ts * 1000), yOf(minPrice));
        ctx.lineTo(xOf(pts[0].end_period_ts * 1000), yOf(minPrice));
        ctx.closePath();
        ctx.fillStyle = fillStyle;
        ctx.fill();
      };

      // ── Helper: draw stroke line ────────────────────────────────────
      const strokeLine = (pts: ForecastPoint[], style: string, width: number, dashed = false) => {
        if (pts.length === 0) return;
        ctx.strokeStyle = style;
        ctx.lineWidth = width;
        ctx.lineJoin = "round";
        if (dashed) ctx.setLineDash([4, 5]);
        ctx.beginPath();
        ctx.moveTo(xOf(pts[0].end_period_ts * 1000), yOf(pts[0].numerical_forecast));
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(xOf(pts[i].end_period_ts * 1000), yOf(pts[i].numerical_forecast));
        }
        ctx.stroke();
        if (dashed) ctx.setLineDash([]);
      };

      // ── Draw future (dim, dashed) ───────────────────────────────────
      if (future.length > 0) {
        const lastVis = visible[visible.length - 1];
        const stitched = lastVis ? [lastVis, ...future] : future;
        fillArea(stitched, FUTURE_FILL);
        strokeLine(stitched, FUTURE_LINE, 1, true);
      }

      // ── Draw visible (full color) ───────────────────────────────────
      if (visible.length > 0) {
        const grad = ctx.createLinearGradient(0, PAD.top, 0, h - PAD.bottom);
        grad.addColorStop(0, LINE_DIM);
        grad.addColorStop(1, "rgba(0,0,0,0)");
        fillArea(visible, grad);
        strokeLine(visible, LINE_COLOR, 1.5);
      }

      // ── Current-position indicator (progressive mode) ───────────────
      if (progressTsMs !== undefined && visible.length > 0) {
        const curr = visible[visible.length - 1];
        const cx = xOf(curr.end_period_ts * 1000);
        const cy = yOf(curr.numerical_forecast);

        // Vertical dashed "now" line
        ctx.strokeStyle = "rgba(207,185,145,0.22)";
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 5]);
        ctx.beginPath();
        ctx.moveTo(cx, PAD.top);
        ctx.lineTo(cx, h - PAD.bottom);
        ctx.stroke();
        ctx.setLineDash([]);

        // Outer glow ring
        ctx.beginPath();
        ctx.arc(cx, cy, 8, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(207,185,145,0.10)";
        ctx.fill();

        // Mid ring
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(207,185,145,0.20)";
        ctx.fill();

        // Core dot (gold)
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fillStyle = ACCENT;
        ctx.fill();

        // Price label next to dot
        const label = `${curr.numerical_forecast.toFixed(1)}%`;
        ctx.font = "bold 9px monospace";
        ctx.fillStyle = ACCENT;
        ctx.textAlign = cx > w - 80 ? "right" : "left";
        ctx.textBaseline = "middle";
        ctx.fillText(label, cx + (cx > w - 80 ? -10 : 10), cy);
      } else if (visible.length > 0 && future.length === 0) {
        // Full chart — original end dot
        const last = visible[visible.length - 1];
        const lx = xOf(last.end_period_ts * 1000);
        const ly = yOf(last.numerical_forecast);
        ctx.beginPath();
        ctx.arc(lx, ly, 3, 0, Math.PI * 2);
        ctx.fillStyle = LINE_COLOR;
        ctx.fill();
      }
    },
    [data]
  );

  useEffect(() => {
    draw(progressTs);
    const handler = () => draw(progressTs);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [draw, progressTs]);

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

      const idx = Math.min(data.length - 1, Math.max(0, Math.round(frac * (data.length - 1))));
      const d = data[idx];
      const ts = new Date(d.end_period_ts * 1000);
      const timeStr = ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      setHoverInfo({ forecast: d.numerical_forecast, time: timeStr, x: mx, y: e.clientY - rect.top });
    },
    [data]
  );

  /* ---- render ---- */

  const isProgressing = progressTs !== undefined && data.length > 0;
  const visibleCount = isProgressing
    ? data.filter((d) => d.end_period_ts <= (progressTs ?? 0)).length
    : data.length;
  const currentPrice = isProgressing
    ? (data.filter((d) => d.end_period_ts <= (progressTs ?? 0)).slice(-1)[0]?.numerical_forecast ?? null)
    : null;

  return (
    <div className="flex flex-col gap-2 h-full">
      {/* Header row */}
      <div className="flex items-center gap-3 text-[10px] font-mono text-muted">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-0.5 rounded-full inline-block" style={{ background: LINE_COLOR }} />
          Forecast
        </span>
        {marketLabel && <span className="text-muted/60 ml-1">{marketLabel}</span>}
        {isProgressing && currentPrice !== null && (
          <span className="ml-auto font-bold" style={{ color: ACCENT }}>
            {currentPrice.toFixed(1)}%
            <span className="text-muted/40 font-normal ml-1.5">· {visibleCount}/{data.length} pts</span>
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

        {/* Live badge when progressing */}
        {isProgressing && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded px-1.5 py-0.5 border border-accent/20">
            <span className="w-1 h-1 rounded-full bg-accent pulse-live" />
            <span className="text-[9px] font-bold text-accent tracking-wider">LIVE</span>
          </div>
        )}
      </div>
    </div>
  );
}
