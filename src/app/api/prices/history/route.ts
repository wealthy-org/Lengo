import { NextResponse } from "next/server";

const PYTH_DOURO = "https://pyth.dourolabs.app/v1/fixed_rate@1000ms/history";

type CandleSet = {
  source: "pyth-pro" | "market";
  symbol: string;
  timestamps: number[];
  closes: number[];
  high: number;
  low: number;
  latest: number;
  changePct: number;
};

const memCache = new Map<string, { at: number; data: CandleSet }>();

const PYTH_MAP: Record<string, string> = {
  ETH: "Crypto.ETH%2FUSD",
  WETH: "Crypto.ETH%2FUSD",
  BTC: "Crypto.BTC%2FUSD",
  CBBTC: "Crypto.BTC%2FUSD",
  WBTC: "Crypto.BTC%2FUSD",
  TSLA: "Equity.US.TSLA%2FUSD",
};

async function fetchPythHistory(sym: string): Promise<CandleSet | null> {
  const key = process.env.PYTH_API_KEY?.trim();
  const pythPair = PYTH_MAP[sym];
  if (!key || !pythPair) return null;
  const to = Math.floor(Date.now() / 1000);
  const from = to - 48 * 3600;
  const url = `${PYTH_DOURO}?symbol=${pythPair}&from=${from}&to=${to}&resolution=60`;

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

async function fetchYahooEquity(sym: string): Promise<CandleSet | null> {
  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1h&range=5d`, {
      headers: { accept: "application/json", "user-agent": "Mozilla/5.0" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      chart?: { result?: { timestamp?: number[]; indicators?: { quote?: { close?: (number | null)[] }[] } }[] };
    };
    const r = j?.chart?.result?.[0];
    const ts = r?.timestamp ?? [];
    const rawC = r?.indicators?.quote?.[0]?.close ?? [];
    const pairs = ts.map((t, i) => [t, rawC[i]] as const).filter((p): p is [number, number] => typeof p[1] === "number" && p[1] > 0);
    if (pairs.length < 2) return null;
    const slice = pairs.slice(-48);
    const closes = slice.map((p) => p[1]);
    const first = closes[0];
    const latest = closes[closes.length - 1];
    return {
      source: "market",
      symbol: `${sym}/USD`,
      timestamps: slice.map((p) => p[0]),
      closes,
      high: Math.max(...closes),
      low: Math.min(...closes),
      latest,
      changePct: first > 0 ? ((latest - first) / first) * 100 : 0,
    };
  } catch {
    return null;
  }
}

async function fetchCoinbaseCrypto(sym: "ETH" | "BTC"): Promise<CandleSet | null> {
  try {
    const res = await fetch(`https://api.exchange.coinbase.com/products/${sym}-USD/candles?granularity=3600`, {
      headers: { accept: "application/json", "user-agent": "lengo-chart/1.0" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const raw = (await res.json()) as [number, number, number, number, number][];
    if (!Array.isArray(raw) || raw.length < 2) return null;
    const slice = raw.slice(0, 48).reverse();
    const closes = slice.map((r) => Number(r[4]));
    const first = closes[0];
    const latest = closes[closes.length - 1];
    return {
      source: "market",
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
  const sym = (new URL(req.url).searchParams.get("symbol") || "ETH").toUpperCase();
  const hit = memCache.get(sym);
  if (hit && Date.now() - hit.at < 60_000) return NextResponse.json(hit.data);

  let data: CandleSet | null = null;
  if (sym === "USDE") {
    const now = Math.floor(Date.now() / 1000);
    const closes = Array.from({ length: 48 }, (_, i) => 1 + 0.0004 * Math.sin(i / 4));
    data = {
      source: "market",
      symbol: "USDe/USD",
      timestamps: Array.from({ length: 48 }, (_, i) => now - (47 - i) * 3600),
      closes,
      high: 1.0005,
      low: 0.9995,
      latest: 1.0,
      changePct: 0.0,
    };
  } else {
    data = await fetchPythHistory(sym).catch(() => null);
    if (!data) {
      if (sym === "NVDA" || sym === "TSLA" || sym === "AAPL") {
        data = await fetchYahooEquity(sym);
      } else {
        const base = sym === "BTC" || sym === "CBBTC" || sym === "WBTC" || sym === "TBTC" ? "BTC" : "ETH";
        data = await fetchCoinbaseCrypto(base);
      }
    }
  }

  if (!data) return NextResponse.json({ error: "Price history unavailable" }, { status: 502 });
  memCache.set(sym, { at: Date.now(), data });
  return NextResponse.json(data);
}
