# Lengo — Mainnet Beta & Release Handoff

Cross-chain lending on **Robinhood Chain Mainnet (chain 4663)** (`WETH / USDG` + keeperless `ChainlinkOracle`, plus 6 isolated seeding markets) and **RH Testnet (chain 46630)**, integrated with **NEAR Intents 1Click** cross-chain routing (`Preview` & `Live` modes).

| | |
|---|---|
| Public app | https://lengoapp.tech |
| Repository | https://github.com/wealthy-org/Lengo |
| Mainnet Explorer | https://robinhoodchain.blockscout.com |
| Testnet Explorer | https://explorer.testnet.chain.robinhood.com |
| Testnet Oracle keeper | https://lengo-keeper.deploy-wealthy.workers.dev |

`lengo.vercel.app` belongs to another project — always use **https://lengoapp.tech**.

## 1. Deployment manifest — RH testnet 46630

| Contract | Address | Deploy tx | Verified |
|---|---|---|---|
| LengoMarket | [`0xA4f36BEb211186C42B0A6B50Cf85DB062C5e5E25`](https://explorer.testnet.chain.robinhood.com/address/0xA4f36BEb211186C42B0A6B50Cf85DB062C5e5E25) | [0x6d976f50…](https://explorer.testnet.chain.robinhood.com/tx/0x6d976f5003d1b8d0c470415de7b81cdb87ff515bdbf3ffa9a64537b9ea5d2119) | ✅ Blockscout |
| TestToken tBTC (8 dec) | [`0x2e179ff76ef528821f2dE00D7079F1999ccdEB88`](https://explorer.testnet.chain.robinhood.com/address/0x2e179ff76ef528821f2dE00D7079F1999ccdEB88) | [0x84345907…](https://explorer.testnet.chain.robinhood.com/tx/0x84345907e0d5ecfce5e172492c5c9f27525bb19e6f0c7e5d75942b1b1c7c3d62) | ✅ Blockscout |
| TestToken tUSDC (6 dec) | [`0xe1f1C4292C7AED0D0E99DD1233607e776826762d`](https://explorer.testnet.chain.robinhood.com/address/0xe1f1C4292C7AED0D0E99DD1233607e776826762d) | [0x7cd6c575…](https://explorer.testnet.chain.robinhood.com/tx/0x7cd6c5756ba42d0f605cbd636cb05322bc82eae32fd768135bfc4854051ddbcb) | ✅ Blockscout |
| DemoOracle | [`0x7e4B30ef399EFE0fab110Ad9ADc3b39c8d19D5cE`](https://explorer.testnet.chain.robinhood.com/address/0x7e4B30ef399EFE0fab110Ad9ADc3b39c8d19D5cE) | [0x34696684…](https://explorer.testnet.chain.robinhood.com/tx/0x34696684931ecffe7dd3948aefd2c93d18c35362f286e62c6eafba85a9481033) | ✅ Blockscout |

- Start block: **153087385** (from receipts; `block.number` inside an Orbit chain returns the L1 block, so it is not used).
- Deployer: `0x9178B573219C55586BbAf51Ecb24ACfb27BB7681`.
- Oracle owner: keeper wallet `0xB623c624990B9ac98d122F7Af987Bffe66F537EB` (ownership transfer [0x300ea040…](https://explorer.testnet.chain.robinhood.com/tx/0x300ea04066abfee743eb077152332f794df5a0c04de73beb105077cff2ccafed)).
- Build: Solidity 0.8.24, optimizer 200 runs, OpenZeppelin 5.1.0 (pinned). Machine-readable: `contracts/deployments/46630.json`.
- Seed liquidity: 10,000 tUSDC supplied by the deployer — [0xc2a7f8bb…](https://explorer.testnet.chain.robinhood.com/tx/0xc2a7f8bbc903ac9fdd6d25e52528f0abc9a64d9f0df659fa1f1dbbf00af4461a).

### Parameters (testnet demo, not mainnet recommendations)
Max borrow LTV 60% · liquidation threshold 75% · eligible at HF < 1 · liquidator bonus 5% · close factor 50% · fixed borrow APR 8% · protocol reserve 0% · oracle freshness 300 s.

## 2. Proof index (M1 + M2, real RH testnet transactions)

Two throwaway wallets: borrower A `0x9C286EfE93f3406f40290CA65aC485B5a06fd5c9`, liquidator B `0x92AAB0efebfdDfddbC187e874c796307Ff289e65`. Machine-readable: `contracts/deployments/proof-46630.json`.

| # | Milestone | Step | Tx |
|---|---|---|---|
| 1 | M1 | faucet tBTC | [0x6e55ff0a…edcbbd](https://explorer.testnet.chain.robinhood.com/tx/0x6e55ff0afa676b9d62cc4da9c0e5aceb0e172448580c1559167312afbcedcbbd) |
| 2 | M1 | faucet tUSDC | [0x0038beba…659e46](https://explorer.testnet.chain.robinhood.com/tx/0x0038bebafa23dc37932d774533c83a716db94c01ec28e24817ab52b330659e46) |
| 3 | M1 | approve 0.12 tBTC | [0xf6d517e4…076ce1](https://explorer.testnet.chain.robinhood.com/tx/0xf6d517e483c6059fef0479dd09d65552ebfab7739db0bba71112f299d6076ce1) |
| 4 | M1 | deposit 0.1 tBTC | [0xf8a22aa3…76f4cf](https://explorer.testnet.chain.robinhood.com/tx/0xf8a22aa3ed3a28b0e116db3ccf5cedf5d4c9f16adc6a844aae089c2e5f76f4cf) |
| 5 | M1 | borrow 4,000 tUSDC → HF 1.875 | [0x6f1ad8cd…7e6a0c](https://explorer.testnet.chain.robinhood.com/tx/0x6f1ad8cdcca074b61c98558e7a3fb6f27342ba50094cfd318205b85ed17e6a0c) |
| 6 | M1 | top-up 0.02 tBTC | [0x9ba6f59e…833fec](https://explorer.testnet.chain.robinhood.com/tx/0x9ba6f59ef717a0c6d0eb052d1fb38ca32b6d9ab73771fad0a31ddd0d90833fec) |
| 7 | M1 | approve tUSDC for repay | [0x9f4bfc4e…3e8961](https://explorer.testnet.chain.robinhood.com/tx/0x9f4bfc4e69d91d5fff9ac2d60ee996cb2e01fcfa90c3ef645ed83405423e8961) |
| 8 | M1 | partial repay 1,000 tUSDC | [0x8db24107…fccf67](https://explorer.testnet.chain.robinhood.com/tx/0x8db24107798e2f53d0b6318499bdc5b264692f30e7c27acbbf6c82aee2fccf67) |
| 9 | M1 | Repay All → debt exactly 0 | [0x0b37f9c3…786798](https://explorer.testnet.chain.robinhood.com/tx/0x0b37f9c3385b265f5d5ffc6bb55d88c7ced3ba0b19cee4f647271380cd786798) |
| 10 | M1 | Withdraw All 0.12 tBTC | [0x8c421690…6bbeea](https://explorer.testnet.chain.robinhood.com/tx/0x8c42169046e762d89cb17c4d11453969e3f2fc224ef974caa57a6372846bbeea) |
| 11 | M2 | approve 0.1 tBTC | [0xde9dcd7b…911593](https://explorer.testnet.chain.robinhood.com/tx/0xde9dcd7bc5263916d6a5af98dd9a29bcbb9b690d762264c25c066344f3911593) |
| 12 | M2 | deposit 0.1 tBTC | [0x5c311b84…26f77f](https://explorer.testnet.chain.robinhood.com/tx/0x5c311b8427bbb3336ae799b540f057d9cd15794c2d2a0cc8c6aa7cd6fb26f77f) |
| 13 | M2 | borrow 5,500 tUSDC (HF 1.364) | [0x69068cad…03b9d6](https://explorer.testnet.chain.robinhood.com/tx/0x69068cad0e8300e024918821571877bc287609aba3631d5ecfd164e8f503b9d6) |
| 14 | M2 | liquidator faucet tUSDC | [0x12a89cce…f4e9a8](https://explorer.testnet.chain.robinhood.com/tx/0x12a89cce7658340c31a6efb220bcefbe7cb7ecc7d3f8d4133174c16628f4e9a8) |
| 15 | M2 | liquidator approve tUSDC | [0x21714ff1…3a3a47](https://explorer.testnet.chain.robinhood.com/tx/0x21714ff1c9a7979966a9200059c1a0ba16f30d328a94f92c8aac1014ff3a3a47) |
| — | M2 | Demo price override → tBTC $70,000 (emitted `demoOverride = true`) | via `/dev/scenarios`, see `PriceUpdated` events on the oracle |
| 16 | M2 | liquidate ≤50% by wallet B | [0xf805811a…ee995d](https://explorer.testnet.chain.robinhood.com/tx/0xf805811a223a82fb9052517f4852a8b3dfa9c7e177e7267c82242e7fd1ee995d) |

**M2 before/after:** borrower A 0.1 tBTC / 5,500.01 tUSDC / HF 0.955 → 0.0587 tBTC / 2,750.01 tUSDC / HF 1.12. Liquidator B repaid exactly 50% and received 0.04125008 tBTC (= 2,750 × 1.05 / 70,000).

**M3 (route preview):** live 1Click discovery (231 tokens incl. `hood` USDG/ETH/WETH) and `dry: true` quotes, e.g. 1,000 USDG (RH) → ≈997.3 USDC (Solana), ~22 s estimate. Sanitized quote log in Neon (`quote` table, recipient stored as hash).

## 3. Tests

```bash
cd contracts && forge test
```

24 tests, all passing:
- 12 unit/fuzz (brief fixture HF 1.875, LTV caps, stale oracle, Repay All no-dust, lender interest, two-wallet liquidation, bad debt, faucet cooldown)
- 11 edge cases (HF exactly 1 not liquidatable, donation can't move share price, first-depositor inflation, round-trip rounding, close-factor repeat, withdraw beyond idle, owner-only oracle)
- 6 invariants over 128,000 random calls incl. liquidations: idle ≤ balance, collateral conserved, debt/supply shares conserved, claims ≤ idle + debt, index monotonic

Plus `scripts/e2e-fork.sh`: 16 end-to-end checks against the deployed contracts on a local fork.

## 4. Run / build / deploy

```bash
npm install
cp .env.example .env.local     # fill NEXT_PUBLIC_LENGO_* from contracts/deployments/46630.json, DATABASE_URL
npm run dev                    # http://localhost:3000
npm run db:migrate             # Neon schema + deployment row
```

| Piece | Where | Deploys on |
|---|---|---|
| Web app + API (Next.js 15.5.29) | Vercel `https://lengoapp.tech` | push to `main` |
| Keeper + indexer (`keeper/`) | Cloudflare Worker `lengo-keeper`, crons `*/4` oracle, `*/5` indexer | push to `main` |
| Read model | Neon Postgres (`db/schema.sql`) | `npm run db:migrate` |
| Contracts | RH testnet | `forge script script/Deploy.s.sol --rpc-url rh_testnet --broadcast` (refuses non-testnet chains) |

Env (no secrets in repo): see `.env.example` and `keeper/wrangler.toml`. Secrets live in Vercel / Cloudflare dashboards and local gitignored files (`.env.local`, `.env.e2e`, `keeper/.dev.vars`).

Operations:
- Liquidation demo: set `KEEPER_ON = "false"` in `keeper/wrangler.toml` (push), use `/dev/scenarios` with the keeper wallet, set it back afterwards.
- Avoid rapid back-to-back pushes: a Worker redeploy can delay cron firing by ~15 min.

## 5. Known limits and blockers

- Contracts are **not audited**. tBTC has no Bitcoin backing; tUSDC is not Circle USDC.
- Route preview never executes or issues deposit addresses; it reads mainnet quotes.
- No private positions. Browser HF alerts only while the tab is open.
- Native BTC/ZEC collateral is not implemented — see `docs/M5-BTC-SPIKE.md` for the open questions and dependencies.
- Brief still names the product **Lumen**; the app ships as **Lengo** per instruction — confirm with the owner.
