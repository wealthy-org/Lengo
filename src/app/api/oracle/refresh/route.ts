import { NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http, parseUnits, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { oracleAbi } from "@/lib/abi";
import { deployment, isDeployed, rhTestnet } from "@/lib/chain";

// On-demand fallback for the keeper: re-posts the BASELINE prices only when they are stale.
// No polling: it runs only when someone asks (e.g. Borrow blocked by a stale price). Max once per 60s.
const STALE_AFTER = 240;
const BTC_BASELINE = process.env.BTC_BASELINE_USD || "100000";
let lastRun = 0;

export async function POST() {
  if (!isDeployed) return NextResponse.json({ ok: false, reason: "contracts not deployed" }, { status: 400 });
  const key = process.env.KEEPER_PRIVATE_KEY as Hex | undefined;
  if (!key) return NextResponse.json({ ok: false, reason: "on-demand refresh not configured" }, { status: 503 });
  if (Date.now() - lastRun < 60_000) return NextResponse.json({ ok: false, reason: "rate limited, try again in a minute" }, { status: 429 });

  const pub = createPublicClient({ chain: rhTestnet, transport: http() });
  const now = Math.floor(Date.now() / 1000);
  const age = async (a: Address) => {
    const r = await pub.readContract({ address: deployment.oracle!, abi: oracleAbi, functionName: "getPrice", args: [a] }) as readonly [bigint, bigint];
    return now - Number(r[1]);
  };
  const [btcAge, usdAge] = await Promise.all([age(deployment.tBTC!), age(deployment.tUSDC!)]);
  if (btcAge <= STALE_AFTER && usdAge <= STALE_AFTER) return NextResponse.json({ ok: true, skipped: "prices are fresh", ages: { tBTC: btcAge, tUSDC: usdAge } });

  const account = privateKeyToAccount(key);
  const owner = await pub.readContract({ address: deployment.oracle!, abi: oracleAbi, functionName: "owner" }) as Address;
  if (owner.toLowerCase() !== account.address.toLowerCase()) return NextResponse.json({ ok: false, reason: "keeper is not the oracle owner" }, { status: 503 });

  lastRun = Date.now();
  const wallet = createWalletClient({ account, chain: rhTestnet, transport: http() });
  const sent: Record<string, Hex> = {};
  try {
    if (btcAge > STALE_AFTER) {
      sent.tBTC = await wallet.writeContract({ address: deployment.oracle!, abi: oracleAbi, functionName: "setPrice", args: [deployment.tBTC!, parseUnits(BTC_BASELINE, 8), false] });
      await pub.waitForTransactionReceipt({ hash: sent.tBTC });
    }
    if (usdAge > STALE_AFTER) {
      sent.tUSDC = await wallet.writeContract({ address: deployment.oracle!, abi: oracleAbi, functionName: "setPrice", args: [deployment.tUSDC!, parseUnits("1", 8), false] });
      await pub.waitForTransactionReceipt({ hash: sent.tUSDC });
    }
    return NextResponse.json({ ok: true, sent });
  } catch (e) {
    return NextResponse.json({ ok: false, reason: (e as Error).message.split("\n")[0], sent }, { status: 502 });
  }
}
