import { parseUnits } from "viem";

export type AssetSymbol = "ETH" | "WETH" | "BTC" | "tBTC" | "USDG" | "USDC" | "tUSDC";

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

async function fetchJson(url: string, timeoutMs = 4500): Promise<unknown> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { accept: "application/json", "user-agent": "lengo-oracle-keeper/1.0" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(id);
  }
}

async function fetchCoinbaseSpot(base: "ETH" | "BTC"): Promise<number | null> {
  try {
    const j = (await fetchJson(`https://api.coinbase.com/v2/prices/${base}-USD/spot`)) as { data?: { amount?: string } };
    const p = Number(j?.data?.amount);
    return Number.isFinite(p) && p > 0 ? p : null;
  } catch {
    return null;
  }
}

async function fetchKrakenSpot(base: "ETH" | "BTC"): Promise<number | null> {
  try {
    const pair = base === "ETH" ? "XETHZUSD" : "XXBTZUSD";
    const j = (await fetchJson(`https://api.kraken.com/0/public/Ticker?pair=${pair}`)) as {
      result?: Record<string, { c?: [string] }>;
    };
    const first = Object.values(j?.result ?? {})[0];
    const p = Number(first?.c?.[0]);
    return Number.isFinite(p) && p > 0 ? p : null;
  } catch {
    return null;
  }
}

export async function fetchLiveUsdPrice8Dec(symbol: AssetSymbol): Promise<{ usd: number; price8Dec: bigint; sources: number }> {
  if (symbol === "USDC" || symbol === "tUSDC" || symbol === "USDG") {
    return { usd: 1, price8Dec: parseUnits("1", 8), sources: 1 };
  }
  const base: "ETH" | "BTC" = symbol === "ETH" || symbol === "WETH" ? "ETH" : "BTC";
  const [cb, kr] = await Promise.all([fetchCoinbaseSpot(base), fetchKrakenSpot(base)]);
  const samples = [cb, kr].filter((v): v is number => v !== null && v > 0);
  if (samples.length === 0) throw new Error(`No live market price available for ${symbol}`);
  const med = median(samples);
  return { usd: med, price8Dec: parseUnits(med.toFixed(8), 8), sources: samples.length };
}

export function exceedsDeviationBps(current8Dec: bigint, next8Dec: bigint, thresholdBps: number): boolean {
  if (current8Dec <= 0n) return true;
  const diff = next8Dec > current8Dec ? next8Dec - current8Dec : current8Dec - next8Dec;
  return diff * 10_000n >= current8Dec * BigInt(thresholdBps);
}
