import { NextResponse } from "next/server";
import { syncIndex } from "@/lib/indexer";

// Backfills/advances the event index. Locally: curl -X POST localhost:3000/api/index/sync
// With INDEXER_SECRET set, callers must send `authorization: Bearer <secret>` (for a cron later).
export async function POST(req: Request) {
  const secret = process.env.INDEXER_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { return NextResponse.json(await syncIndex()); }
  catch (e) { return NextResponse.json({ ok: false, reason: (e as Error).message }, { status: 502 }); }
}
