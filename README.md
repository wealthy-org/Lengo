<p align="center">
  <img src="public/logo.png" alt="Lengo" width="96" />
</p>

<h1 align="center">Lengo</h1>

<p align="center">
  Cross-chain lending, settled on Robinhood Chain.<br/>
  <a href="https://lengoapp.tech">lengoapp.tech</a> · <a href="https://x.com/lengoapp">@lengoapp</a> · <a href="https://robinhoodchain.blockscout.com/address/0x8f1CDFEa078D84d0a2f974c658f71CF4B54c5900">Mainnet Explorer</a>
</p>

---

Lengo lets you borrow `USDG` against `WETH` collateral on **Robinhood Chain Mainnet (chain 4663)** powered by **Chainlink** price feeds, and route payouts across chains through **NEAR Intents 1Click**.

| | Status |
|---|---|
| 7 Isolated lending markets (`WETH`, `cbBTC`, `WBTC`, `USDe`, `NVDA`, `TSLA`, `AAPL` / `USDG`) | ✅ Live on Robinhood Chain Mainnet (`4663`, capped beta) |
| Keeperless oracle (`ChainlinkOracle` → 7 Chainlink feeds) | ✅ Live onchain (`0xAc892397986B84ff42894739F05fE884D1D4c6da`) |
| Cross-chain payout via NEAR Intents 1Click | ✅ Live quotes (`dry: true`) + Live execution (`dry: false`) |
| Testnet sandbox (`tBTC / tUSDC`, chain `46630`) | ✅ Live for risk & liquidation testing |
| Native BTC / ZEC collateral | 🔬 Research ([docs/M5-BTC-SPIKE.md](docs/M5-BTC-SPIKE.md)) |
| External security audit | ⏳ Capped beta |

## Deployed contracts: Robinhood Chain Mainnet (4663)

| Contract | Address |
|---|---|
| LengoMarket (`WETH / USDG`) | [`0x8f1CDFEa078D84d0a2f974c658f71CF4B54c5900`](https://robinhoodchain.blockscout.com/address/0x8f1CDFEa078D84d0a2f974c658f71CF4B54c5900) |
| LengoMarket (`cbBTC / USDG`) | [`0x75ae697448233142Ca295262b25B55e65856352E`](https://robinhoodchain.blockscout.com/address/0x75ae697448233142Ca295262b25B55e65856352E) |
| LengoMarket (`WBTC / USDG`) | [`0xC11B5cEd0A906aF856937ea64aBEeEfF04ACfAd3`](https://robinhoodchain.blockscout.com/address/0xC11B5cEd0A906aF856937ea64aBEeEfF04ACfAd3) |
| LengoMarket (`USDe / USDG`) | [`0x781435104117c5583c6D175784007Ca171d47f30`](https://robinhoodchain.blockscout.com/address/0x781435104117c5583c6D175784007Ca171d47f30) |
| LengoMarket (`NVDA / USDG`) | [`0x7D81A78F6a52264E0064764b2b1250385E5e193A`](https://robinhoodchain.blockscout.com/address/0x7D81A78F6a52264E0064764b2b1250385E5e193A) |
| LengoMarket (`TSLA / USDG`) | [`0xa4CaCae0e5221d6B5a2B1630f7F6f36e6b9eF99a`](https://robinhoodchain.blockscout.com/address/0xa4CaCae0e5221d6B5a2B1630f7F6f36e6b9eF99a) |
| LengoMarket (`AAPL / USDG`) | [`0xDF97819e82A634ff82689c282067b74D574467A3`](https://robinhoodchain.blockscout.com/address/0xDF97819e82A634ff82689c282067b74D574467A3) |
| ChainlinkOracle (Keeperless Adapter) | [`0xAc892397986B84ff42894739F05fE884D1D4c6da`](https://robinhoodchain.blockscout.com/address/0xAc892397986B84ff42894739F05fE884D1D4c6da) |
| Debt `USDG` (6 dec) | [`0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`](https://robinhoodchain.blockscout.com/address/0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168) |

Start block `122296154` · Manifests: [`contracts/deployments/4663.json`](contracts/deployments/4663.json) & [`contracts/deployments/4663-markets.json`](contracts/deployments/4663-markets.json).

## How it works

```
 Collateral (tBTC)          Lending engine                     Payout route
┌────────────────┐   ┌───────────────────────────┐   ┌───────────────────────────┐
│ deposit        │──▶│ LengoMarket (RH testnet)  │──▶│ NEAR Intents 1Click       │
│ withdraw       │   │ debt shares + RAY index   │   │ USDG (RH) → USDC Solana/  │
└────────────────┘   │ lender shares, liquidation│   │ Base … quote, dry run     │
                     └─────────────▲─────────────┘   └───────────────────────────┘
                                   │ price (8 dec, timestamp)
                     ┌─────────────┴─────────────┐
                     │ DemoOracle ◀── keeper     │  Cloudflare Worker, every 4 min
                     └───────────────────────────┘
```

- **One isolated market per collateral.** Collateral is never lent out as lender cash; invariant tests enforce this.
- **Debt shares with a borrow index (RAY).** Interest accrues per second at a fixed 8% APR. Repay All clears debt to exactly zero, with no dust left behind.
- **Lender shares with a virtual offset**, which blunt first-depositor inflation and donation attacks.
- **Stale-oracle guard.** Borrowing and withdrawals that leave debt are paused when a price is older than 300 s. Repay and debt-free exit always work.
- **Liquidation** opens at HF < 1, repays up to 50% of the debt per call and pays the liquidator a 5% bonus. Bad debt is written off when collateral runs out.

### Market parameters (testnet demo)

| Max LTV | Liquidation threshold | Liquidatable | Bonus | Close factor | Borrow APR | Oracle freshness |
|---|---|---|---|---|---|---|
| 60% | 75% | HF < 1 | 5% | 50% | 8% fixed | 300 s |

## Deployed contracts: Robinhood Chain testnet (46630)

All four contracts are verified on Blockscout.

| Contract | Address |
|---|---|
| LengoMarket | [`0xA4f36BEb211186C42B0A6B50Cf85DB062C5e5E25`](https://explorer.testnet.chain.robinhood.com/address/0xA4f36BEb211186C42B0A6B50Cf85DB062C5e5E25) |
| TestToken tBTC (8 dec) | [`0x2e179ff76ef528821f2dE00D7079F1999ccdEB88`](https://explorer.testnet.chain.robinhood.com/address/0x2e179ff76ef528821f2dE00D7079F1999ccdEB88) |
| TestToken tUSDC (6 dec) | [`0xe1f1C4292C7AED0D0E99DD1233607e776826762d`](https://explorer.testnet.chain.robinhood.com/address/0xe1f1C4292C7AED0D0E99DD1233607e776826762d) |
| DemoOracle | [`0x7e4B30ef399EFE0fab110Ad9ADc3b39c8d19D5cE`](https://explorer.testnet.chain.robinhood.com/address/0x7e4B30ef399EFE0fab110Ad9ADc3b39c8d19D5cE) |

Start block `153087385` · Solidity 0.8.24, optimizer 200 · OpenZeppelin 5.1.0 · machine-readable: [`contracts/deployments/46630.json`](contracts/deployments/46630.json).

The full deployment manifest and a 16-transaction proof index (M1 lifecycle, M2 two-wallet liquidation) are in [docs/HANDOFF.md](docs/HANDOFF.md).

## App

| Page | What it does |
|---|---|
| `/` | Landing |
| `/app` | Markets: deposit, borrow, repay, withdraw, lend; live health factor, LTV and liquidation price; HF alerts |
| `/app/routes` | NEAR Intents 1Click route preview (live discovery and quotes, `dry: true`) |
| `/app/activity` | Onchain event history, each tx linked to the explorer |
| `/faucet` | Mint demo tBTC / tUSDC (capped, 24 h cooldown, no value) |
| `/docs` | Formulas, parameters, limits |

Each transaction shows a step modal (confirm in wallet → pending → confirmed) and a toast that links to the tx on the explorer.

### API

| Route | Purpose |
|---|---|
| `GET /api/routes/tokens` | 1Click token discovery (cached) |
| `POST /api/routes/quote` | Server proxy to 1Click `/v0/quote`, always `dry: true`; quotes are logged with the recipient hashed |
| `GET /api/activity[?account=0x…]` | Market-wide or per-account events from the Neon read model |
| `POST /api/index/sync` | Indexer trigger (needs `INDEXER_SECRET`) |
| `POST /api/oracle/refresh` | Optional on-demand stale-price refresh (rate-limited) |

## Stack

- **Web:** Next.js 15, React 19, wagmi + viem, TanStack Query, GSAP + Lenis on the landing page.
- **Contracts:** Foundry, OpenZeppelin 5.1.0.
- **Keeper and indexer:** Cloudflare Worker (`keeper/`). Crons `*/4` refresh the oracle baseline and `*/5` index events.
- **Read model:** Neon Postgres (`db/schema.sql`). The app falls back to RPC logs when the database is not configured.
- **Cross-chain:** NEAR Intents 1Click API.

## Repository

```
contracts/   Foundry: src/, test/ (unit, fuzz, edge, invariant), script/Deploy.s.sol, deployments/
src/app/     Next.js app: landing, /app, /faucet, /docs, /dev/scenarios, API routes
src/lib/     chain config, ABI, wagmi, hooks (useLengo, useActivity), 1Click client, DB, indexer
keeper/      Cloudflare Worker: oracle keeper + event indexer
db/          Postgres schema
scripts/     migrations, e2e fork checks, testnet proof scripts, deployment replay
docs/        HANDOFF (release package), M5 BTC research, recording guide
```

## Run locally

```bash
npm install
cp .env.example .env.local     # fill NEXT_PUBLIC_LENGO_* from contracts/deployments/46630.json
npm run dev                    # http://localhost:3000
```

Without contract addresses the app runs in **demo mode** and labels every number as simulated. Optional:

```bash
npm run db:migrate             # create the Neon schema (needs DATABASE_URL)
npm run replay:deploy          # animated replay of the real testnet deployment (sends nothing)
```

## Contracts

```bash
cd contracts
forge build
forge test
```

**24 tests pass:**
- 12 unit and fuzz tests: HF fixture 1.875, LTV caps, stale oracle, Repay All with no dust, lender interest, two-wallet liquidation, bad debt, faucet cooldown.
- 11 edge-case tests: HF exactly 1, donation and first-depositor attacks, rounding, close-factor repeats, owner-only oracle.
- 6 invariants over 128,000 random calls.

`scripts/e2e-fork.sh` runs 16 end-to-end checks against the deployed contracts on a local fork.

### Deploy (testnet only)

```bash
cd contracts
PRIVATE_KEY=<testnet-only key> forge script script/Deploy.s.sol --rpc-url rh_testnet --broadcast
```

The script refuses any chain except 46630 and local anvil. Use a throwaway wallet funded with RH testnet ETH. Never use a key that holds real assets.

### Keeper

```bash
cd keeper
npx wrangler deploy            # secrets: KEEPER_PRIVATE_KEY, DATABASE_URL (wrangler secret put …)
```

Set `KEEPER_ON = "false"` in `keeper/wrangler.toml` to pause price refreshes, for example during a liquidation demo with a price override.

## Limits in v0.1

- **Testnet only.** tBTC has no Bitcoin backing, and tUSDC is not Circle USDC. Demo assets have no value.
- **Contracts are not audited.**
- **Demo oracle.** Prices come from a keeper-maintained baseline, not a market feed. Overrides emit `demoOverride = true`.
- **Route preview only.** It never executes a swap or issues a deposit address. 1Click quotes are mainnet market estimates.
- Native BTC/ZEC collateral, private positions and executed cross-chain payouts are on the roadmap.
