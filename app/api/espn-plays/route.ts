import { NextRequest, NextResponse } from "next/server";

const ESPN_BASE =
  "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball";

export interface EspnPlay {
  wallclockTs: number; // unix seconds (UTC)
  period: number;      // 1 = 1st half, 2 = 2nd half, 3+ = OT
  clockSecs: number;   // seconds REMAINING in the period
  homeScore: number;
  awayScore: number;
  text: string;        // play description
  scoringPlay: boolean;
}

export async function GET(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get("event");
  if (!eventId) {
    return NextResponse.json({ error: "event param required" }, { status: 400 });
  }

  const url = `${ESPN_BASE}/summary?event=${encodeURIComponent(eventId)}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      // Cache for 2 minutes — plays are historical for finished games
      next: { revalidate: 120 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `ESPN returned ${res.status}` },
        { status: res.status }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawPlays: any[] = json?.plays ?? [];

    // Parse "MM:SS" displayValue into total seconds remaining
    function parseClockDisplay(display: string): number {
      const parts = display.split(":").map(Number);
      if (parts.length === 2) return (parts[0] || 0) * 60 + (parts[1] || 0);
      return 0;
    }

    const plays: EspnPlay[] = rawPlays
      .filter((p) => p.wallclock && p.clock?.displayValue && p.period?.number)
      .map((p) => ({
        wallclockTs: Math.floor(new Date(p.wallclock).getTime() / 1000),
        period: Number(p.period.number),
        clockSecs: parseClockDisplay(p.clock.displayValue),
        homeScore: Number(p.homeScore ?? 0),
        awayScore: Number(p.awayScore ?? 0),
        text: String(p.text ?? ""),
        scoringPlay: Boolean(p.scoringPlay),
      }))
      // Deduplicate: keep one entry per (period, clockSecs) pair
      .filter((p, i, arr) =>
        arr.findIndex((q) => q.period === p.period && q.clockSecs === p.clockSecs) === i
      )
      // Sort chronologically
      .sort((a, b) => a.wallclockTs - b.wallclockTs);

    return NextResponse.json({ plays }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "fetch failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
