import { NextResponse } from "next/server";
import { ONECLICK } from "@/lib/oneclick";

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
    return NextResponse.json({
      status: j.status ?? "PENDING_DEPOSIT",
      updatedAt: j.updatedAt,
      swapDetails: j.swapDetails ?? null,
    });
  } catch (e) {
    return NextResponse.json({ status: "ERROR", reason: (e as Error).message }, { status: 502 });
  }
}
