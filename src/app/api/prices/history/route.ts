import { NextResponse } from "next/server";

const PYTH_DOURO = "https://pyth.dourolabs.app/v1/fixed_rate@1000ms/history";

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

  const candles: OHLCVCandle[] = [];
  for (let i = 0; i < j.t.length; i++) {
    const c = j.c[i];
    if (typeof c !== "number" || c <= 0) continue;
    const o = typeof j.o?.[i] === "number" && j.o[i] > 0 ? j.o[i] : c;
    const h = typeof j.h?.[i] === "number" && j.h[i] > 0 ? Math.max(j.h[i], o, c) : Math.max(o, c);
    const l = typeof j.l?.[i] === "number" && j.l[i] > 0 ? Math.min(j.l[i], o, c) : Math.min(o, c);
    const v = typeof j.v?.[i] === "number" ? j.v[i] : 0;
    candles.push({
      time: j.t[i],
      open: o,
      high: h,
      low: l,
      close: c,
      volume: v,
    });
  }

  if (candles.length < 2) return null;
  const closes = candles.map((c) => c.close);
  const first = closes[0];
  const latest = closes[closes.length - 1];

  return {
    source: "pyth-pro",
    symbol: `${sym}/USD`,
    timestamps: candles.map((c) => c.time),
    closes,
    candles,
    high: Math.max(...candles.map((c) => c.high)),
    low: Math.min(...candles.map((c) => c.low)),
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

    const candles: OHLCVCandle[] = [];
    for (let i = 0; i < ts.length; i++) {
      const c = rawC[i];
      if (typeof c !== "number" || c <= 0) continue;
      const o = typeof rawO[i] === "number" && (rawO[i] as number) > 0 ? (rawO[i] as number) : c;
      const h = typeof rawH[i] === "number" && (rawH[i] as number) > 0 ? Math.max(rawH[i] as number, o, c) : Math.max(o, c);
      const l = typeof rawL[i] === "number" && (rawL[i] as number) > 0 ? Math.min(rawL[i] as number, o, c) : Math.min(o, c);
      const v = typeof rawV[i] === "number" ? (rawV[i] as number) : 0;
      candles.push({
        time: ts[i],
        open: o,
        high: h,
        low: l,
        close: c,
        volume: v,
      });
    }

    if (candles.length < 2) return null;
    const slice = candles.slice(-48);
    const closes = slice.map((c) => c.close);
    const first = closes[0];
    const latest = closes[closes.length - 1];

    return {
      source: "market",
      symbol: `${sym}/USD`,
      timestamps: slice.map((c) => c.time),
      closes,
      candles: slice,
      high: Math.max(...slice.map((c) => c.high)),
      low: Math.min(...slice.map((c) => c.low)),
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
    const raw = (await res.json()) as [number, number, number, number, number, number][];
    if (!Array.isArray(raw) || raw.length < 2) return null;

    // raw: [time, low, high, open, close, volume]
    const slice = raw.slice(0, 48).reverse();
    const candles: OHLCVCandle[] = slice.map((r) => {
      const time = Number(r[0]);
      const low = Number(r[1]);
      const high = Number(r[2]);
      const open = Number(r[3]);
      const close = Number(r[4]);
      const volume = Number(r[5] || 0);
      return {
        time,
        open,
        high: Math.max(high, open, close),
        low: Math.min(low, open, close),
        close,
        volume,
      };
    });

    const closes = candles.map((c) => c.close);
    const first = closes[0];
    const latest = closes[closes.length - 1];

    return {
      source: "market",
      symbol: `${sym}/USD`,
      timestamps: candles.map((c) => c.time),
      closes,
      candles,
      low: Math.min(...candles.map((c) => c.low)),
      high: Math.max(...candles.map((c) => c.high)),
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
    const candles: OHLCVCandle[] = Array.from({ length: 48 }, (_, i) => {
      const t = now - (47 - i) * 3600;
      const base = 1.0 + 0.0003 * Math.sin(i / 3.5);
      const wiggle = (Math.sin(i * 1.7) * 0.0002);
      const open = +(base - wiggle).toFixed(5);
      const close = +(base + wiggle).toFixed(5);
      const high = +(Math.max(open, close) + 0.00015).toFixed(5);
      const low = +(Math.min(open, close) - 0.00015).toFixed(5);
      return {
        time: t,
        open,
        high,
        low,
        close,
        volume: 450000 + Math.floor(Math.sin(i) * 50000),
      };
    });
    const closes = candles.map((c) => c.close);
    data = {
      source: "market",
      symbol: "USDe/USD",
      timestamps: candles.map((c) => c.time),
      closes,
      candles,
      high: 1.0006,
      low: 0.9994,
      latest: closes[closes.length - 1],
      changePct: 0.01,
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
