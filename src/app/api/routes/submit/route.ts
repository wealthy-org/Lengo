import { NextResponse } from "next/server";
import { ONECLICK } from "@/lib/oneclick";

/** Submits an origin-chain deposit txHash to 1Click so solvers index & settle immediately. */
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
