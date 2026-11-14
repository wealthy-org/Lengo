// Lengo keeper: keeps the testnet DemoOracle fresh and advances the Neon event index.
import { createPublicClient, createWalletClient, defineChain, http, parseUnits, type Address, type Hex, type Log } from "viem";
import { privateKeyToAccount, nonceManager } from "viem/accounts";
import { neon } from "@neondatabase/serverless";
import { marketAbi, oracleAbi } from "../../src/lib/abi";

export interface Env {
  KEEPER_ON: string; RPC_URL: string; CHAIN_ID: string;
  ORACLE: Address; MARKET: Address; TBTC: Address; TUSDC: Address;
  START_BLOCK: string; BTC_BASELINE_USD: string; REFRESH_AFTER_S: string;
  KEEPER_PRIVATE_KEY?: Hex; DATABASE_URL?: string;
}

const chainOf = (env: Env) => defineChain({
  id: Number(env.CHAIN_ID), name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [env.RPC_URL] } },
});

async function prices(env: Env) {
  const pub = createPublicClient({ chain: chainOf(env), transport: http() });
  const [b, u] = await Promise.all([env.TBTC, env.TUSDC].map((a) =>
    pub.readContract({ address: env.ORACLE, abi: oracleAbi, functionName: "getPrice", args: [a] }) as Promise<readonly [bigint, bigint]>));
  const now = Math.floor(Date.now() / 1000);
  return { pub, btc: { price: b[0], age: now - Number(b[1]) }, usd: { price: u[0], age: now - Number(u[1]) } };
}

export async function runKeeper(env: Env) {
  if (env.KEEPER_ON !== "true") return { skipped: "KEEPER_ON is not true" };
  if (!env.KEEPER_PRIVATE_KEY) return { skipped: "KEEPER_PRIVATE_KEY not set" };
  const { pub, btc, usd } = await prices(env);
  const after = Number(env.REFRESH_AFTER_S);
  const account = privateKeyToAccount(env.KEEPER_PRIVATE_KEY, { nonceManager });
  const owner = await pub.readContract({ address: env.ORACLE, abi: oracleAbi, functionName: "owner" }) as Address;
  if (owner.toLowerCase() !== account.address.toLowerCase()) return { skipped: `keeper ${account.address} is not oracle owner ${owner}` };

  const wallet = createWalletClient({ account, chain: chainOf(env), transport: http() });
  const sent: Record<string, Hex> = {};
  // Only the baseline is ever posted, so a leaked keeper key can't set arbitrary prices through this path.
  // That also means an active demo override gets replaced: set KEEPER_ON=false for the liquidation demo.
  const baseline = parseUnits(env.BTC_BASELINE_USD, 8);
  if (btc.age > after) sent.tBTC = await wallet.writeContract({ address: env.ORACLE, abi: oracleAbi, functionName: "setPrice", args: [env.TBTC, baseline, false] });
  if (usd.age > after) sent.tUSDC = await wallet.writeContract({ address: env.ORACLE, abi: oracleAbi, functionName: "setPrice", args: [env.TUSDC, parseUnits("1", 8), false] });
  return { ages: { tBTC: btc.age, tUSDC: usd.age }, sent };
}

type Row = { event: string; account: string; counterparty: string | null; a: bigint | null; b: bigint | null };
const map: Record<string, (x: Record<string, unknown>) => Row> = {
  CollateralDeposited: (x) => ({ event: "Deposit", account: x.account as string, counterparty: null, a: x.assets as bigint, b: null }),
  CollateralWithdrawn: (x) => ({ event: "Withdraw", account: x.account as string, counterparty: null, a: x.assets as bigint, b: null }),
  Borrowed: (x) => ({ event: "Borrow", account: x.account as string, counterparty: null, a: x.assets as bigint, b: x.shares as bigint }),
  Repaid: (x) => ({ event: "Repay", account: x.account as string, counterparty: x.payer as string, a: x.assets as bigint, b: x.shares as bigint }),
  Supplied: (x) => ({ event: "Supply", account: x.account as string, counterparty: null, a: x.assets as bigint, b: x.shares as bigint }),
  SupplyWithdrawn: (x) => ({ event: "Withdraw supply", account: x.account as string, counterparty: null, a: x.assets as bigint, b: x.shares as bigint }),
  Liquidated: (x) => ({ event: "Liquidated", account: x.borrower as string, counterparty: x.liquidator as string, a: x.repaid as bigint, b: x.seized as bigint }),
  BadDebt: (x) => ({ event: "Bad debt", account: x.borrower as string, counterparty: null, a: x.assets as bigint, b: null }),
};

export async function runIndexer(env: Env) {
  if (!env.DATABASE_URL) return { skipped: "DATABASE_URL not set" };
  const sql = neon(env.DATABASE_URL);
  const pub = createPublicClient({ chain: chainOf(env), transport: http() });
  const chainId = Number(env.CHAIN_ID);
  const start = BigInt(env.START_BLOCK);
  const cur = (await sql`select last_block from indexer_cursor where chain_id = ${chainId}`) as { last_block: string }[];
  let from = cur[0] ? BigInt(cur[0].last_block) - 20n : start;
  if (from < start) from = start;
  const head = await pub.getBlockNumber();
  await sql`delete from activity where chain_id = ${chainId} and block_number >= ${from.toString()}`;
  let inserted = 0;
  for (let s = from; s <= head; s += 9_000n) {
    const e = s + 8_999n > head ? head : s + 8_999n;
    const logs = (await pub.getContractEvents({ address: env.MARKET, abi: marketAbi, fromBlock: s, toBlock: e })) as (Log & { eventName: string; args: Record<string, unknown> })[];
    for (const l of logs) {
      const f = map[l.eventName]; if (!f) continue;
      const r = f(l.args);
      await sql`insert into activity (chain_id, tx_hash, log_index, block_number, block_hash, event, account, counterparty, amount_a, amount_b)
        values (${chainId}, ${l.transactionHash}, ${l.logIndex}, ${l.blockNumber!.toString()}, ${l.blockHash}, ${r.event}, ${r.account.toLowerCase()},
                ${r.counterparty?.toLowerCase() ?? null}, ${r.a?.toString() ?? null}, ${r.b?.toString() ?? null})
        on conflict (chain_id, tx_hash, log_index) do nothing`;
      inserted++;
    }
    await sql`insert into indexer_cursor (chain_id, last_block, updated_at) values (${chainId}, ${e.toString()}, now())
      on conflict (chain_id) do update set last_block = excluded.last_block, updated_at = now()`;
  }
  return { from: from.toString(), to: head.toString(), inserted };
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const job = event.cron === "*/4 * * * *" ? runKeeper(env) : runIndexer(env);
    ctx.waitUntil(job.then((r) => console.log(event.cron, JSON.stringify(r, (_, v) => (typeof v === "bigint" ? v.toString() : v))))
      .catch((e) => console.error(event.cron, String(e))));
  },
  // Read-only status page; never triggers a write.
  async fetch(_req: Request, env: Env) {
    try {
      const { btc, usd } = await prices(env);
      return Response.json({ keeperOn: env.KEEPER_ON === "true", tBTC: { usd: Number(btc.price) / 1e8, ageS: btc.age }, tUSDC: { usd: Number(usd.price) / 1e8, ageS: usd.age } });
    } catch (e) { return Response.json({ error: String(e) }, { status: 502 }); }
  },
};
