import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { DEFAULT_NETWORK, DEPLOYMENTS } from "@/lib/chain";

// Activity from the DB read model: one account, or market-wide when no account is given.
// Accepts ?chainId=46630|4663 (defaults to DEFAULT_NETWORK). 204 tells the client to fall back to RPC.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const account = url.searchParams.get("account")?.toLowerCase() ?? null;
  const chainParam = Number(url.searchParams.get("chainId") || DEPLOYMENTS[DEFAULT_NETWORK].chain.id);
  const chainId = chainParam === 4663 ? 4663 : 46630;
  if (account && !/^0x[0-9a-f]{40}$/.test(account)) return NextResponse.json({ error: "invalid account" }, { status: 400 });
  const sql = db();
  if (!sql) return new NextResponse(null, { status: 204 });
  try {
    let rows = account
      ? await sql`select tx_hash, log_index, block_number, event, account, counterparty, amount_a, amount_b, market from activity
          where chain_id = ${chainId} and (account = ${account} or counterparty = ${account})
          order by block_number desc, log_index desc limit 200`
      : await sql`select tx_hash, log_index, block_number, event, account, counterparty, amount_a, amount_b, market from activity
          where chain_id = ${chainId}
          order by block_number desc, log_index desc limit 50`;

    // If connected wallet has 0 personal events yet, also return market-wide rows so Activity isn't empty once pool has txns
    let scope: "account" | "market" = account ? "account" : "market";
    if (account && rows.length === 0) {
      rows = await sql`select tx_hash, log_index, block_number, event, account, counterparty, amount_a, amount_b, market from activity
        where chain_id = ${chainId}
        order by block_number desc, log_index desc limit 50`;
      scope = "market";
    }

    let quotes: Record<string, unknown>[] = [];
    if (chainId === 4663) {
      if (account && scope === "account") {
        const acctHash = createHash("sha256").update(account).digest("hex").slice(0, 16);
        quotes = await sql`select id, origin_asset, dest_asset, amount_in, amount_out, status, deposit_address, tx_hash, dest_tx_hash, created_at from quote
          where status in ('ok', 'live_quote', 'submitted', 'settled')
            and (sender_hash = ${acctHash} or recipient_hash = ${acctHash} or status = 'settled')
          order by id desc limit 15`;
      } else {
        // In market-wide view, prioritize real executed/settled routes and recent market quotes
        quotes = await sql`select id, origin_asset, dest_asset, amount_in, amount_out, status, deposit_address, tx_hash, dest_tx_hash, created_at from quote
          where status in ('settled', 'submitted', 'live_quote', 'ok')
          order by (case when status = 'settled' then 0 when status = 'submitted' then 1 when status = 'live_quote' then 2 else 3 end), id desc
          limit 15`;
      }
    }

    const cur = await sql`select last_block, updated_at from indexer_cursor where chain_id = ${chainId}`;
    return NextResponse.json({
      rows,
      quotes,
      scope,
      indexedTo: cur[0]?.last_block ?? null,
      updatedAt: cur[0]?.updated_at ?? null,
    });
  } catch (e) {
    console.error("Activity API error:", e);
    return new NextResponse(null, { status: 204 });
  }
}
