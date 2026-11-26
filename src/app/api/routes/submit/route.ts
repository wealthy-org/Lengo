import { NextResponse } from "next/server";
import { ONECLICK } from "@/lib/oneclick";
import { db } from "@/lib/db";

/** Submits an origin-chain deposit txHash to 1Click so solvers index & settle immediately, and records txHash in DB. */
export async function POST(req: Request) {
  let b: { txHash?: string; depositAddress?: string };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (!b.txHash || !b.depositAddress) {
    return NextResponse.json({ error: "txHash and depositAddress required" }, { status: 400 });
  }
  const sql = db();
  if (sql) {
    try {
      await sql`update quote
        set tx_hash = ${b.txHash},
            status = case when status = 'settled' then 'settled' else 'submitted' end
        where lower(deposit_address) = ${b.depositAddress.toLowerCase()}`;
    } catch {
      /* best-effort DB update */
    }
  }
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (process.env.ONECLICK_JWT) headers.authorization = `Bearer ${process.env.ONECLICK_JWT}`;
  try {
    const r = await fetch(`${ONECLICK}/deposit/submit`, {
      method: "POST",
      headers,
      body: JSON.stringify({ txHash: b.txHash, depositAddress: b.depositAddress }),
      cache: "no-store",
    });
    const j = await r.json().catch(() => ({}));
    return NextResponse.json({ ok: r.ok, status: r.status, detail: j });
  } catch (e) {
    return NextResponse.json({ ok: false, reason: (e as Error).message }, { status: 502 });
  }
}
