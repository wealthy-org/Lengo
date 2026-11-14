import { NextResponse } from "next/server";
import { getTokens } from "@/lib/oneclick";

export async function GET() {
  try {
    const { tokens, fetchedAt } = await getTokens();
    const slim = tokens.map(({ assetId, decimals, blockchain, symbol, price }) => ({ assetId, decimals, blockchain, symbol, price }));
    return NextResponse.json({ tokens: slim, fetchedAt, source: "1click /v0/tokens" });
  } catch (e) {
    return NextResponse.json({ error: "Token discovery unavailable", reason: String((e as Error).message) }, { status: 502 });
  }
}
