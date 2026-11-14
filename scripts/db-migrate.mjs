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
console.log("schema applied, deployment row upserted");
await pool.end();
