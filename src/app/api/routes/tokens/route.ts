import { NextResponse } from "next/server";
import { getTokens } from "@/lib/oneclick";

export async function GET() {
  try {
    const { tokens, fetchedAt } = await getTokens();
    const slim = tokens.map(({ assetId, decimals, blockchain, symbol, price }) => ({ assetId, decimals, blockchain, symbol, price }));
    // CDN caches the catalog for 5 min, so visitors don't each invoke a function.
    return NextResponse.json({ tokens: slim, fetchedAt, source: "1click /v0/tokens" }, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (e) {
    return NextResponse.json({ error: "Token discovery unavailable", reason: String((e as Error).message) }, { status: 502 });
  }
}
