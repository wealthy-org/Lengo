import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { ONECLICK, getTokens, toUnits } from "@/lib/oneclick";
import { db } from "@/lib/db";

const EVM_CHAINS = new Set(["eth", "base", "arb", "hood", "op", "pol", "bsc", "avax"]);

// Safe format-valid preview fixtures used ONLY when dry:true (never used when execute:true)
const PREVIEW_FIXTURES: Record<string, string> = {
  evm: "0x000000000000000000000000000000000000dEaD",
  sol: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  btc: "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq",
  zec: "t1HxutHFt2Sejz7fs92wFVAbsFM7NDjsBG6",
};

function matchesChainFormat(addr: string, chain: string): boolean {
  if (!addr) return false;
  if (EVM_CHAINS.has(chain)) return /^0x[0-9a-fA-F]{40}$/.test(addr);
  if (chain === "sol") return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
  if (chain === "btc") return /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(addr);
  if (chain === "zec") return /^t[13][a-km-zA-HJ-NP-Z1-9]{33}$/.test(addr);
  return addr.length >= 16;
}

function previewFallbackFor(chain: string): string | undefined {
  const envVal = process.env[`QUOTE_RECIPIENT_${chain.toUpperCase()}`] || process.env[`QUOTE_REFUND_${chain.toUpperCase()}`];
  if (envVal && matchesChainFormat(envVal, chain)) return envVal;
  if (EVM_CHAINS.has(chain)) return PREVIEW_FIXTURES.evm;
  return PREVIEW_FIXTURES[chain];
}

/** Stores a sanitized quote record when Neon is configured. Addresses are hashed; failures never break the quote. */
async function logQuote(x: { o: string; d: string; amount: bigint; out?: string; status: string; reason?: string; recipient: string; correlationId?: string; quotedAt?: string; expiresAt?: string }) {
  const sql = db();
  if (!sql) return;
  try {
    const h = createHash("sha256").update(x.recipient).digest("hex").slice(0, 16);
    await sql`insert into quote (provider, correlation_id, origin_asset, dest_asset, amount_in, amount_out, status, reason, recipient_hash, quoted_at, expires_at)
      values ('1click', ${x.correlationId ?? null}, ${x.o}, ${x.d}, ${x.amount.toString()}, ${x.out ?? null}, ${x.status}, ${x.reason ?? null}, ${h}, ${x.quotedAt ?? null}, ${x.expiresAt ?? null})`;
  } catch { /* logging is best-effort */ }
}

type Body = {
  originAsset: string;
  destinationAsset: string;
  amount: string;
  recipient?: string;
  refundTo?: string;
  slippageBps?: number;
  execute?: boolean;
};

export async function POST(req: Request) {
  let b: Body;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }

  const { tokens } = await getTokens().catch(() => ({ tokens: [] as never[] }));
  const o = tokens.find((t) => t.assetId === b.originAsset);
  const d = tokens.find((t) => t.assetId === b.destinationAsset);
  if (!o || !d) return NextResponse.json({ status: "unsupported", reason: "Asset not in current 1Click discovery" }, { status: 422 });

  let units: bigint;
  try { units = toUnits(b.amount, o.decimals); } catch (e) { return NextResponse.json({ status: "invalid", reason: (e as Error).message }, { status: 422 }); }
  if (units <= 0n) return NextResponse.json({ status: "invalid", reason: "Amount must be positive" }, { status: 422 });

  const execute = b.execute === true;
  const rawRecipient = b.recipient?.trim() || "";
  const rawRefund = b.refundTo?.trim() || "";

  let recipient = matchesChainFormat(rawRecipient, d.blockchain) ? rawRecipient : undefined;
  let refundTo = matchesChainFormat(rawRefund, o.blockchain) ? rawRefund : undefined;

  if (!execute) {
    // In dry:true preview mode, fall back to safe format-valid fixtures so 1-click Quote always works out-of-the-box
    if (!recipient) recipient = previewFallbackFor(d.blockchain);
    if (!refundTo) refundTo = previewFallbackFor(o.blockchain);
  }

  if (!recipient || !refundTo) {
    const missing = !recipient ? `${d.blockchain.toUpperCase()} recipient` : `${o.blockchain.toUpperCase()} refund`;
    return NextResponse.json(
      { status: "needs_address", reason: `Enter a valid ${missing} address to execute live routing` },
      { status: 422 }
    );
  }

  const slippage = Math.min(Math.max(Math.round(b.slippageBps ?? 50), 1), 500);
  const deadline = new Date(Date.now() + 30 * 60_000).toISOString();
  const payload = {
    dry: !execute,
    swapType: "EXACT_INPUT",
    slippageTolerance: slippage,
    originAsset: o.assetId,
    depositType: "ORIGIN_CHAIN",
    destinationAsset: d.assetId,
    amount: units.toString(),
    refundTo,
    refundType: "ORIGIN_CHAIN",
    recipient,
    recipientType: "DESTINATION_CHAIN",
    deadline,
  };
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (process.env.ONECLICK_JWT) headers.authorization = `Bearer ${process.env.ONECLICK_JWT}`;

  try {
    const r = await fetch(`${ONECLICK}/quote`, { method: "POST", headers, body: JSON.stringify(payload), cache: "no-store" });
    const j = await r.json();
    if (!r.ok) {
      await logQuote({ o: o.assetId, d: d.assetId, amount: units, status: "rejected", reason: j?.message, recipient, correlationId: j?.correlationId });
      return NextResponse.json({ status: "rejected", reason: j?.message ?? `Provider ${r.status}` }, { status: 422 });
    }
    const q = j.quote ?? {};
    await logQuote({
      o: o.assetId,
      d: d.assetId,
      amount: units,
      out: q.amountOut,
      status: execute ? "live_quote" : "ok",
      recipient,
      correlationId: j.correlationId,
      quotedAt: j.timestamp,
      expiresAt: q.deadline ?? deadline,
    });
    return NextResponse.json({
      status: "ok",
      provider: "NEAR Intents 1Click",
      dry: !execute,
      depositAddress: execute ? (q.depositAddress as string | undefined) : undefined,
      depositMemo: execute ? (q.depositMemo as string | undefined) : undefined,
      origin: { assetId: o.assetId, symbol: o.symbol, chain: o.blockchain, decimals: o.decimals, contractAddress: o.contractAddress },
      destination: { assetId: d.assetId, symbol: d.symbol, chain: d.blockchain, decimals: d.decimals, contractAddress: d.contractAddress },
      amountInUnits: units.toString(),
      amountIn: q.amountInFormatted,
      amountInUsd: q.amountInUsd,
      amountOut: q.amountOutFormatted,
      amountOutUsd: q.amountOutUsd,
      minAmountOut: q.minAmountOut,
      timeEstimate: q.timeEstimate,
      fees: { refundFee: q.refundFee, withdrawFee: q.withdrawFee, appFees: j.quoteRequest?.appFees ?? [] },
      deadline: j.quoteRequest?.deadline ?? deadline,
      inactiveAt: q.timeWhenInactive ?? q.deadline,
      quotedAt: j.timestamp,
      correlationId: j.correlationId,
    });
  } catch (e) {
    return NextResponse.json({ status: "unavailable", reason: "Provider unreachable: " + (e as Error).message }, { status: 502 });
  }
}
