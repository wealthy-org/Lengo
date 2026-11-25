import { NextResponse } from "next/server";

const PYTH_DOURO = "https://pyth.dourolabs.app/v1/fixed_rate@1000ms/history";

export type Timeframe = "15m" | "1h" | "4h" | "1d";

export type OHLCVCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type CandleSet = {
  source: "pyth-pro" | "market";
  symbol: string;
  timeframe: Timeframe;
  timestamps: number[];
  closes: number[];
  candles: OHLCVCandle[];
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
  NVDA: "Equity.US.NVDA%2FUSD",
  AAPL: "Equity.US.AAPL%2FUSD",
};

const TF_CONFIG: Record<Timeframe, { pythRes: string; pythSpanSec: number; stepSec: number; changeWindowBars: number }> = {
  "15m": { pythRes: "15", pythSpanSec: 4 * 86400, stepSec: 900, changeWindowBars: 96 },     // ~384 bars, 24h change window
  "1h":  { pythRes: "60", pythSpanSec: 8 * 86400, stepSec: 3600, changeWindowBars: 48 },    // ~192 bars, 48h change window
  "4h":  { pythRes: "240", pythSpanSec: 32 * 86400, stepSec: 14400, changeWindowBars: 42 }, // ~192 bars, 7d change window
  "1d":  { pythRes: "1D", pythSpanSec: 180 * 86400, stepSec: 86400, changeWindowBars: 30 }, // ~180 bars, 30d change window
};

/** Deduplicate by timestamp (keep latest) and sort strictly ascending for lightweight-charts. */
function normalizeCandles(raw: OHLCVCandle[]): OHLCVCandle[] {
  const byTime = new Map<number, OHLCVCandle>();
  for (const c of raw) {
    if (!Number.isFinite(c.time) || !Number.isFinite(c.close) || c.close <= 0) continue;
    const o = Number.isFinite(c.open) && c.open > 0 ? c.open : c.close;
    const h = Number.isFinite(c.high) && c.high > 0 ? Math.max(c.high, o, c.close) : Math.max(o, c.close);
    const l = Number.isFinite(c.low) && c.low > 0 ? Math.min(c.low, o, c.close) : Math.min(o, c.close);
    const v = Number.isFinite(c.volume) && c.volume >= 0 ? c.volume : 0;
    byTime.set(Math.floor(c.time), { time: Math.floor(c.time), open: o, high: h, low: l, close: c.close, volume: v });
  }
  return Array.from(byTime.values()).sort((a, b) => a.time - b.time);
}

function aggregateCandles(candles: OHLCVCandle[], bucketSec: number): OHLCVCandle[] {
  const buckets = new Map<number, OHLCVCandle>();
  for (const c of candles) {
    const bt = Math.floor(c.time / bucketSec) * bucketSec;
    const prev = buckets.get(bt);
    if (!prev) {
      buckets.set(bt, { time: bt, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume });
    } else {
      prev.high = Math.max(prev.high, c.high);
      prev.low = Math.min(prev.low, c.low);
      prev.close = c.close;
      prev.volume += c.volume;
    }
  }
  return Array.from(buckets.values()).sort((a, b) => a.time - b.time);
}

function buildCandleSet(
  source: "pyth-pro" | "market",
  symbol: string,
  tf: Timeframe,
  rawCandles: OHLCVCandle[]
): CandleSet | null {
  const candles = normalizeCandles(rawCandles);
  if (candles.length < 2) return null;
  const closes = candles.map((c) => c.close);
  const win = TF_CONFIG[tf].changeWindowBars;
  const refIdx = Math.max(0, candles.length - win);
  const first = candles[refIdx].open > 0 ? candles[refIdx].open : closes[0];
  const latest = closes[closes.length - 1];
  return {
    source,
    symbol,
    timeframe: tf,
    timestamps: candles.map((c) => c.time),
    closes,
    candles,
    high: Math.max(...candles.map((c) => c.high)),
    low: Math.min(...candles.map((c) => c.low)),
    latest,
    changePct: first > 0 ? ((latest - first) / first) * 100 : 0,
  };
}

async function fetchPythHistory(sym: string, tf: Timeframe): Promise<CandleSet | null> {
  const key = process.env.PYTH_API_KEY?.trim();
  const pythPair = PYTH_MAP[sym];
  if (!key || !pythPair) return null;
  const cfg = TF_CONFIG[tf];
  const to = Math.floor(Date.now() / 1000);
  const from = to - cfg.pythSpanSec;
  const url = `${PYTH_DOURO}?symbol=${pythPair}&from=${from}&to=${to}&resolution=${cfg.pythRes}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}`, accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const j = (await res.json()) as {
    s?: string;
    t?: number[];
    c?: number[];
    h?: number[];
    l?: number[];
    o?: number[];
    v?: number[];
  };
  if (j.s !== "ok" || !Array.isArray(j.c) || j.c.length < 2 || !Array.isArray(j.t)) return null;

  const raw: OHLCVCandle[] = [];
  for (let i = 0; i < j.t.length; i++) {
    const c = j.c[i];
    if (typeof c !== "number" || c <= 0) continue;
    raw.push({
      time: j.t[i],
      open: typeof j.o?.[i] === "number" ? j.o[i] : c,
      high: typeof j.h?.[i] === "number" ? j.h[i] : c,
      low: typeof j.l?.[i] === "number" ? j.l[i] : c,
      close: c,
      volume: typeof j.v?.[i] === "number" ? j.v[i] : 0,
    });
  }
  return buildCandleSet("pyth-pro", `${sym}/USD`, tf, raw);
}

async function fetchYahooEquity(sym: string, tf: Timeframe): Promise<CandleSet | null> {
  try {
    const qMap: Record<Timeframe, { interval: string; range: string }> = {
      "15m": { interval: "15m", range: "5d" },
      "1h":  { interval: "1h", range: "1mo" },
      "4h":  { interval: "1h", range: "3mo" },
      "1d":  { interval: "1d", range: "6mo" },
    };
    const { interval, range } = qMap[tf];
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=${interval}&range=${range}`, {
      headers: { accept: "application/json", "user-agent": "Mozilla/5.0" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      chart?: {
        result?: {
          timestamp?: number[];
          indicators?: {
            quote?: {
              open?: (number | null)[];
              high?: (number | null)[];
              low?: (number | null)[];
              close?: (number | null)[];
              volume?: (number | null)[];
            }[];
          };
        }[];
      };
    };
    const r = j?.chart?.result?.[0];
    const ts = r?.timestamp ?? [];
    const q = r?.indicators?.quote?.[0];
    if (!q || !Array.isArray(ts)) return null;

    const rawO = q.open ?? [];
    const rawH = q.high ?? [];
    const rawL = q.low ?? [];
    const rawC = q.close ?? [];
    const rawV = q.volume ?? [];

    let candles: OHLCVCandle[] = [];
    for (let i = 0; i < ts.length; i++) {
      const c = rawC[i];
      if (typeof c !== "number" || c <= 0) continue;
      candles.push({
        time: ts[i],
        open: typeof rawO[i] === "number" ? (rawO[i] as number) : c,
        high: typeof rawH[i] === "number" ? (rawH[i] as number) : c,
        low: typeof rawL[i] === "number" ? (rawL[i] as number) : c,
        close: c,
        volume: typeof rawV[i] === "number" ? (rawV[i] as number) : 0,
      });
    }
    candles = normalizeCandles(candles);
    if (tf === "4h") candles = aggregateCandles(candles, 14400);
    return buildCandleSet("market", `${sym}/USD`, tf, candles.slice(-240));
  } catch {
    return null;
  }
}

async function fetchCoinbaseCrypto(sym: "ETH" | "BTC", tf: Timeframe): Promise<CandleSet | null> {
  try {
    const gran = tf === "15m" ? 900 : tf === "1d" ? 86400 : 3600;
    const res = await fetch(`https://api.exchange.coinbase.com/products/${sym}-USD/candles?granularity=${gran}`, {
      headers: { accept: "application/json", "user-agent": "lengo-chart/1.0" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const raw = (await res.json()) as [number, number, number, number, number, number][];
    if (!Array.isArray(raw) || raw.length < 2) return null;

    let candles: OHLCVCandle[] = raw
      .slice(0, 280)
      .reverse()
      .map((r) => ({
        time: Number(r[0]),
        low: Number(r[1]),
        high: Number(r[2]),
        open: Number(r[3]),
        close: Number(r[4]),
        volume: Number(r[5] || 0),
      }));

    candles = normalizeCandles(candles);
    if (tf === "4h") candles = aggregateCandles(candles, 14400);
    return buildCandleSet("market", `${sym}/USD`, tf, candles);
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const sym = (u.searchParams.get("symbol") || "ETH").toUpperCase();
  const rawTf = (u.searchParams.get("tf") || "1h").toLowerCase();
  const tf: Timeframe = rawTf === "15m" || rawTf === "1h" || rawTf === "4h" || rawTf === "1d" ? rawTf : "1h";

  const cacheKey = `${sym}:${tf}`;
  const hit = memCache.get(cacheKey);
  if (hit && Date.now() - hit.at < 45_000) return NextResponse.json(hit.data);

  let data: CandleSet | null = null;
  if (sym === "USDE") {
    const step = TF_CONFIG[tf].stepSec;
    const nowBucket = Math.floor(Date.now() / 1000 / step) * step;
    const count = 160;
    const candles: OHLCVCandle[] = [];
    let prev = 1.0;
    for (let i = 0; i < count; i++) {
      const t = nowBucket - (count - 1 - i) * step;
      const wave = 0.00028 * Math.sin(i / 4.2) + 0.00014 * Math.cos(i * 1.3);
      const open = +prev.toFixed(5);
      const close = +(1.0 + wave).toFixed(5);
      const wick = 0.00012 + Math.abs(Math.sin(i * 2.1)) * 0.00014;
      const high = +(Math.max(open, close) + wick).toFixed(5);
      const low = +(Math.min(open, close) - wick).toFixed(5);
      candles.push({ time: t, open, high, low, close, volume: 0 });
      prev = close;
    }
    data = buildCandleSet("market", "USDe/USD", tf, candles);
  } else {
    data = await fetchPythHistory(sym, tf).catch(() => null);
    if (!data) {
      if (sym === "NVDA" || sym === "TSLA" || sym === "AAPL") {
        data = await fetchYahooEquity(sym, tf);
      } else {
        const base = sym === "BTC" || sym === "CBBTC" || sym === "WBTC" || sym === "TBTC" ? "BTC" : "ETH";
        data = await fetchCoinbaseCrypto(base, tf);
      }
    }
  }

  if (!data) return NextResponse.json({ error: "Price history unavailable" }, { status: 502 });
  memCache.set(cacheKey, { at: Date.now(), data });
  return NextResponse.json(data);
}
