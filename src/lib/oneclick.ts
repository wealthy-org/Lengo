// Server-only helpers for NEAR Intents 1Click. Quotes are always dry:true in v0.1.
export const ONECLICK = "https://1click.chaindefuser.com/v0";

export type Token = {
  assetId: string; decimals: number; blockchain: string; symbol: string;
  price?: number; priceUpdatedAt?: string; contractAddress?: string;
};

let cache: { at: number; tokens: Token[] } | null = null;

export async function getTokens(): Promise<{ tokens: Token[]; fetchedAt: string }> {
  if (cache && Date.now() - cache.at < 5 * 60_000) return { tokens: cache.tokens, fetchedAt: new Date(cache.at).toISOString() };
  const headers: Record<string, string> = {};
  if (process.env.ONECLICK_JWT) headers.authorization = `Bearer ${process.env.ONECLICK_JWT}`;
  const r = await fetch(`${ONECLICK}/tokens`, { headers, cache: "no-store" });
  if (!r.ok) throw new Error(`tokens ${r.status}`);
  const tokens = (await r.json()) as Token[];
  cache = { at: Date.now(), tokens };
  return { tokens, fetchedAt: new Date(cache.at).toISOString() };
}

/** Converts a decimal string into smallest units without floating point. */
export function toUnits(amount: string, decimals: number): bigint {
  if (!/^\d+(\.\d+)?$/.test(amount)) throw new Error("invalid amount");
  const [i, f = ""] = amount.split(".");
  if (f.length > decimals) throw new Error(`max ${decimals} decimals`);
  return BigInt(i) * 10n ** BigInt(decimals) + BigInt((f + "0".repeat(decimals)).slice(0, decimals) || "0");
}
