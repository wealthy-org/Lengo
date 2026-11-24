import { NextResponse } from "next/server";

const PYTH_DOURO = "https://pyth.dourolabs.app/v1/fixed_rate@1000ms/history";

type CandleSet = {
  source: "pyth-pro" | "coinbase";
  symbol: string;
  timestamps: number[];
  closes: number[];
  high: number;
  low: number;
  latest: number;
  changePct: number;
};

const memCache = new Map<string, { at: number; data: CandleSet }>();

async function fetchPythHistory(sym: "ETH" | "BTC"): Promise<CandleSet | null> {
  const key = process.env.PYTH_API_KEY?.trim();
  if (!key) return null;
  const to = Math.floor(Date.now() / 1000);
  const from = to - 48 * 3600; // last 48 hours, 60-minute candles
  const pair = sym === "ETH" ? "Crypto.ETH%2FUSD" : "Crypto.BTC%2FUSD";
  const url = `${PYTH_DOURO}?symbol=${pair}&from=${from}&to=${to}&resolution=60`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}`, accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { s?: string; t?: number[]; c?: number[]; h?: number[]; l?: number[] };
  if (j.s !== "ok" || !Array.isArray(j.c) || j.c.length < 2 || !Array.isArray(j.t)) return null;

  const closes = j.c;
  const highs = Array.isArray(j.h) && j.h.length ? j.h : closes;
  const lows = Array.isArray(j.l) && j.l.length ? j.l : closes;
  const first = closes[0];
  const latest = closes[closes.length - 1];
  return {
    source: "pyth-pro",
    symbol: `${sym}/USD`,
    timestamps: j.t,
    closes,
    high: Math.max(...highs),
    low: Math.min(...lows),
    latest,
    changePct: first > 0 ? ((latest - first) / first) * 100 : 0,
  };
}

async function fetchCoinbaseFallback(sym: "ETH" | "BTC"): Promise<CandleSet | null> {
  try {
    const res = await fetch(`https://api.exchange.coinbase.com/products/${sym}-USD/candles?granularity=3600`, {
      headers: { accept: "application/json", "user-agent": "lengo-chart/1.0" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const raw = (await res.json()) as [number, number, number, number, number][];
    if (!Array.isArray(raw) || raw.length < 2) return null;
    const slice = raw.slice(0, 48).reverse(); // [time, low, high, open, close]
    const closes = slice.map((r) => Number(r[4]));
    const first = closes[0];
    const latest = closes[closes.length - 1];
    return {
      source: "coinbase",
      symbol: `${sym}/USD`,
      timestamps: slice.map((r) => Number(r[0])),
      closes,
      low: Math.min(...slice.map((r) => Number(r[1]))),
      high: Math.max(...slice.map((r) => Number(r[2]))),
      latest,
      changePct: first > 0 ? ((latest - first) / first) * 100 : 0,
    };
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const symParam = new URL(req.url).searchParams.get("symbol")?.toUpperCase();
  const sym: "ETH" | "BTC" = symParam === "BTC" ? "BTC" : "ETH";

  const hit = memCache.get(sym);
  if (hit && Date.now() - hit.at < 60_000) {
    return NextResponse.json(hit.data);
  }

  const data = (await fetchPythHistory(sym).catch(() => null)) ?? (await fetchCoinbaseFallback(sym));
  if (!data) {
    return NextResponse.json({ error: "Price history unavailable" }, { status: 502 });
  }
  memCache.set(sym, { at: Date.now(), data });
  return NextResponse.json(data);
}
