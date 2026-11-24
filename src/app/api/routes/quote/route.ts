import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { ONECLICK, getTokens, toUnits } from "@/lib/oneclick";
import { db } from "@/lib/db";

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
  execute?: boolean; // when true, requests a live executable 1Click quote (dry: false) with depositAddress
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
  // Live execution NEVER uses team fixture addresses — user must supply explicit recipient & refund addresses
  const recipient = execute
    ? b.recipient?.trim()
    : b.recipient?.trim() || process.env[`QUOTE_RECIPIENT_${d.blockchain.toUpperCase()}`];
  const refundTo = execute
    ? b.refundTo?.trim()
    : b.refundTo?.trim() || process.env[`QUOTE_REFUND_${o.blockchain.toUpperCase()}`];

  if (!recipient || !refundTo) {
    return NextResponse.json(
      {
        status: "needs_address",
        reason: `Enter your ${!recipient ? d.blockchain + " recipient" : o.blockchain + " refund"} address${execute ? " to execute live routing" : " for the quote request"}`,
      },
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
      origin: { symbol: o.symbol, chain: o.blockchain, decimals: o.decimals, contractAddress: o.contractAddress },
      destination: { symbol: d.symbol, chain: d.blockchain, decimals: d.decimals, contractAddress: d.contractAddress },
      amountInUnits: units.toString(),
      amountIn: q.amountInFormatted,
      amountInUsd: q.amountInUsd,
      amountOut: q.amountOutFormatted,
      amountOutUsd: q.amountOutUsd,
      minAmountOut: q.minAmountOut,
      timeEstimate: q.timeEstimate,
      fees: { refundFee: q.refundFee, withdrawFee: q.withdrawFee, appFees: j.quoteRequest?.appFees ?? [] },
      deadline: q.deadline ?? deadline,
      quotedAt: j.timestamp,
      correlationId: j.correlationId,
    });
  } catch (e) {
    return NextResponse.json({ status: "unavailable", reason: "Provider unreachable: " + (e as Error).message }, { status: 502 });
  }
}
