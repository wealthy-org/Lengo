import { NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http, parseUnits, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { oracleAbi, priceOracleAbi } from "@/lib/abi";
import { DEPLOYMENTS, type NetworkMode } from "@/lib/chain";
import { fetchLiveUsdPrice8Dec } from "@/lib/priceFeed";

// On-demand fallback for the keeper: refreshes stale prices (baseline on testnet, live market median on mainnet).
const STALE_AFTER = 240;
const BTC_BASELINE = process.env.BTC_BASELINE_USD || "100000";
let lastRun = 0;

export async function POST(req: Request) {
  let mode: NetworkMode = process.env.NEXT_PUBLIC_NETWORK === "mainnet" ? "mainnet" : "testnet";
  try {
    const body = (await req.json()) as { mode?: string };
    if (body?.mode === "mainnet" || body?.mode === "testnet") mode = body.mode;
  } catch {
    /* empty body allowed */
  }

  const net = DEPLOYMENTS[mode];
  if (!net.isDeployed) return NextResponse.json({ ok: false, reason: `${mode} contracts not deployed` }, { status: 400 });
  const key = process.env.KEEPER_PRIVATE_KEY as Hex | undefined;
  if (!key) return NextResponse.json({ ok: false, reason: "on-demand refresh not configured" }, { status: 503 });
  if (Date.now() - lastRun < 60_000) return NextResponse.json({ ok: false, reason: "rate limited, try again in a minute" }, { status: 429 });

  const pub = createPublicClient({ chain: net.chain, transport: http() });
  const now = Math.floor(Date.now() / 1000);
  const age = async (a: Address) => {
    const r = (await pub.readContract({ address: net.oracle!, abi: priceOracleAbi, functionName: "getPrice", args: [a] })) as readonly [bigint, bigint];
    return now - Number(r[1]);
  };
  const [collAge, debtAge] = await Promise.all([age(net.collateral!), age(net.debtAsset!)]);
  if (collAge <= STALE_AFTER && debtAge <= STALE_AFTER) {
    return NextResponse.json({ ok: true, skipped: "prices are fresh", ages: { [net.collSymbol]: collAge, [net.debtSymbol]: debtAge } });
  }

  const account = privateKeyToAccount(key);
  const owner = (await pub.readContract({ address: net.oracle!, abi: priceOracleAbi, functionName: "owner" })) as Address;
  let authorized = owner.toLowerCase() === account.address.toLowerCase();
  if (!authorized && mode === "mainnet") {
    try {
      const keeper = (await pub.readContract({ address: net.oracle!, abi: priceOracleAbi, functionName: "keeper" })) as Address;
      authorized = keeper.toLowerCase() === account.address.toLowerCase();
    } catch {
      /* ignore */
    }
  }
  if (!authorized) return NextResponse.json({ ok: false, reason: "keeper is not authorized on oracle" }, { status: 503 });

  lastRun = Date.now();
  const wallet = createWalletClient({ account, chain: net.chain, transport: http() });
  const sent: Record<string, Hex> = {};
  try {
    if (collAge > STALE_AFTER) {
      const collPrice = mode === "mainnet" ? (await fetchLiveUsdPrice8Dec(net.collSymbol)).price8Dec : parseUnits(BTC_BASELINE, 8);
      sent[net.collSymbol] =
        mode === "mainnet"
          ? await wallet.writeContract({ address: net.oracle!, abi: priceOracleAbi, functionName: "setPrice", args: [net.collateral!, collPrice] })
          : await wallet.writeContract({ address: net.oracle!, abi: oracleAbi, functionName: "setPrice", args: [net.collateral!, collPrice, false] });
      await pub.waitForTransactionReceipt({ hash: sent[net.collSymbol] });
    }
    if (debtAge > STALE_AFTER) {
      const debtPrice = mode === "mainnet" ? (await fetchLiveUsdPrice8Dec(net.debtSymbol)).price8Dec : parseUnits("1", 8);
      sent[net.debtSymbol] =
        mode === "mainnet"
          ? await wallet.writeContract({ address: net.oracle!, abi: priceOracleAbi, functionName: "setPrice", args: [net.debtAsset!, debtPrice] })
          : await wallet.writeContract({ address: net.oracle!, abi: oracleAbi, functionName: "setPrice", args: [net.debtAsset!, debtPrice, false] });
      await pub.waitForTransactionReceipt({ hash: sent[net.debtSymbol] });
    }
    return NextResponse.json({ ok: true, mode, sent });
  } catch (e) {
    return NextResponse.json({ ok: false, reason: (e as Error).message.split("\n")[0], sent }, { status: 502 });
  }
}
