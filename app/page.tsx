"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Tv,
  BarChart3,
  ArrowRight,
  Radio,
  Trophy,
  Clock,
  TrendingUp,
  ChevronRight,
  FolderOpen,
  Play,
  Calendar,
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
}

const GAMES: Game[] = [
  {
    id: "1",
    teamA: "Arizona Wildcats",
    teamB: "Kansas Jayhawks",
    teamAShort: "ARIZ",
    teamBShort: "KU",
    time: "FINAL",
    status: "final",
    scoreA: 67,
    scoreB: 72,
    spread: "KU -3.5",
    kalshiUrl:
      "https://kalshi.com/markets/kxncaambgame/mens-college-basketball-mens-game/kxncaambgame-26feb09arizku",
    kalshiTicker: "KXNCAAMBGAME-26FEB09ARIZKU",
    kalshiStartTs: 1770494460,
    kalshiEndTs: 1770697320,
    date: "Feb 9, 2026",
  },
  {
    id: "2",
    teamA: "Duke Blue Devils",
    teamB: "UNC Tar Heels",
    teamAShort: "DUKE",
    teamBShort: "UNC",
    time: "LIVE",
    status: "live",
    scoreA: 54,
    scoreB: 58,
    spread: "UNC -2.0",
    kalshiUrl:
      "https://kalshi.com/markets/kxncaambgame/mens-college-basketball-mens-game/kxncaambgame-26feb07dukeunc",
    kalshiTicker: "KXNCAAMBGAME-26FEB07DUKEUNC",
    kalshiStartTs: 0,
    kalshiEndTs: 0,
  },
  {
    id: "3",
    teamA: "Gonzaga Bulldogs",
    teamB: "UCLA Bruins",
    teamAShort: "GONZ",
    teamBShort: "UCLA",
    time: "7:00 PM ET",
    status: "upcoming",
    spread: "GONZ -5.5",
    kalshiUrl:
      "https://kalshi.com/markets/kxncaambgame/mens-college-basketball-mens-game/kxncaambgame-26feb07gonzucla",
    kalshiTicker: "KXNCAAMBGAME-26FEB07GONZUCLA",
    kalshiStartTs: 0,
    kalshiEndTs: 0,
  },
  {
    id: "4",
    teamA: "Kentucky Wildcats",
    teamB: "Tennessee Vols",
    teamAShort: "UK",
    teamBShort: "TENN",
    time: "8:00 PM ET",
    status: "upcoming",
    spread: "TENN -1.5",
    kalshiUrl:
      "https://kalshi.com/markets/kxncaambgame/mens-college-basketball-mens-game/kxncaambgame-26feb08uktenn",
    kalshiTicker: "KXNCAAMBGAME-26FEB08UKTENN",
    kalshiStartTs: 0,
    kalshiEndTs: 0,
  },
  {
    id: "5",
    teamA: "Houston Cougars",
    teamB: "Baylor Bears",
    teamAShort: "HOU",
    teamBShort: "BAY",
    time: "8:30 PM ET",
    status: "upcoming",
    spread: "HOU -4.0",
    kalshiUrl:
      "https://kalshi.com/markets/kxncaambgame/mens-college-basketball-mens-game/kxncaambgame-26feb08houbay",
    kalshiTicker: "KXNCAAMBGAME-26FEB08HOUBAY",
    kalshiStartTs: 0,
    kalshiEndTs: 0,
  },
  {
    id: "6",
    teamA: "Purdue Boilermakers",
    teamB: "Michigan St Spartans",
    teamAShort: "PUR",
    teamBShort: "MSU",
    time: "9:00 PM ET",
    status: "upcoming",
    spread: "PUR -6.5",
    kalshiUrl:
      "https://kalshi.com/markets/kxncaambgame/mens-college-basketball-mens-game/kxncaambgame-26feb09purmsu",
    kalshiTicker: "KXNCAAMBGAME-26FEB09PURMSU",
    kalshiStartTs: 0,
    kalshiEndTs: 0,
  },
  {
    id: "7",
    teamA: "Auburn Tigers",
    teamB: "Alabama Crimson Tide",
    teamAShort: "AUB",
    teamBShort: "BAMA",
    time: "FINAL",
    status: "final",
    scoreA: 81,
    scoreB: 76,
    spread: "AUB -2.5",
    kalshiUrl:
      "https://kalshi.com/markets/kxncaambgame/mens-college-basketball-mens-game/kxncaambgame-26feb06aubbama",
    kalshiTicker: "KXNCAAMBGAME-26FEB06AUBBAMA",
    kalshiStartTs: 0,
    kalshiEndTs: 0,
    date: "Feb 26, 2026",
  },
  {
    id: "8",
    teamA: "UConn Huskies",
    teamB: "Villanova Wildcats",
    teamAShort: "UCONN",
    teamBShort: "NOVA",
    time: "FINAL",
    status: "final",
    scoreA: 69,
    scoreB: 63,
    spread: "UCONN -7.0",
    kalshiUrl:
      "https://kalshi.com/markets/kxncaambgame/mens-college-basketball-mens-game/kxncaambgame-26feb05uconnnova",
    kalshiTicker: "KXNCAAMBGAME-26FEB05UCONNNOVA",
    kalshiStartTs: 0,
    kalshiEndTs: 0,
    date: "Feb 26, 2026",
  },
];

/* ------------------------------------------------------------------ */
/*  ANIMATION VARIANTS                                                 */
/* ------------------------------------------------------------------ */

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.06,
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  }),
};

const stagger = {
  visible: { transition: { staggerChildren: 0.06 } },
};

/* ------------------------------------------------------------------ */
/*  COMPONENTS                                                         */
/* ------------------------------------------------------------------ */

function Navbar() {
  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 border-b border-surface-border bg-background/80 backdrop-blur-xl"
    >
      <div className="flex items-center gap-3">
        <span className="text-xl font-bold tracking-tight">
          Sport<span className="text-accent">Signal</span>
        </span>
      </div>
      <div className="flex items-center gap-4 text-sm text-muted">
        <span className="hidden sm:inline">NCAA Basketball</span>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-md bg-green-500 pulse-live" />
          <span className="text-green-400 font-medium">
            {GAMES.filter((g) => g.status === "live").length} Live
          </span>
        </div>
      </div>
    </motion.nav>
  );
}

function StreamPanel({
  obsUrl,
  setObsUrl,
}: {
  obsUrl: string;
  setObsUrl: (v: string) => void;
}) {
  return (
    <motion.section
      variants={fadeUp}
      custom={0}
      initial="hidden"
      animate="visible"
      className="space-y-4"
    >
      <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-accent">
        <Tv className="w-4 h-4" />
        Livestream
      </div>

      {/* Stream embed area */}
      <div className="relative rounded-md overflow-hidden border border-surface-border glow-gold">
        <div className="animated-border p-[1px] rounded-md">
          <div className="bg-surface rounded-md aspect-video flex flex-col items-center justify-center gap-3">
            {obsUrl ? (
              <iframe
                src={obsUrl}
                className="w-full h-full rounded-md"
                allowFullScreen
                allow="autoplay"
              />
            ) : (
              <>
                <Radio className="w-10 h-10 text-muted" />
                <p className="text-muted text-sm">
                  Paste your OBS stream URL below
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* OBS URL input */}
      <div className="relative group">
        <input
          type="text"
          placeholder="OBS Livestream URL (e.g. rtmp://...)"
          value={obsUrl}
          onChange={(e) => setObsUrl(e.target.value)}
          className="w-full bg-surface border border-surface-border rounded-md px-4 py-3 pl-10 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
        />
        <Tv className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-accent transition-colors" />
      </div>
    </motion.section>
  );
}

function TickerPanel({
  ticker,
  setTicker,
  onSubmit,
}: {
  ticker: string;
  setTicker: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <motion.section
      variants={fadeUp}
      custom={1}
      initial="hidden"
      animate="visible"
      className="space-y-4"
    >
      <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-accent">
        <BarChart3 className="w-4 h-4" />
        Kalshi Market Ticker
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 group">
          <input
            type="text"
            placeholder="Enter Kalshi Ticker ID (e.g. KXNCAAMBGAME-26FEB09ARIZKU)"
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSubmit()}
            className="w-full bg-surface border border-surface-border rounded-md px-4 py-3 pl-10 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all font-mono"
          />
          <TrendingUp className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-accent transition-colors" />
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onSubmit}
          className="bg-accent hover:bg-accent-light text-black font-bold px-6 py-3 rounded-md flex items-center gap-2 transition-colors shrink-0"
        >
          <span className="hidden sm:inline">Track</span>
          <ArrowRight className="w-4 h-4" />
        </motion.button>
      </div>

      {/* Active ticker display */}
      <AnimatePresence>
        {ticker && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-surface-light border border-surface-border rounded-md p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-md bg-accent pulse-live" />
                <span className="font-mono text-sm text-accent">
                  {ticker.toUpperCase()}
                </span>
              </div>
              <span className="text-xs text-muted">Tracking market…</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

function StatusBadge({ status }: { status: Game["status"] }) {
  if (status === "live") {
    return (
      <span className="flex items-center gap-1.5 text-xs font-bold text-green-400">
        <span className="w-1.5 h-1.5 rounded-md bg-green-400 pulse-live" />
        LIVE
      </span>
    );
  }
  if (status === "final") {
    return <span className="text-xs font-bold text-muted">FINAL</span>;
  }
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted">
      <Clock className="w-3 h-3" />
    </span>
  );
}

function GameCard({ game, index }: { game: Game; index: number }) {
  return (
    <motion.a
      href={game.kalshiUrl}
      target="_blank"
      rel="noopener noreferrer"
      variants={fadeUp}
      custom={index + 3}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      whileHover={{ scale: 1.01, y: -2 }}
      className="block group"
    >
      <div
        className={`relative bg-surface border rounded-md overflow-hidden transition-all duration-300 ${
          game.status === "live"
            ? "border-accent/30 glow-gold"
            : "border-surface-border hover:border-surface-border/80"
        } hover:glow-gold`}
      >
        {/* Thumbnail/header band */}
        <div
          className={`h-1.5 w-full ${
            game.status === "live"
              ? "animated-border"
              : game.status === "final"
                ? "bg-muted/30"
                : "bg-surface-border"
          }`}
        />

        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-3.5 h-3.5 text-accent" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted">
                NCAA Men&apos;s Basketball
              </span>
            </div>
            <StatusBadge status={game.status} />
          </div>

          {/* Matchup */}
          <div className="flex items-center justify-between">
            <div className="flex-1 space-y-3">
              {/* Team A */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-sm bg-surface-light border border-surface-border flex items-center justify-center text-[10px] font-bold text-foreground">
                    {game.teamAShort}
                  </div>
                  <span className="font-semibold text-sm">{game.teamA}</span>
                </div>
                {game.scoreA !== undefined && (
                  <span
                    className={`font-mono font-bold text-lg tabular-nums ${
                      game.scoreA > (game.scoreB ?? 0)
                        ? "text-foreground"
                        : "text-muted"
                    }`}
                  >
                    {game.scoreA}
                  </span>
                )}
              </div>

              {/* Team B */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-sm bg-surface-light border border-surface-border flex items-center justify-center text-[10px] font-bold text-foreground">
                    {game.teamBShort}
                  </div>
                  <span className="font-semibold text-sm">{game.teamB}</span>
                </div>
                {game.scoreB !== undefined && (
                  <span
                    className={`font-mono font-bold text-lg tabular-nums ${
                      game.scoreB > (game.scoreA ?? 0)
                        ? "text-foreground"
                        : "text-muted"
                    }`}
                  >
                    {game.scoreB}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-4 pt-3 border-t border-surface-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              {game.spread && (
                <span className="text-xs bg-surface-light border border-surface-border rounded-md px-2 py-1 font-mono text-muted">
                  {game.spread}
                </span>
              )}
              {game.status !== "live" && game.status !== "final" && (
                <span className="text-xs text-muted">{game.time}</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-accent opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="font-medium">View on Kalshi</span>
              <ChevronRight className="w-3 h-3" />
            </div>
          </div>

          {/* Ticker label */}
          <div className="mt-2">
            <span className="text-[10px] font-mono text-muted/60 truncate block">
              {game.kalshiTicker}
            </span>
          </div>
        </div>
      </div>
    </motion.a>
  );
}

function RecordingCard({ game, index }: { game: Game; index: number }) {
  return (
    <Link href={`/recordings/${game.id}`}>
      <motion.div
        variants={fadeUp}
        custom={index + 5}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        whileHover={{ scale: 1.01, y: -2 }}
        className="block group cursor-pointer"
      >
        <div className="relative bg-surface border border-surface-border rounded-md overflow-hidden transition-all duration-300 hover:border-accent/20 hover:glow-gold">
          {/* Thumbnail area */}
          <div className="relative aspect-video bg-surface-light flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent" />
            <div className="flex flex-col items-center gap-2 text-muted">
              <Play className="w-8 h-8 opacity-40 group-hover:opacity-80 group-hover:text-accent transition-all" />
            </div>
            {/* Score overlay */}
            <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold bg-black/60 backdrop-blur-sm rounded-md px-2 py-1">
                  {game.teamAShort} {game.scoreA}
                </span>
                <span className="text-[10px] text-muted">vs</span>
                <span className="text-xs font-bold bg-black/60 backdrop-blur-sm rounded-md px-2 py-1">
                  {game.teamBShort} {game.scoreB}
                </span>
              </div>
              <span className="text-[10px] font-bold bg-accent/80 backdrop-blur-sm text-black rounded-md px-2 py-1">
                FINAL
              </span>
            </div>
          </div>

          <div className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Trophy className="w-3 h-3 text-accent" />
              <span className="text-xs font-semibold">
                {game.teamA} vs {game.teamB}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[10px] text-muted">
                <Calendar className="w-3 h-3" />
                <span>{game.date ?? "Feb 26, 2026"}</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="font-medium">View Analytics</span>
                <ChevronRight className="w-3 h-3" />
              </div>
            </div>
            <span className="text-[10px] font-mono text-muted/50 block truncate">
              {game.kalshiTicker}
            </span>
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
  const [obsUrl, setObsUrl] = useState("");
  const [ticker, setTicker] = useState("");

  const liveGames = GAMES.filter((g) => g.status === "live");
  const upcomingGames = GAMES.filter((g) => g.status === "upcoming");
  const recordedGames = GAMES.filter((g) => g.status === "final");

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-10">
        {/* Hero tagline */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center space-y-2"
        >
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Track. Stream. <span className="text-accent">Signal.</span>
          </h1>
          <p className="text-muted text-sm sm:text-base max-w-lg mx-auto">
            Live NCAA basketball markets powered by Kalshi — stream games, track
            tickers, and stay ahead of the action.
          </p>
        </motion.div>

        {/* Stream + Ticker panels */}
        <div className="grid lg:grid-cols-2 gap-6">
          <StreamPanel obsUrl={obsUrl} setObsUrl={setObsUrl} />
          <TickerPanel
            ticker={ticker}
            setTicker={setTicker}
            onSubmit={() => {}}
          />
        </div>

        {/* Divider */}
        <div className="border-t border-surface-border" />

        {/* Game lists */}
        <motion.div variants={stagger} initial="hidden" animate="visible">
          {/* Live */}
          {liveGames.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-2 rounded-md bg-green-500 pulse-live" />
                <h2 className="text-lg font-bold">Live Games</h2>
                <span className="text-xs text-muted ml-1">
                  ({liveGames.length})
                </span>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {liveGames.map((g, i) => (
                  <GameCard key={g.id} game={g} index={i} />
                ))}
              </div>
            </section>
          )}

          {/* Upcoming */}
          {upcomingGames.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-muted" />
                <h2 className="text-lg font-bold">Upcoming</h2>
                <span className="text-xs text-muted ml-1">
                  ({upcomingGames.length})
                </span>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {upcomingGames.map((g, i) => (
                  <GameCard key={g.id} game={g} index={i} />
                ))}
              </div>
            </section>
          )}

        </motion.div>

        {/* Divider */}
        <div className="border-t border-surface-border" />

        {/* Recordings */}
        {recordedGames.length > 0 && (
          <motion.section
            variants={stagger}
            initial="hidden"
            animate="visible"
          >
            <div className="flex items-center gap-2 mb-4">
              <FolderOpen className="w-4 h-4 text-accent" />
              <h2 className="text-lg font-bold">Recordings</h2>
              <span className="text-xs text-muted ml-1">
                ({recordedGames.length})
              </span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {recordedGames.map((g, i) => (
                <RecordingCard key={g.id} game={g} index={i} />
              ))}
            </div>
          </motion.section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-surface-border py-6 text-center text-xs text-muted">
        <span>
          SportSignal &copy; {new Date().getFullYear()} &middot; Powered by{" "}
          <a
            href="https://kalshi.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            Kalshi
          </a>
        </span>
      </footer>
    </div>
  );
}
