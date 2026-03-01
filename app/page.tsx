"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Hls from "hls.js";
import {
  Tv,
  BarChart3,
  ArrowRight,
  Radio,
  Trophy,
  Clock,
  TrendingUp,
  ChevronRight,
  Play,
  Calendar,
  Loader2,
  AlertCircle,
  Zap,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  DATA                                                               */
/* ------------------------------------------------------------------ */

interface Game {
  id: string;
  teamA: string;
  teamB: string;
  teamAShort: string;
  teamBShort: string;
  time: string;
  status: "live" | "upcoming" | "final";
  scoreA?: number;
  scoreB?: number;
  spread?: string;
  kalshiUrl: string;
  kalshiTicker: string;
  kalshiStartTs: number;
  kalshiEndTs: number;
  date?: string;
  aiSignal?: "BUY" | "SELL" | "HOLD";
  aiConfidence?: number;
  observationCount?: number;
  kalshiReturn?: number;
}

const TEAM_COLORS: Record<string, string> = {
  ARIZ: "#AB0520", KU: "#0051A5", AUB: "#0C2340", BAMA: "#9E1B32",
  UCONN: "#000E2F", NOVA: "#00205B", ILL: "#E84A27", IND: "#990000",
  UF: "#0021A5", LSU: "#461D7C", MU: "#003366", SJU: "#BA0C2F",
  ISU: "#C8102E", KSU: "#512888", MICH: "#00274C", WIS: "#C5050C",
  TEX: "#BF5700", OU: "#841617", DUKE: "#003087", UNC: "#4B9CD3",
  GONZ: "#002966", UCLA: "#2D68C4", UK: "#0033A0", TENN: "#FF8200",
  HOU: "#C8102E", BAY: "#154734", PUR: "#CFB991", MSU: "#18453B",
};

const GAMES: Game[] = [
  {
    id: "1",
    teamA: "Arizona Wildcats", teamB: "Kansas Jayhawks",
    teamAShort: "ARIZ", teamBShort: "KU",
    time: "FINAL", status: "final", scoreA: 67, scoreB: 72,
    spread: "KU -3.5",
    kalshiUrl: "https://kalshi.com/markets/kxncaambgame/mens-college-basketball-mens-game/kxncaambgame-26feb09arizku",
    kalshiTicker: "KXNCAAMBGAME-26FEB09ARIZKU",
    kalshiStartTs: 1770494460, kalshiEndTs: 1770697320,
    date: "Feb 9, 2026",
    aiSignal: "SELL", aiConfidence: 87, observationCount: 142, kalshiReturn: 14.2,
  },
  {
    id: "2",
    teamA: "Duke Blue Devils", teamB: "UNC Tar Heels",
    teamAShort: "DUKE", teamBShort: "UNC",
    time: "LIVE", status: "live", scoreA: 54, scoreB: 58,
    spread: "UNC -2.0",
    kalshiUrl: "https://kalshi.com/markets/kxncaambgame/mens-college-basketball-mens-game/kxncaambgame-26feb07dukeunc",
    kalshiTicker: "KXNCAAMBGAME-26FEB07DUKEUNC",
    kalshiStartTs: 0, kalshiEndTs: 0,
  },
  {
    id: "3",
    teamA: "Gonzaga Bulldogs", teamB: "UCLA Bruins",
    teamAShort: "GONZ", teamBShort: "UCLA",
    time: "7:00 PM ET", status: "upcoming",
    spread: "GONZ -5.5",
    kalshiUrl: "https://kalshi.com/markets/kxncaambgame/mens-college-basketball-mens-game/kxncaambgame-26feb07gonzucla",
    kalshiTicker: "KXNCAAMBGAME-26FEB07GONZUCLA",
    kalshiStartTs: 0, kalshiEndTs: 0,
  },
  {
    id: "4",
    teamA: "Kentucky Wildcats", teamB: "Tennessee Vols",
    teamAShort: "UK", teamBShort: "TENN",
    time: "8:00 PM ET", status: "upcoming",
    spread: "TENN -1.5",
    kalshiUrl: "https://kalshi.com/markets/kxncaambgame/mens-college-basketball-mens-game/kxncaambgame-26feb08uktenn",
    kalshiTicker: "KXNCAAMBGAME-26FEB08UKTENN",
    kalshiStartTs: 0, kalshiEndTs: 0,
  },
  {
    id: "5",
    teamA: "Houston Cougars", teamB: "Baylor Bears",
    teamAShort: "HOU", teamBShort: "BAY",
    time: "8:30 PM ET", status: "upcoming",
    spread: "HOU -4.0",
    kalshiUrl: "https://kalshi.com/markets/kxncaambgame/mens-college-basketball-mens-game/kxncaambgame-26feb08houbay",
    kalshiTicker: "KXNCAAMBGAME-26FEB08HOUBAY",
    kalshiStartTs: 0, kalshiEndTs: 0,
  },
  {
    id: "6",
    teamA: "Purdue Boilermakers", teamB: "Michigan St Spartans",
    teamAShort: "PUR", teamBShort: "MSU",
    time: "9:00 PM ET", status: "upcoming",
    spread: "PUR -6.5",
    kalshiUrl: "https://kalshi.com/markets/kxncaambgame/mens-college-basketball-mens-game/kxncaambgame-26feb09purmsu",
    kalshiTicker: "KXNCAAMBGAME-26FEB09PURMSU",
    kalshiStartTs: 0, kalshiEndTs: 0,
  },
  {
    id: "7",
    teamA: "Auburn Tigers", teamB: "Alabama Crimson Tide",
    teamAShort: "AUB", teamBShort: "BAMA",
    time: "FINAL", status: "final", scoreA: 81, scoreB: 76,
    spread: "AUB -2.5",
    kalshiUrl: "https://kalshi.com/markets/kxncaambgame/mens-college-basketball-mens-game/kxncaambgame-26feb06aubbama",
    kalshiTicker: "KXNCAAMBGAME-26FEB06AUBBAMA",
    kalshiStartTs: 0, kalshiEndTs: 0,
    date: "Feb 6, 2026",
    aiSignal: "BUY", aiConfidence: 73, observationCount: 98, kalshiReturn: 8.7,
  },
  {
    id: "8",
    teamA: "UConn Huskies", teamB: "Villanova Wildcats",
    teamAShort: "UCONN", teamBShort: "NOVA",
    time: "FINAL", status: "final", scoreA: 69, scoreB: 63,
    spread: "UCONN -7.0",
    kalshiUrl: "https://kalshi.com/markets/kxncaambgame/mens-college-basketball-mens-game/kxncaambgame-26feb05uconnnova",
    kalshiTicker: "KXNCAAMBGAME-26FEB05UCONNNOVA",
    kalshiStartTs: 0, kalshiEndTs: 0,
    date: "Feb 5, 2026",
    aiSignal: "HOLD", aiConfidence: 61, observationCount: 77, kalshiReturn: -2.1,
  },
  {
    id: "9",
    teamA: "Illinois Fighting Illini", teamB: "Indiana Hoosiers",
    teamAShort: "ILL", teamBShort: "IND",
    time: "FINAL", status: "final", scoreA: 78, scoreB: 71,
    spread: "ILL -4.5",
    kalshiUrl: "https://kalshi.com/markets/kxncaambgame/mens-college-basketball-mens-game/kxncaambgame-26feb10illind",
    kalshiTicker: "KXNCAAMBGAME-26FEB10ILLIND",
    kalshiStartTs: 0, kalshiEndTs: 0,
    date: "Feb 10, 2026",
    aiSignal: "BUY", aiConfidence: 82, observationCount: 115, kalshiReturn: 11.3,
  },
  {
    id: "10",
    teamA: "Florida Gators", teamB: "LSU Tigers",
    teamAShort: "UF", teamBShort: "LSU",
    time: "FINAL", status: "final", scoreA: 74, scoreB: 79,
    spread: "LSU -2.0",
    kalshiUrl: "https://kalshi.com/markets/kxncaambgame/mens-college-basketball-mens-game/kxncaambgame-26feb11uflsu",
    kalshiTicker: "KXNCAAMBGAME-26FEB11UFLSU",
    kalshiStartTs: 0, kalshiEndTs: 0,
    date: "Feb 11, 2026",
    aiSignal: "SELL", aiConfidence: 91, observationCount: 203, kalshiReturn: 19.8,
  },
  {
    id: "11",
    teamA: "Marquette Golden Eagles", teamB: "St. John's Red Storm",
    teamAShort: "MU", teamBShort: "SJU",
    time: "FINAL", status: "final", scoreA: 83, scoreB: 80,
    spread: "MU -3.0",
    kalshiUrl: "https://kalshi.com/markets/kxncaambgame/mens-college-basketball-mens-game/kxncaambgame-26feb12musju",
    kalshiTicker: "KXNCAAMBGAME-26FEB12MUSJU",
    kalshiStartTs: 0, kalshiEndTs: 0,
    date: "Feb 12, 2026",
    aiSignal: "HOLD", aiConfidence: 55, observationCount: 64, kalshiReturn: -1.4,
  },
  {
    id: "12",
    teamA: "Iowa State Cyclones", teamB: "Kansas State Wildcats",
    teamAShort: "ISU", teamBShort: "KSU",
    time: "FINAL", status: "final", scoreA: 91, scoreB: 85,
    spread: "ISU -5.0",
    kalshiUrl: "https://kalshi.com/markets/kxncaambgame/mens-college-basketball-mens-game/kxncaambgame-26feb13isuksu",
    kalshiTicker: "KXNCAAMBGAME-26FEB13ISUKSU",
    kalshiStartTs: 0, kalshiEndTs: 0,
    date: "Feb 13, 2026",
    aiSignal: "BUY", aiConfidence: 78, observationCount: 134, kalshiReturn: 7.2,
  },
  {
    id: "13",
    teamA: "Michigan Wolverines", teamB: "Wisconsin Badgers",
    teamAShort: "MICH", teamBShort: "WIS",
    time: "FINAL", status: "final", scoreA: 61, scoreB: 68,
    spread: "WIS -3.5",
    kalshiUrl: "https://kalshi.com/markets/kxncaambgame/mens-college-basketball-mens-game/kxncaambgame-26feb14michwis",
    kalshiTicker: "KXNCAAMBGAME-26FEB14MICHWIS",
    kalshiStartTs: 0, kalshiEndTs: 0,
    date: "Feb 14, 2026",
    aiSignal: "SELL", aiConfidence: 84, observationCount: 167, kalshiReturn: 16.5,
  },
  {
    id: "14",
    teamA: "Texas Longhorns", teamB: "Oklahoma Sooners",
    teamAShort: "TEX", teamBShort: "OU",
    time: "FINAL", status: "final", scoreA: 88, scoreB: 77,
    spread: "TEX -8.0",
    kalshiUrl: "https://kalshi.com/markets/kxncaambgame/mens-college-basketball-mens-game/kxncaambgame-26feb15texou",
    kalshiTicker: "KXNCAAMBGAME-26FEB15TEXOU",
    kalshiStartTs: 0, kalshiEndTs: 0,
    date: "Feb 15, 2026",
    aiSignal: "BUY", aiConfidence: 69, observationCount: 88, kalshiReturn: 5.9,
  },
];

/* ------------------------------------------------------------------ */
/*  HOOKS                                                              */
/* ------------------------------------------------------------------ */

function useCountUp(target: number, duration = 1500, delay = 0) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => {
      const start = Date.now();
      const tick = () => {
        const elapsed = Date.now() - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setCount(Math.round(eased * target));
        if (progress < 1) requestAnimationFrame(tick);
        else setCount(target);
      };
      requestAnimationFrame(tick);
    }, delay);
    return () => clearTimeout(t);
  }, [target, duration, delay]);
  return count;
}

/* ------------------------------------------------------------------ */
/*  ANIMATION VARIANTS                                                 */
/* ------------------------------------------------------------------ */

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

const stagger = { visible: { transition: { staggerChildren: 0.06 } } };

/* ------------------------------------------------------------------ */
/*  BASKETBALL VISUAL                                                  */
/* ------------------------------------------------------------------ */

function BasketballScene() {
  return (
    <div className="relative w-full h-full flex items-center justify-center select-none pointer-events-none">
      <style>{`
        @keyframes bb-float{0%,100%{transform:translateY(0px)}50%{transform:translateY(-14px)}}
        @keyframes bb-shadow-pulse{0%,100%{transform:scaleX(1);opacity:0.22}50%{transform:scaleX(0.74);opacity:0.07}}
        @keyframes arc-glow{0%,100%{stroke-dashoffset:0}50%{stroke-dashoffset:-60}}
        .bb-float{animation:bb-float 3.6s ease-in-out infinite}
        .bb-shadow{animation:bb-shadow-pulse 3.6s ease-in-out infinite}
        .arc-dash{stroke-dasharray:28 14;animation:arc-glow 4.5s ease-in-out infinite}
      `}</style>

      {/* Court arc background */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.05]" viewBox="0 0 340 340" preserveAspectRatio="xMidYMid meet">
        <path d="M 30 320 A 155 155 0 0 1 310 320" fill="none" stroke="#CFB991" strokeWidth="1.2" className="arc-dash" />
        <rect x="110" y="180" width="120" height="140" fill="none" stroke="#CFB991" strokeWidth="1" opacity="0.6" />
        <circle cx="170" cy="180" r="52" fill="none" stroke="#CFB991" strokeWidth="1" opacity="0.5" />
        <circle cx="170" cy="170" r="22" fill="none" stroke="#CFB991" strokeWidth="1" opacity="0.4" />
        <circle cx="170" cy="298" r="10" fill="none" stroke="#CFB991" strokeWidth="1.5" opacity="0.7" />
        <line x1="170" y1="288" x2="170" y2="278" stroke="#CFB991" strokeWidth="1.5" opacity="0.6" />
      </svg>

      {/* Main basketball */}
      <div className="relative flex flex-col items-center">
        <div className="bb-float">
          {/*
            Real basketball seam geometry (200×200, center 100,100, r=90):
            Front view shows 3 channels:
              1. Horizontal equatorial groove (two close horizontal curves)
              2. Left side C-arc (from top pole, hugs left edge, to bottom pole)
              3. Right side C-arc (mirror)
            Each channel = two parallel dark strokes with orange gap = groove.
            Outer arcs use CP outside viewBox; clipPath keeps them inside circle.
          */}
          <svg width="180" height="180" viewBox="0 0 200 200">
            <defs>
              {/* Sphere gradient — lit upper-left */}
              <radialGradient id="bbGrad" cx="37%" cy="30%" r="68%">
                <stop offset="0%"   stopColor="#FFC07A" />
                <stop offset="22%"  stopColor="#F07222" />
                <stop offset="58%"  stopColor="#C04A08" />
                <stop offset="100%" stopColor="#6E2400" />
              </radialGradient>
              {/* Specular highlight blob */}
              <radialGradient id="bbSpec" cx="31%" cy="22%" r="34%">
                <stop offset="0%"   stopColor="rgba(255,248,220,0.72)" />
                <stop offset="55%"  stopColor="rgba(255,200,100,0.15)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </radialGradient>
              {/* Rim darkening for roundness */}
              <radialGradient id="bbRim" cx="50%" cy="50%" r="50%">
                <stop offset="55%"  stopColor="rgba(0,0,0,0)" />
                <stop offset="100%" stopColor="rgba(0,0,0,0.58)" />
              </radialGradient>
              {/* Clip everything to circle */}
              <clipPath id="bClip">
                <circle cx="100" cy="100" r="89" />
              </clipPath>
            </defs>

            {/* ── Ball body ── */}
            <circle cx="100" cy="100" r="90" fill="url(#bbGrad)" />

            {/* ── Seam channels, clipped to ball ── */}
            <g clipPath="url(#bClip)" fill="none" strokeLinecap="round">

              {/*
                CHANNEL 1 — Horizontal equatorial groove
                Two curves bowing up/down from the center line.
                Gap at centre ~8 px = realistic narrow groove.
              */}
              <path d="M 10 100 C 55 95 145 95 190 100"
                    stroke="#1A0800" strokeWidth="4" />
              <path d="M 10 100 C 55 105 145 105 190 100"
                    stroke="#1A0800" strokeWidth="4" />
              {/* groove glint on upper edge */}
              <path d="M 10 100 C 55 95 145 95 190 100"
                    stroke="#8B3A10" strokeWidth="1.4" opacity="0.45" />

              {/*
                CHANNEL 2 — Left side C-arc seam
                From top pole (100,10) → curves around left edge → bottom pole (100,190).
                Outer line: CP at x=−20 so it hugs the circle's left edge (x≈10 at y=100).
                Inner line: CP at x=−9 so it sits ~10 px inside outer.
              */}
              <path d="M 100 10 C -20 45 -20 155 100 190"
                    stroke="#1A0800" strokeWidth="4" />
              <path d="M 100 10 C  -9 45  -9 155 100 190"
                    stroke="#1A0800" strokeWidth="4" />
              {/* groove glint */}
              <path d="M 100 10 C -20 45 -20 155 100 190"
                    stroke="#8B3A10" strokeWidth="1.4" opacity="0.45" />

              {/*
                CHANNEL 3 — Right side C-arc seam (mirror of left)
                Outer CP at x=220, inner at x=209.
              */}
              <path d="M 100 10 C 220 45 220 155 100 190"
                    stroke="#1A0800" strokeWidth="4" />
              <path d="M 100 10 C 209 45 209 155 100 190"
                    stroke="#1A0800" strokeWidth="4" />
              <path d="M 100 10 C 220 45 220 155 100 190"
                    stroke="#8B3A10" strokeWidth="1.4" opacity="0.45" />

            </g>

            {/* ── Specular highlight (rendered on top of seams) ── */}
            <circle cx="100" cy="100" r="90" fill="url(#bbSpec)" />
            {/* ── Edge vignette ── */}
            <circle cx="100" cy="100" r="90" fill="url(#bbRim)" />
            {/* ── Crisp outline ── */}
            <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(0,0,0,0.38)" strokeWidth="2" />
          </svg>
        </div>
        {/* Floating shadow */}
        <div
          className="bb-shadow rounded-full"
          style={{ width: "110px", height: "14px", background: "radial-gradient(ellipse, rgba(0,0,0,0.48) 0%, transparent 70%)", marginTop: "2px" }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TICKER TAPE                                                        */
/* ------------------------------------------------------------------ */

function TickerTape({ games }: { games: Game[] }) {
  const items = games.map((g) => {
    if (g.status === "live") return `● LIVE  ${g.teamAShort} ${g.scoreA}  —  ${g.teamBShort} ${g.scoreB}`;
    if (g.status === "final") return `${g.teamAShort} ${g.scoreA}  —  ${g.teamBShort} ${g.scoreB}  FINAL`;
    return `${g.teamAShort}  vs  ${g.teamBShort}  ·  ${g.time}`;
  });
  const content = [...items, ...items].join("          ·          ");
  return (
    <div className="overflow-hidden border-t border-b border-surface-border/40 bg-surface/20">
      <style>{`@keyframes ss-tick{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}.ss-run{animation:ss-tick 70s linear infinite;white-space:nowrap;}`}</style>
      <div className="py-2">
        <span className="ss-run inline-block text-[10px] font-mono tracking-widest text-muted/30 uppercase">
          {content}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  COMPONENTS                                                         */
/* ------------------------------------------------------------------ */

function Navbar() {
  const liveCount = GAMES.filter((g) => g.status === "live").length;
  return (
    <motion.nav
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="sticky top-0 z-50 flex items-center justify-between px-6 py-3.5 border-b border-surface-border bg-background/85 backdrop-blur-xl"
    >
      <div className="flex items-center gap-2.5">
        <div className="w-6 h-6 rounded-md bg-accent/10 border border-accent/20 flex items-center justify-center">
          <Zap className="w-3 h-3 text-accent" />
        </div>
        <span className="text-sm font-black tracking-tight">
          Vision<span className="text-accent">Signal</span>
        </span>
      </div>
      <div className="flex items-center gap-5 text-xs text-muted">
        <span className="hidden sm:inline tracking-wide font-mono uppercase text-muted/35 text-[10px]">
          NCAA Basketball
        </span>
        {liveCount > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 pulse-live" />
            <span className="text-green-400 font-bold">{liveCount} Live</span>
          </div>
        )}
      </div>
    </motion.nav>
  );
}

function StreamPanel({ obsUrl, setObsUrl, onConnected }: { obsUrl: string; setObsUrl: (v: string) => void; onConnected: (url: string) => void; }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [streamStatus, setStreamStatus] = useState<"idle" | "connecting" | "playing" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const attachStream = useCallback((url: string) => {
    const video = videoRef.current;
    if (!video || !url) return;
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    setStreamStatus("connecting"); setErrorMsg("");
    const isHls = url.includes(".m3u8");
    if (isHls && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      hlsRef.current = hls; hls.loadSource(url); hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => { video.play().catch(() => {}); setStreamStatus("playing"); onConnected(url); });
      hls.on(Hls.Events.ERROR, (_e, data) => { if (data.fatal) { setStreamStatus("error"); setErrorMsg(data.type === Hls.ErrorTypes.NETWORK_ERROR ? "Network error — check your stream URL" : "Stream playback failed"); } });
    } else {
      video.src = url;
      video.addEventListener("loadedmetadata", () => { video.play().catch(() => {}); setStreamStatus("playing"); onConnected(url); }, { once: true });
      video.addEventListener("error", () => { setStreamStatus("error"); setErrorMsg("Could not load video"); }, { once: true });
    }
  }, [onConnected]);

  const handleSubmit = useCallback(() => { if (obsUrl.trim()) attachStream(obsUrl.trim()); }, [obsUrl, attachStream]);
  useEffect(() => { return () => { if (hlsRef.current) hlsRef.current.destroy(); }; }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-accent/70">
        <Tv className="w-3.5 h-3.5" />
        Livestream
      </div>
      <div className="relative rounded-xl overflow-hidden border border-surface-border">
        <div className="bg-surface rounded-xl aspect-video flex flex-col items-center justify-center gap-3 relative">
          <video ref={videoRef} className={`w-full h-full rounded-xl ${streamStatus === "playing" ? "block" : "hidden"}`} muted playsInline crossOrigin="anonymous" />
          {streamStatus !== "playing" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              {streamStatus === "connecting" ? (
                <><Loader2 className="w-8 h-8 text-accent animate-spin" /><p className="text-muted text-sm">Connecting…</p></>
              ) : streamStatus === "error" ? (
                <><AlertCircle className="w-8 h-8 text-red-400" /><p className="text-red-400 text-sm">{errorMsg}</p></>
              ) : (
                <><Radio className="w-8 h-8 text-muted/40" /><p className="text-muted/50 text-sm">Enter stream URL below</p></>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1 group">
          <input type="text" placeholder="http://localhost:8080/live/stream.m3u8" value={obsUrl} onChange={(e) => setObsUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2.5 pl-9 text-xs text-foreground placeholder:text-muted/40 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all" />
          <Tv className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted/40 group-focus-within:text-accent transition-colors" />
        </div>
        <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={handleSubmit}
          className="bg-accent hover:bg-accent-light text-black font-bold px-4 py-2.5 rounded-lg flex items-center gap-1.5 text-xs transition-colors shrink-0">
          <Play className="w-3.5 h-3.5" />
          Connect
        </motion.button>
      </div>
      <AnimatePresence>
        {streamStatus === "playing" && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <div className="bg-surface-light border border-green-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 pulse-live shrink-0" />
              <span className="text-xs text-green-400 font-medium">Stream connected</span>
              <span className="text-[10px] text-muted/40 font-mono truncate ml-auto">{obsUrl}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TickerPanel({ ticker, setTicker, onSubmit }: { ticker: string; setTicker: (v: string) => void; onSubmit: () => void; }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-accent/70">
        <BarChart3 className="w-3.5 h-3.5" />
        Kalshi Ticker
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1 group">
          <input type="text" placeholder="KXNCAAMBGAME-26FEB09ARIZKU" value={ticker} onChange={(e) => setTicker(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onSubmit()}
            className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2.5 pl-9 text-xs text-foreground placeholder:text-muted/40 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all font-mono" />
          <TrendingUp className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted/40 group-focus-within:text-accent transition-colors" />
        </div>
        <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={onSubmit}
          className="bg-accent hover:bg-accent-light text-black font-bold px-4 py-2.5 rounded-lg flex items-center gap-1.5 text-xs transition-colors shrink-0">
          <ArrowRight className="w-3.5 h-3.5" />
          Track
        </motion.button>
      </div>
      <AnimatePresence>
        {ticker && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <div className="bg-surface-light border border-accent/15 rounded-lg px-3 py-2 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-accent pulse-live shrink-0" />
              <span className="font-mono text-xs text-accent">{ticker.toUpperCase()}</span>
              <span className="text-[10px] text-muted/40 ml-auto">Tracking market…</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatusBadge({ status, time }: { status: Game["status"]; time?: string }) {
  if (status === "live") return (
    <span className="flex items-center gap-1.5 text-xs font-bold text-green-400">
      <span className="w-1.5 h-1.5 rounded-full bg-green-400 pulse-live" />LIVE
    </span>
  );
  if (status === "final") return <span className="text-[10px] font-bold text-muted/40">FINAL</span>;
  return <span className="text-[10px] text-muted/50">{time}</span>;
}

function GameCard({ game, index }: { game: Game; index: number }) {
  const colorA = TEAM_COLORS[game.teamAShort] ?? "#1a1a1a";
  const colorB = TEAM_COLORS[game.teamBShort] ?? "#2a2a2a";
  return (
    <motion.a href={game.kalshiUrl} target="_blank" rel="noopener noreferrer"
      variants={fadeUp} custom={index + 3} initial="hidden" whileInView="visible"
      viewport={{ once: true, amount: 0.2 }} whileHover={{ scale: 1.01, y: -2 }} className="block group">
      <div className={`relative bg-surface border rounded-xl overflow-hidden transition-all duration-300 ${game.status === "live" ? "border-accent/30 glow-gold" : "border-surface-border"} hover:glow-gold`}>
        <div className="h-[3px] w-full" style={{ background: game.status === "live" ? `linear-gradient(90deg, ${colorA}, ${colorB})` : game.status === "final" ? "rgba(80,80,80,0.4)" : "rgba(42,42,42,0.6)" }} />
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1.5">
              <Trophy className="w-3 h-3 text-accent/50" />
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted/35">NCAA Basketball</span>
            </div>
            <StatusBadge status={game.status} time={game.time} />
          </div>
          <div className="space-y-2.5">
            {[{ short: game.teamAShort, name: game.teamA, score: game.scoreA, color: colorA, winning: (game.scoreA ?? 0) > (game.scoreB ?? 0) },
              { short: game.teamBShort, name: game.teamB, score: game.scoreB, color: colorB, winning: (game.scoreB ?? 0) > (game.scoreA ?? 0) }].map((team) => (
              <div key={team.short} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-md flex items-center justify-center text-[9px] font-black text-white shrink-0"
                    style={{ background: `linear-gradient(135deg, ${team.color}, ${team.color}99)` }}>
                    {team.short.slice(0, 2)}
                  </div>
                  <span className="text-sm font-semibold text-foreground/85 truncate">{team.name}</span>
                </div>
                {team.score !== undefined && (
                  <span className={`font-mono font-black text-xl tabular-nums ${team.winning ? "text-foreground" : "text-muted/25"}`}>{team.score}</span>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-surface-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              {game.spread && <span className="text-[10px] bg-surface-light border border-surface-border rounded px-2 py-0.5 font-mono text-muted/50">{game.spread}</span>}
            </div>
            <div className="flex items-center gap-1 text-[10px] text-accent opacity-0 group-hover:opacity-100 transition-opacity">
              <span>Kalshi</span><ChevronRight className="w-3 h-3" />
            </div>
          </div>
        </div>
      </div>
    </motion.a>
  );
}

function RecordingCard({ game, index }: { game: Game; index: number }) {
  const colorA = TEAM_COLORS[game.teamAShort] ?? "#1a1a1a";
  const colorB = TEAM_COLORS[game.teamBShort] ?? "#2a2a2a";
  const signalColors = {
    BUY:  { bg: "bg-green-500/20", text: "text-green-400", border: "border-green-500/30" },
    SELL: { bg: "bg-red-500/20",   text: "text-red-400",   border: "border-red-500/30"   },
    HOLD: { bg: "bg-accent/20",    text: "text-accent",    border: "border-accent/30"     },
  };
  const sig = game.aiSignal ? signalColors[game.aiSignal] : null;
  const returnPositive = (game.kalshiReturn ?? 0) >= 0;

  return (
    <Link href={`/recordings/${game.id}`}>
      <motion.div variants={fadeUp} custom={index + 5} initial="hidden" whileInView="visible"
        viewport={{ once: true, amount: 0.2 }} whileHover={{ scale: 1.02, y: -3 }} className="block group cursor-pointer">
        {/* Shimmer border on hover */}
        <div className="relative rounded-xl p-[1px] transition-all duration-300 bg-surface-border group-hover:bg-gradient-to-br group-hover:from-accent/35 group-hover:via-surface-border group-hover:to-transparent">
          <div className="relative bg-surface rounded-[11px] overflow-hidden">
            {/* Thumbnail */}
            <div className="relative aspect-video flex items-center justify-center overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${colorA} 0%, #0d0d0d 48%, ${colorB} 100%)` }}>
              {/* Grain overlay */}
              <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", backgroundSize: "200px 200px" }} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
              {/* Scores */}
              <div className="relative z-10 flex items-center gap-6">
                {[{ short: game.teamAShort, score: game.scoreA, winning: (game.scoreA ?? 0) > (game.scoreB ?? 0) },
                  { short: game.teamBShort, score: game.scoreB, winning: (game.scoreB ?? 0) > (game.scoreA ?? 0) }].map((t, i) => (
                  <div key={i} className="text-center">
                    <div className="text-sm font-black text-white/85 tracking-widest">{t.short}</div>
                    <div className={`text-4xl font-black tabular-nums leading-none mt-0.5 drop-shadow-lg ${t.winning ? "text-white" : "text-white/25"}`}>{t.score}</div>
                  </div>
                ))}
              </div>
              {/* VS */}
              <div className="absolute text-white/15 text-[10px] font-bold tracking-widest z-10" style={{ left: "50%", top: "55%", transform: "translate(-50%,-50%)" }}>VS</div>
              {/* FINAL badge */}
              <div className="absolute top-2.5 right-2.5 text-[9px] font-bold bg-black/55 backdrop-blur-sm text-white/45 rounded px-2 py-0.5 tracking-widest">FINAL</div>
              {/* Signal badge */}
              {sig && game.aiSignal && (
                <div className={`absolute top-2.5 left-2.5 flex items-center gap-1 text-[9px] font-bold border rounded px-2 py-0.5 backdrop-blur-sm ${sig.bg} ${sig.text} ${sig.border}`}>
                  <Zap className="w-2.5 h-2.5" />{game.aiSignal}
                </div>
              )}
              {/* Hover play */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div className="w-11 h-11 rounded-full bg-black/50 backdrop-blur-sm border border-white/15 flex items-center justify-center">
                  <Play className="w-4 h-4 text-white ml-0.5" />
                </div>
              </div>
            </div>

            {/* Card body */}
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground/85 truncate">{game.teamA} vs {game.teamB}</span>
                <div className="flex items-center gap-1 text-[10px] text-accent opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                  <span>Analyze</span><ChevronRight className="w-3 h-3" />
                </div>
              </div>

              {/* 2-col stats: Confidence + Return only */}
              {game.aiConfidence !== undefined && (
                <div className="grid grid-cols-2 gap-0 border border-surface-border rounded-md overflow-hidden divide-x divide-surface-border">
                  <div className="py-2 text-center">
                    <div className="text-[11px] font-bold text-foreground">{game.aiConfidence}%</div>
                    <div className="text-[9px] text-muted/35 uppercase tracking-wide mt-0.5">Confidence</div>
                  </div>
                  <div className="py-2 text-center">
                    <div className={`text-[11px] font-bold ${returnPositive ? "text-green-400" : "text-red-400"}`}>
                      {returnPositive ? "+" : ""}{game.kalshiReturn?.toFixed(1)}%
                    </div>
                    <div className="text-[9px] text-muted/35 uppercase tracking-wide mt-0.5">Return</div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-[10px] text-muted/35">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>{game.date ?? "Feb 2026"}</span>
                </div>
                <span className="font-mono truncate max-w-[130px]">{game.kalshiTicker}</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  PAGE                                                               */
/* ------------------------------------------------------------------ */

export default function Home() {
  const router = useRouter();
  const [obsUrl, setObsUrl] = useState("");
  const [ticker, setTicker] = useState("");

  const liveGames = GAMES.filter((g) => g.status === "live");
  const upcomingGames = GAMES.filter((g) => g.status === "upcoming");
  const recordedGames = GAMES.filter((g) => g.status === "final");

  const avgConfidence = Math.round(
    recordedGames.reduce((s, g) => s + (g.aiConfidence ?? 0), 0) / (recordedGames.length || 1)
  );
  const avgReturn = parseFloat(
    (recordedGames.reduce((s, g) => s + (g.kalshiReturn ?? 0), 0) / (recordedGames.length || 1)).toFixed(1)
  );
  const signalCount = recordedGames.filter((g) => g.aiSignal === "BUY" || g.aiSignal === "SELL").length;

  const cConf = useCountUp(avgConfidence, 1400, 500);
  const cReturn10 = useCountUp(Math.round(Math.abs(avgReturn) * 10), 1600, 620);
  const cGames = useCountUp(recordedGames.length, 1300, 450);
  const cSignals = useCountUp(signalCount, 1200, 700);

  const displayReturn = `${avgReturn >= 0 ? "+" : "-"}${(cReturn10 / 10).toFixed(1)}%`;

  return (
    <div className="min-h-screen bg-background" style={{ backgroundImage: "radial-gradient(rgba(207,185,145,0.04) 1px, transparent 1px)", backgroundSize: "28px 28px" }}>
      <Navbar />

      {/* ── HERO ──────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute pointer-events-none" style={{ top: "-60px", left: "8%", width: "480px", height: "340px", borderRadius: "50%", background: "rgba(207,185,145,0.05)", filter: "blur(90px)" }} />
        <div className="absolute pointer-events-none" style={{ top: "40px", right: "5%", width: "320px", height: "280px", borderRadius: "50%", background: "rgba(232,98,26,0.04)", filter: "blur(80px)" }} />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-12 pb-10">
          <div className="flex flex-col lg:flex-row lg:items-center gap-8 lg:gap-12">

            {/* Left: Wordmark + stats */}
            <div className="flex-1 min-w-0">
              <motion.h1
                initial={{ opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
                className="text-[clamp(3.5rem,10vw,6rem)] font-black tracking-tighter leading-[0.86] select-none"
              >
                <span className="text-foreground block">SPORT</span>
                <span className="block text-accent" style={{ textShadow: "0 0 80px rgba(207,185,145,0.28), 0 0 30px rgba(207,185,145,0.12)" }}>
                  SIGNAL.
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="mt-4 text-sm text-muted/55 leading-relaxed max-w-xs"
              >
                AI-powered NCAA basketball signals for Kalshi prediction markets.
              </motion.p>

              {/* Inline stats row */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                className="mt-7 flex items-stretch gap-0 border border-surface-border rounded-xl overflow-hidden divide-x divide-surface-border"
                style={{ maxWidth: "360px" }}
              >
                {[
                  { val: `${cConf}%`, label: "Confidence", color: "text-accent" },
                  { val: displayReturn, label: "Avg Return", color: avgReturn >= 0 ? "text-green-400" : "text-red-400" },
                  { val: String(cGames), label: "Games", color: "text-foreground" },
                  { val: String(cSignals), label: "Signals", color: "text-foreground" },
                ].map((s, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, delay: 0.6 + i * 0.06 }}
                    className="flex-1 py-3 text-center bg-surface"
                  >
                    <div className={`text-base font-black tabular-nums font-mono ${s.color}`}>{s.val}</div>
                    <div className="text-[8px] text-muted/30 uppercase tracking-widest mt-0.5">{s.label}</div>
                  </motion.div>
                ))}
              </motion.div>
            </div>

            {/* Right: Basketball animation */}
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="shrink-0"
              style={{ width: "280px", height: "260px" }}
            >
              <BasketballScene />
            </motion.div>
          </div>
        </div>

        <TickerTape games={GAMES} />
      </div>

      {/* ── CONNECT STREAM ────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-2">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="rounded-2xl border border-surface-border bg-surface/60 p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Tv className="w-3.5 h-3.5 text-accent/60" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent/60">Connect & Track</span>
          </div>
          <div className="grid lg:grid-cols-2 gap-5">
            <StreamPanel obsUrl={obsUrl} setObsUrl={setObsUrl} onConnected={(url) => router.push(`/recordings/live?stream=${encodeURIComponent(url)}`)} />
            <TickerPanel ticker={ticker} setTicker={setTicker} onSubmit={() => {}} />
          </div>
        </motion.div>
      </div>

      {/* ── GAME LISTS ────────────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-12">

        {liveGames.length > 0 && (
          <motion.section variants={stagger} initial="hidden" animate="visible">
            <div className="flex items-center gap-2.5 mb-5">
              <span className="w-2 h-2 rounded-full bg-green-500 pulse-live" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-foreground/80">Live Games</h2>
              <span className="text-[10px] font-mono text-muted/35 ml-1">{liveGames.length}</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {liveGames.map((g, i) => <GameCard key={g.id} game={g} index={i} />)}
            </div>
          </motion.section>
        )}

        {upcomingGames.length > 0 && (
          <motion.section variants={stagger} initial="hidden" animate="visible">
            <div className="flex items-center gap-2.5 mb-5">
              <Clock className="w-3.5 h-3.5 text-muted/50" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-foreground/80">Upcoming Tonight</h2>
              <span className="text-[10px] font-mono text-muted/35 ml-1">{upcomingGames.length}</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {upcomingGames.map((g, i) => <GameCard key={g.id} game={g} index={i} />)}
            </div>
          </motion.section>
        )}

        {recordedGames.length > 0 && (
          <motion.section variants={stagger} initial="hidden" animate="visible">
            <div className="flex items-center gap-2.5 mb-5">
              <Zap className="w-3.5 h-3.5 text-accent/60" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-foreground/80">Recordings</h2>
              <span className="text-[10px] font-mono text-muted/35 ml-1">{recordedGames.length} analyzed</span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {recordedGames.map((g, i) => <RecordingCard key={g.id} game={g} index={i} />)}
            </div>
          </motion.section>
        )}
      </main>

      <footer className="border-t border-surface-border/50 py-6 text-center text-[11px] text-muted/25 font-mono">
        VisionSignal &copy; {new Date().getFullYear()} &middot; Powered by{" "}
        <a href="https://kalshi.com" target="_blank" rel="noopener noreferrer" className="text-accent/40 hover:text-accent transition-colors">Kalshi</a>
      </footer>
    </div>
  );
}
