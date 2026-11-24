// Lengo keeper: updates PriceOracle (Mainnet live multi-source median) or DemoOracle (Testnet baseline)
// and advances the Neon Postgres event index.
import { createPublicClient, createWalletClient, defineChain, http, parseUnits, type Address, type Hex, type Log } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { neon } from "@neondatabase/serverless";
import { marketAbi, oracleAbi, priceOracleAbi } from "../../src/lib/abi";
import { exceedsDeviationBps, fetchLiveUsdPrice8Dec, type AssetSymbol } from "./priceFeed";

export interface Env {
  KEEPER_ON: string;
  RPC_URL: string;
  CHAIN_ID: string;
  ORACLE: Address;
  MARKET: Address;
  COLLATERAL?: Address;
  DEBT_ASSET?: Address;
  COLLATERAL_SYMBOL?: AssetSymbol;
  DEBT_SYMBOL?: AssetSymbol;
  // Legacy testnet vars (supported for backwards compatibility)
  TBTC?: Address;
  TUSDC?: Address;
  START_BLOCK: string;
  BTC_BASELINE_USD?: string;
  REFRESH_AFTER_S: string;
  DEVIATION_BPS?: string;
  KEEPER_PRIVATE_KEY?: Hex;
  DATABASE_URL?: string;
}

const isMainnet = (env: Env) => Number(env.CHAIN_ID) === 4663;
const collAddr = (env: Env): Address => (env.COLLATERAL || env.TBTC)!;
const debtAddr = (env: Env): Address => (env.DEBT_ASSET || env.TUSDC)!;
const collSym = (env: Env): AssetSymbol => env.COLLATERAL_SYMBOL || (isMainnet(env) ? "WETH" : "tBTC");
const debtSym = (env: Env): AssetSymbol => env.DEBT_SYMBOL || (isMainnet(env) ? "USDG" : "tUSDC");

const chainOf = (env: Env) =>
  defineChain({
    id: Number(env.CHAIN_ID),
    name: isMainnet(env) ? "Robinhood Chain" : "Robinhood Chain Testnet",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [env.RPC_URL] } },
  });

async function prices(env: Env) {
  const pub = createPublicClient({ chain: chainOf(env), transport: http() });
  const cA = collAddr(env);
  const dA = debtAddr(env);
  const [c, d] = await Promise.all(
    [cA, dA].map(
      (a) =>
        pub.readContract({
          address: env.ORACLE,
          abi: priceOracleAbi,
          functionName: "getPrice",
          args: [a],
        }) as Promise<readonly [bigint, bigint]>
    )
  );
  const now = Math.floor(Date.now() / 1000);
  return {
    pub,
    coll: { addr: cA, sym: collSym(env), price: c[0], age: now - Number(c[1]) },
    debt: { addr: dA, sym: debtSym(env), price: d[0], age: now - Number(d[1]) },
  };
}

// Keep Testnet (46630) DemoOracle fresh with free testnet ETH even when primary Worker env is Mainnet (4663)
async function refreshTestnetBaseline(keeperKey?: Hex) {
  if (!keeperKey) return { skipped: "KEEPER_PRIVATE_KEY not set" };
  const tnChain = defineChain({
    id: 46630,
    name: "Robinhood Chain Testnet",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: ["https://46630.rpc.thirdweb.com", "https://rpc.testnet.chain.robinhood.com"] } },
  });
  const ORACLE = "0x7e4B30ef399EFE0fab110Ad9ADc3b39c8d19D5cE" as Address;
  const TBTC = "0x2e179ff76ef528821f2dE00D7079F1999ccdEB88" as Address;
  const TUSDC = "0xe1f1C4292C7AED0D0E99DD1233607e776826762d" as Address;
  const pub = createPublicClient({ chain: tnChain, transport: http() });
  const [b, u] = await Promise.all(
    [TBTC, TUSDC].map((a) => pub.readContract({ address: ORACLE, abi: oracleAbi, functionName: "getPrice", args: [a] }) as Promise<readonly [bigint, bigint]>)
  );
  const now = Math.floor(Date.now() / 1000);
  const bAge = now - Number(b[1]);
  const uAge = now - Number(u[1]);
  if (bAge <= 180 && uAge <= 180) return { mode: "testnet-keepalive", ages: { tBTC: bAge, tUSDC: uAge }, skipped: "fresh" };

  const account = privateKeyToAccount(keeperKey);
  const wallet = createWalletClient({ account, chain: tnChain, transport: http() });
  let nonce = await pub.getTransactionCount({ address: account.address, blockTag: "pending" });
  const sent: Record<string, Hex> = {};
  if (bAge > 180) {
    sent.tBTC = await wallet.writeContract({ address: ORACLE, abi: oracleAbi, functionName: "setPrice", args: [TBTC, parseUnits("100000", 8), false], nonce: nonce++ });
  }
  if (uAge > 180) {
    sent.tUSDC = await wallet.writeContract({ address: ORACLE, abi: oracleAbi, functionName: "setPrice", args: [TUSDC, parseUnits("1", 8), false], nonce: nonce++ });
  }
  return { mode: "testnet-keepalive", ages: { tBTC: bAge, tUSDC: uAge }, sent };
}

export async function runKeeper(env: Env) {
  // On Mainnet (4663) ChainlinkOracle is keeperless, so use the */4 cron to keep Testnet DemoOracle fresh for free!
  if (isMainnet(env) && env.KEEPER_ON !== "true") {
    return refreshTestnetBaseline(env.KEEPER_PRIVATE_KEY);
  }
  if (env.KEEPER_ON !== "true") return { skipped: "KEEPER_ON is not true" };
  if (!env.KEEPER_PRIVATE_KEY) return { skipped: "KEEPER_PRIVATE_KEY not set" };

  const { pub, coll, debt } = await prices(env);
  const after = Number(env.REFRESH_AFTER_S || "180");
  const devBps = Number(env.DEVIATION_BPS || "100"); // 1% move triggers early update on mainnet
  const mainnet = isMainnet(env);

  const account = privateKeyToAccount(env.KEEPER_PRIVATE_KEY);
  const owner = (await pub.readContract({ address: env.ORACLE, abi: priceOracleAbi, functionName: "owner" })) as Address;
  let authorized = owner.toLowerCase() === account.address.toLowerCase();
  if (!authorized && mainnet) {
    try {
      const keeper = (await pub.readContract({ address: env.ORACLE, abi: priceOracleAbi, functionName: "keeper" })) as Address;
      authorized = keeper.toLowerCase() === account.address.toLowerCase();
    } catch {
      /* DemoOracle has no keeper() */
    }
  }
  if (!authorized) return { skipped: `keeper ${account.address} is not authorized on oracle ${env.ORACLE}` };

  // Compute target prices: live multi-source median on Mainnet, baseline on Testnet unless LIVE_FEED is used
  const nextColl = mainnet
    ? (await fetchLiveUsdPrice8Dec(coll.sym)).price8Dec
    : parseUnits(env.BTC_BASELINE_USD || "100000", 8);
  const nextDebt = mainnet
    ? (await fetchLiveUsdPrice8Dec(debt.sym)).price8Dec
    : parseUnits("1", 8);

  const shouldUpdateColl = coll.age > after || (mainnet && exceedsDeviationBps(coll.price, nextColl, devBps));
  const shouldUpdateDebt = debt.age > after || (mainnet && exceedsDeviationBps(debt.price, nextDebt, devBps));

  const wallet = createWalletClient({ account, chain: chainOf(env), transport: http() });
  const sent: Record<string, Hex> = {};
  const errors: Record<string, string> = {};
  let nonce = await pub.getTransactionCount({ address: account.address, blockTag: "pending" });

  const send = async (label: string, asset: Address, price: bigint) => {
    try {
      sent[label] = mainnet
        ? await wallet.writeContract({
            address: env.ORACLE,
            abi: priceOracleAbi,
            functionName: "setPrice",
            args: [asset, price],
            nonce: nonce++,
          })
        : await wallet.writeContract({
            address: env.ORACLE,
            abi: oracleAbi,
            functionName: "setPrice",
            args: [asset, price, false],
            nonce: nonce++,
          });
    } catch (e) {
      errors[label] = String(e).split("\n")[0].slice(0, 200);
    }
  };

  if (shouldUpdateColl) await send(coll.sym, coll.addr, nextColl);
  if (shouldUpdateDebt) await send(debt.sym, debt.addr, nextDebt);

  return {
    mode: mainnet ? "mainnet-live-feed" : "testnet-baseline",
    ages: { [coll.sym]: coll.age, [debt.sym]: debt.age },
    pricesUsd: { [coll.sym]: Number(nextColl) / 1e8, [debt.sym]: Number(nextDebt) / 1e8 },
    sent,
    errors,
  };
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
  let chunks = 0;
  let lastEnd = from;
  // Use 999-block spans (1,000 blocks inclusive) to comply with thirdweb / public Orbit RPC getLogs limits,
  // and cap at 35 chunks per cron invocation to stay well inside Cloudflare Worker subrequest budgets.
  for (let s = from; s <= head && chunks < 35; s += 1_000n, chunks++) {
    const e = s + 999n > head ? head : s + 999n;
    const logs = (await pub.getContractEvents({
      address: env.MARKET,
      abi: marketAbi,
      fromBlock: s,
      toBlock: e,
    })) as (Log & { eventName: string; args: Record<string, unknown> })[];
    for (const l of logs) {
      const f = map[l.eventName];
      if (!f) continue;
      const r = f(l.args);
      await sql`insert into activity (chain_id, tx_hash, log_index, block_number, block_hash, event, account, counterparty, amount_a, amount_b)
        values (${chainId}, ${l.transactionHash}, ${l.logIndex}, ${l.blockNumber!.toString()}, ${l.blockHash}, ${r.event}, ${r.account.toLowerCase()},
                ${r.counterparty?.toLowerCase() ?? null}, ${r.a?.toString() ?? null}, ${r.b?.toString() ?? null})
        on conflict (chain_id, tx_hash, log_index) do nothing`;
      inserted++;
    }
    lastEnd = e;
    await sql`insert into indexer_cursor (chain_id, last_block, updated_at) values (${chainId}, ${e.toString()}, now())
      on conflict (chain_id) do update set last_block = excluded.last_block, updated_at = now()`;
  }
  return { from: from.toString(), to: lastEnd.toString(), head: head.toString(), inserted };
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const job = event.cron === "*/4 * * * *" ? runKeeper(env) : runIndexer(env);
    ctx.waitUntil(
      job
        .then((r) => console.log(event.cron, JSON.stringify(r, (_, v) => (typeof v === "bigint" ? v.toString() : v))))
        .catch((e) => console.error(event.cron, String(e)))
    );
  },
  async fetch(_req: Request, env: Env) {
    try {
      const { coll, debt } = await prices(env);
      return Response.json({
        chainId: Number(env.CHAIN_ID),
        mode: isMainnet(env) ? "mainnet" : "testnet",
        keeperOn: env.KEEPER_ON === "true",
        [coll.sym]: { usd: Number(coll.price) / 1e8, ageS: coll.age },
        [debt.sym]: { usd: Number(debt.price) / 1e8, ageS: debt.age },
      });
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 502 });
    }
  },
};
