// Applies db/schema.sql to DATABASE_URL (Neon). Usage: node --env-file=.env.local scripts/db-migrate.mjs
import { readFileSync } from "node:fs";
import { Pool } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL is not set in .env.local"); process.exit(1); }
const pool = new Pool({ connectionString: url });
const sql = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");
await pool.query(sql);
const dep = JSON.parse(readFileSync(new URL("../contracts/deployments/46630.json", import.meta.url), "utf8"));
await pool.query(
  `insert into deployment (chain_id, market, t_btc, t_usdc, oracle, start_block)
   values ($1,$2,$3,$4,$5,$6) on conflict (chain_id) do update set market=$2, t_btc=$3, t_usdc=$4, oracle=$5, start_block=$6`,
  [dep.chainId, dep.market, dep.tBTC, dep.tUSDC, dep.oracle, dep.startBlock],
);
// Backfill verified Mainnet 1Click settlement row (quote id 64 · correlation 1bea48fa-1e71-4535-8dc9-0bddebbb7b6b)
await pool.query(
  `update quote
   set status = 'settled',
       sender_hash = coalesce(sender_hash, encode(sha256('0xb91e596ef3e1855df77bc34b2d094ef8704bb5ae'::bytea), 'hex')::varchar(16)),
       deposit_address = coalesce(deposit_address, '0x0D650Ee3D0961B376a9b90fB12e5fE0BD9D46283'),
       tx_hash = coalesce(tx_hash, '0xc6684d3643a3d0378129c7b2ed80de1f44851e8ae71d4dcbb520b52016d09644'),
       dest_tx_hash = coalesce(dest_tx_hash, 'PWUk1xC3DdzyGvPZu9rVviDkj1EpNapzftXxjWPWwpfdFf6PyRMAWkmZqWbp8oCgk4jhuJFDgqz8pRzZV77RUwV')
   where correlation_id = '1bea48fa-1e71-4535-8dc9-0bddebbb7b6b'`,
);
console.log("schema applied, deployment row upserted");
await pool.end();
