import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rhTestnet } from "@/lib/chain";

// Activity from the DB read model: one account, or market-wide when no account is given.
// 204 tells the client to fall back to RPC.
export async function GET(req: Request) {
  const account = new URL(req.url).searchParams.get("account")?.toLowerCase() ?? null;
  if (account && !/^0x[0-9a-f]{40}$/.test(account)) return NextResponse.json({ error: "invalid account" }, { status: 400 });
  const sql = db();
  if (!sql) return new NextResponse(null, { status: 204 });
  try {
    const rows = account
      ? await sql`select tx_hash, log_index, block_number, event, amount_a, amount_b from activity
          where chain_id = ${rhTestnet.id} and (account = ${account} or counterparty = ${account})
          order by block_number desc, log_index desc limit 200`
      : await sql`select tx_hash, log_index, block_number, event, amount_a, amount_b from activity
          where chain_id = ${rhTestnet.id}
          order by block_number desc, log_index desc limit 50`;
    const cur = await sql`select last_block, updated_at from indexer_cursor where chain_id = ${rhTestnet.id}`;
    return NextResponse.json({ rows, indexedTo: cur[0]?.last_block ?? null, updatedAt: cur[0]?.updated_at ?? null });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}
