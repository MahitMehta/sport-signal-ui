import { NextRequest, NextResponse } from "next/server";

const KALSHI_V1 = "https://api.elections.kalshi.com/v1";

// Hard-coded event ticker → { seriesTicker, marketId (UUID) }
const MARKET_MAP: Record<string, { series: string; uuid: string }> = {
  "KXNCAAMBGAME-26FEB09ARIZKU": { series: "KXNCAAMBGAME", uuid: "612064a2-cd77-4ce0-a253-cd8afa995a56" },
  "KXNCAAMBGAME-26FEB07DUKEUNC": { series: "KXNCAAMBGAME", uuid: "" },
  "KXNCAAMBGAME-26FEB07GONZUCLA": { series: "KXNCAAMBGAME", uuid: "" },
  "KXNCAAMBGAME-26FEB08UKTENN": { series: "KXNCAAMBGAME", uuid: "" },
  "KXNCAAMBGAME-26FEB08HOUBAY": { series: "KXNCAAMBGAME", uuid: "" },
  "KXNCAAMBGAME-26FEB09PURMSU": { series: "KXNCAAMBGAME", uuid: "" },
  "KXNCAAMBGAME-26FEB06AUBBAMA": { series: "KXNCAAMBGAME", uuid: "" },
  "KXNCAAMBGAME-26FEB05UCONNNOVA": { series: "KXNCAAMBGAME", uuid: "" },
};

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const eventTicker = searchParams.get("ticker");
  const startTs = searchParams.get("start_ts");
  const endTs = searchParams.get("end_ts");
  const interval = searchParams.get("interval") || "1";

  if (!eventTicker) {
    return NextResponse.json({ error: "ticker required" }, { status: 400 });
  }

  if (!startTs || !endTs) {
    return NextResponse.json({ error: "start_ts and end_ts required" }, { status: 400 });
  }

  const mapped = MARKET_MAP[eventTicker.toUpperCase()];
  if (!mapped || !mapped.uuid) {
    return NextResponse.json(
      { error: `No UUID mapping for ticker: ${eventTicker}` },
      { status: 404 }
    );
  }

  const { series, uuid } = mapped;

  // Fetch forecast history via v1 endpoint
  const forecastUrl =
    `${KALSHI_V1}/series/${series}/markets/${uuid}/forecast_history` +
    `?start_ts=${startTs}&end_ts=${endTs}&period_interval=${interval}&candlestick_function=mean_price`;

  console.log("Fetching Kalshi forecast history:", forecastUrl);

  try {
    const forecastRes = await fetch(forecastUrl, {
      headers: { Accept: "application/json" },
      next: { revalidate: 30 },
    });

    if (!forecastRes.ok) {
      const text = await forecastRes.text();
      return NextResponse.json(
        { error: `Kalshi forecast_history ${forecastRes.status}`, detail: text },
        { status: forecastRes.status }
      );
    }

    const data = await forecastRes.json();

    return NextResponse.json({
      ...data,
      seriesTicker: series,
      marketId: uuid,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "fetch failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
