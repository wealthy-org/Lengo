import { NextResponse } from "next/server";
import { ONECLICK } from "@/lib/oneclick";
import { db } from "@/lib/db";

function firstHash(arr: unknown): string | null {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const x = arr[0];
  if (typeof x === "string") return x;
  if (x && typeof x === "object" && "hash" in x && typeof (x as { hash: unknown }).hash === "string") {
    return (x as { hash: string }).hash;
  }
  return null;
}

/** Proxies NEAR Intents 1Click live execution status for a given depositAddress. */
export async function GET(req: Request) {
  const depositAddress = new URL(req.url).searchParams.get("depositAddress")?.trim();
  if (!depositAddress || depositAddress.length < 16) {
    return NextResponse.json({ error: "Missing depositAddress" }, { status: 400 });
  }
  const headers: Record<string, string> = {};
  if (process.env.ONECLICK_JWT) headers.authorization = `Bearer ${process.env.ONECLICK_JWT}`;
  try {
    const r = await fetch(`${ONECLICK}/status?depositAddress=${encodeURIComponent(depositAddress)}`, {
      headers,
      cache: "no-store",
    });
    const j = await r.json();
    if (!r.ok) {
      return NextResponse.json({ status: "ERROR", reason: j?.message ?? `Provider ${r.status}` }, { status: r.status });
    }
    if (j.status === "SUCCESS") {
      const sql = db();
      if (sql) {
        const oTx = firstHash(j.swapDetails?.originChainTxHashes);
        const dTx = firstHash(j.swapDetails?.destinationChainTxHashes);
        try {
          await sql`update quote
            set status = 'settled',
                tx_hash = coalesce(tx_hash, ${oTx}),
                dest_tx_hash = coalesce(dest_tx_hash, ${dTx})
            where lower(deposit_address) = ${depositAddress.toLowerCase()}`;
        } catch {
          /* best-effort DB sync */
        }
      }
    }
    return NextResponse.json({
      status: j.status ?? "PENDING_DEPOSIT",
      updatedAt: j.updatedAt,
      swapDetails: j.swapDetails ?? null,
    });
  } catch (e) {
    return NextResponse.json({ status: "ERROR", reason: (e as Error).message }, { status: 502 });
  }
}
