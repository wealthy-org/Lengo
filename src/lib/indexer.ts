import "server-only";
import { createPublicClient, http, type Log } from "viem";
import { marketAbi } from "./abi";
import { DEFAULT_NETWORK, DEPLOYMENTS, type NetworkMode } from "./chain";
import { db } from "./db";

const CHUNK = 999n;       // thirdweb / public RPCs cap eth_getLogs at 1,000 blocks inclusive
const MAX_CHUNKS = 35;    // stay safely within serverless subrequest limits
const REWIND = 20n;       // re-scan recent blocks so a reorg can't leave stale rows

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

export async function syncIndex(mode: NetworkMode = DEFAULT_NETWORK) {
  const sql = db();
  if (!sql) return { ok: false, reason: "DATABASE_URL not set" };
  const net = DEPLOYMENTS[mode];
  if (!net.isDeployed) return { ok: false, reason: `${mode} contracts not deployed` };
  const client = createPublicClient({ chain: net.chain, transport: http(net.chain.rpcUrls.default.http[0]) });
  const chainId = net.chain.id;

  const cur = (await sql`select last_block from indexer_cursor where chain_id = ${chainId}`) as { last_block: string }[];
  let from = cur[0] ? BigInt(cur[0].last_block) - REWIND : net.startBlock;
  if (from < net.startBlock) from = net.startBlock;
  const head = await client.getBlockNumber();
  await sql`delete from activity where chain_id = ${chainId} and block_number >= ${from.toString()}`;

  let inserted = 0;
  let chunks = 0;
  let lastEnd = from;
  for (let start = from; start <= head && chunks < MAX_CHUNKS; start += CHUNK + 1n, chunks++) {
    const end = start + CHUNK > head ? head : start + CHUNK;
    const logs = (await client.getContractEvents({ address: net.market!, abi: marketAbi, fromBlock: start, toBlock: end })) as (Log & { eventName: string; args: Record<string, unknown> })[];
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
    lastEnd = end;
    await sql`insert into indexer_cursor (chain_id, last_block, updated_at) values (${chainId}, ${end.toString()}, now())
      on conflict (chain_id) do update set last_block = excluded.last_block, updated_at = now()`;
  }
  return { ok: true, mode, from: from.toString(), to: lastEnd.toString(), head: head.toString(), inserted };
}
