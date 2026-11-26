import { NextResponse } from "next/server";
import { createPublicClient, fallback, http, maxUint256, type Address } from "viem";
import { db } from "@/lib/db";
import { marketAbi } from "@/lib/abi";
import { DEPLOYMENTS } from "@/lib/chain";

const WAD = 10n ** 18n;
const WARN_HF = 13n * 10n ** 17n; // 1.30e18

export async function GET(req: Request) {
  const url = new URL(req.url);
  const chainId = Number(url.searchParams.get("chainId") || "4663") === 46630 ? 46630 : 4663;
  const mode = chainId === 46630 ? "testnet" : "mainnet";
  const net = DEPLOYMENTS[mode];
  const rawMarket = url.searchParams.get("market")?.trim();
  const market = (rawMarket && /^0x[0-9a-fA-F]{40}$/.test(rawMarket) ? rawMarket : net.market) as Address | undefined;

  if (!market) {
    return NextResponse.json({ activePositions: 0, activeBorrowers: 0, atRisk: 0, liquidatable: 0 });
  }

  const sql = db();
  if (!sql) {
    return NextResponse.json({ activePositions: null, source: "no_db" }, { status: 200 });
  }

  try {
    const mktLower = market.toLowerCase();
    // Include rows matching this market OR legacy rows before market column was added (on primary WETH/tBTC market)
    const isPrimary = net.market?.toLowerCase() === mktLower;
    const acctRows = isPrimary
      ? ((await sql`select distinct account from activity where chain_id = ${chainId} and (market = ${mktLower} or market is null)`) as { account: string }[])
      : ((await sql`select distinct account from activity where chain_id = ${chainId} and market = ${mktLower}`) as { account: string }[]);

    const candidates = acctRows
      .map((r) => r.account)
      .filter((a): a is Address => /^0x[0-9a-fA-F]{40}$/.test(a));

    if (candidates.length === 0) {
      return NextResponse.json(
        { activePositions: 0, activeBorrowers: 0, atRisk: 0, liquidatable: 0, checked: 0 },
        { headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30" } }
      );
    }

    const rpcs = net.chain.rpcUrls.default.http;
    const client = createPublicClient({
      chain: net.chain,
      transport: fallback(rpcs.map((u) => http(u, { timeout: 8_000 }))),
    });

    const results = await client.multicall({
      allowFailure: true,
      contracts: candidates.map((acct) => ({
        address: market,
        abi: marketAbi,
        functionName: "getPosition" as const,
        args: [acct] as const,
      })),
    });

    let activePositions = 0;
    let activeBorrowers = 0;
    let atRisk = 0;
    let liquidatable = 0;

    for (const r of results) {
      if (r.status !== "success" || !r.result) continue;
      const [coll, debt, hf] = r.result as readonly [bigint, bigint, bigint, bigint, bigint];
      if (coll > 0n || debt > 0n) activePositions++;
      if (debt > 0n) {
        activeBorrowers++;
        if (hf < WAD) liquidatable++;
        else if (hf < WARN_HF) atRisk++;
      }
    }

    return NextResponse.json(
      { activePositions, activeBorrowers, atRisk, liquidatable, checked: candidates.length },
      { headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30" } }
    );
  } catch (e) {
    console.error("Market stats error:", e);
    return NextResponse.json({ activePositions: null, error: (e as Error).message }, { status: 200 });
  }
}
void maxUint256;
