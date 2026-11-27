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
| ChainlinkOracle adapter (`ChainlinkOracle` → 7 Chainlink feeds + `$1.00` USDG peg) | ✅ Live onchain (`0xAc892397986B84ff42894739F05fE884D1D4c6da` · `Ownable2Step`) |
| Cross-chain payout via NEAR Intents 1Click | ✅ Preview & Live settlement (`USDG` RH → `USDC` Solana/Base) |
| Testnet sandbox (`tBTC / tUSDC`, chain `46630`) | ✅ Live for risk & liquidation testing |
| Native BTC / ZEC collateral | 🔬 Research ([docs/M5-BTC-SPIKE.md](docs/M5-BTC-SPIKE.md)) |
| Security review | ✅ Independent security review by HEY Research Lab (not a formal audit · capped beta) |

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

### Live Mainnet Proofs (`4663` & Solana)

| Flow | Details | Explorer Proof |
|---|---|---|
| **Supply `USDG`** | `2.00 USDG` seeded into `WETH/USDG` pool (block `122,693,997`) | [`0x04887e2d…f0d7`](https://robinhoodchain.blockscout.com/tx/0x04887e2dd03391090f3f90eb170bba562955d76122e24bdafb2fbf73f715f0d7) |
| **Deposit `WETH` → Borrow `USDG`** | `0.0001 WETH` deposit + `USDG` borrow (block `122,705,021`) | [`0x57356f96…5f4d`](https://robinhoodchain.blockscout.com/tx/0x57356f96ef1e9bebc9345de9530628c919faf2f9348c082f83b62cb240435f4d) |
| **Repay All → Withdraw `WETH`** | Zero-dust full repay + `0.0001 WETH` exit (block `122,705,887`) | [`0x1123391f…a2f7`](https://robinhoodchain.blockscout.com/tx/0x1123391fe9d0a87e5c2146b2cb577573b022bc48dbc31f1f37ff625e0416a2f7) |
| **1Click `USDG` Deposit (RH)** | `1.00 USDG` ERC-20 transfer to 1Click (block `123,473,713`) | [`0xc6684d36…9644`](https://robinhoodchain.blockscout.com/tx/0xc6684d3643a3d0378129c7b2ed80de1f44851e8ae71d4dcbb520b52016d09644) |
| **NEAR Intents Settlement** | `SUCCESS` (`0x0D650Ee3D0961B376a9b90fB12e5fE0BD9D46283`) | [`View on NEAR Intents`](https://explorer.near-intents.org/transactions/0x0D650Ee3D0961B376a9b90fB12e5fE0BD9D46283) |
| **Solana `USDC` Payout** | `0.806257 USDC` delivered on Solana Mainnet | [`PWUk1xC3…7RUwV`](https://solscan.io/tx/PWUk1xC3DdzyGvPZu9rVviDkj1EpNapzftXxjWPWwpfdFf6PyRMAWkmZqWbp8oCgk4jhuJFDgqz8pRzZV77RUwV) |
| **Base `USDC` Payout** | `0.30 USDG` (RH block `123,532,715`) → `0.296513 USDC` on Base | [`0xa484…a7f0`](https://robinhoodchain.blockscout.com/tx/0xa484f312f7419d09f0d64fd85bcaff29394ed072d53603c510f2d523cf77a7f0) · [`Base ↗`](https://basescan.org/tx/0x7e4f2eb4a67b2e083993793c4154ce34a23781d6f03e1b866b5e3e78b4c2cd0d) |
| **Seed RWA · `NVDA/USDG`** | `USDG` liquidity supplied to `NVDA` market (block `123,528,008`) | [`0xef3a519a…8cfe`](https://robinhoodchain.blockscout.com/tx/0xef3a519afa18f8c11b68ff13348a11bbbffe3dd2255f83cdaa96d6befed58cfe) |
| **Seed RWA · `TSLA/USDG`** | `USDG` liquidity supplied to `TSLA` market (block `123,528,282`) | [`0x3ba93b61…352b`](https://robinhoodchain.blockscout.com/tx/0x3ba93b6139f3be8c253c9b3a678bfaa2f084dbbb617bfa01980aeec24f24352b) |
| **Seed RWA · `AAPL/USDG`** | `USDG` liquidity supplied to `AAPL` market (block `123,528,546`) | [`0xefce4d41…5ec7`](https://robinhoodchain.blockscout.com/tx/0xefce4d41320bf3d7175043d6dbfbe0720c7f18390bd3b36db2b08922bed05ec7) |
| **Cross-Chain Repay (`USDG`)** | Zero-dust full repay via `/app/routes` Step 2 (block `123,537,392`) | [`0x88a0e4bf…44c8`](https://robinhoodchain.blockscout.com/tx/0x88a0e4bfdfa2b444d205b3f8b125afab714346d86a864451e5a36aa8e55844c8) · [`Approve ↗`](https://robinhoodchain.blockscout.com/tx/0x7ba90b1015824c8088bdcd7e8b5608302aefa4438953b781d4b9c081f61a8be3) |
| **Post-Repay Collateral Exit** | `0.0010 WETH` unlocked & withdrawn via `/app/routes` Step 3 (block `123,542,369`) | [`0x563d35bd…b41f`](https://robinhoodchain.blockscout.com/tx/0x563d35bd6f8dbb8e56c1029e04dda04f164b2ba1bdd893e216d22195b6aab41f) |

## How it works

```
 Cross-chain Inflow             Robinhood Chain Mainnet (4663)           14+ Chain Payout & Repay
┌─────────────────────┐      ┌──────────────────────────────────┐      ┌──────────────────────────┐
│ SOL / USDC / BTC    │─────▶│ 7 Isolated LengoMarket Pools     │─────▶│ NEAR Intents 1Click      │
│ via 1Click → WETH   │      │ WETH · cbBTC · WBTC · USDe       │      │ USDG → USDC / USDT / DAI │
└─────────────────────┘      │ NVDA · TSLA · AAPL / USDG debt   │◀─────│ Repay USDG from any chain│
                             └────────────────▲─────────────────┘      └──────────────────────────┘
                                              │ latestRoundData() (keeperless)
                             ┌────────────────┴─────────────────┐
                             │ ChainlinkOracle Adapter          │
                             │ Official Chainlink Feeds + Peg   │
                             └──────────────────────────────────┘
```

- **One isolated market per collateral.** Collateral is never lent out as lender cash; invariant tests enforce this across all 7 Crypto & RWA Stock markets.
- **Debt shares with a borrow index (RAY).** Interest accrues per second into a global RAY index. Repay All (`type(uint256).max`) clears debt to exact zero with no dust.
- **Lender shares with a virtual offset**, blunting first-depositor inflation and donation attacks.
- **Keeperless Chainlink guard.** Borrowing and withdrawals that leave debt require a fresh Chainlink round within the market's heartbeat window. Repay and debt-free exit remain permanently open.
- **Liquidation** opens at HF < 1.00, repays up to 50% of debt per call, and pays the liquidator a 5% collateral bonus.

### Mainnet market parameters (`4663`)

| Market | Category | Max LTV | Liq. Threshold | Borrow APR | Liquidator Bonus | Close Factor |
|---|---|---|---|---|---|---|
| `WETH / USDG` | Crypto | 60% | 75% | 8.0% | 5% | 50% |
| `cbBTC / USDG` | Crypto | 65% | 78% | 7.5% | 5% | 50% |
| `WBTC / USDG` | Crypto | 65% | 78% | 7.5% | 5% | 50% |
| `USDe / USDG` | Stable | 80% | 88% | 6.5% | 5% | 50% |
| `NVDA / USDG` | RH Stock | 50% | 65% | 9.0% | 5% | 50% |
| `TSLA / USDG` | RH Stock | 50% | 65% | 9.0% | 5% | 50% |
| `AAPL / USDG` | RH Stock | 55% | 70% | 8.5% | 5% | 50% |

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
| `/` | Landing terminal, live proof stream, interactive risk calculator |
| `/app` | Markets: 7 isolated Crypto & RWA Stock pools (`WETH`, `cbBTC`, `WBTC`, `USDe`, `NVDA`, `TSLA`, `AAPL`), TradingView multi-timeframe charts (`15m/1h/4h/1d`) |
| `/app/positions` | Position Health: real-time Health Factor, Liquidation Price, remaining borrow room, LT proximity alerts, and price-shock stress simulator across all markets |
| `/app/routes` | NEAR Intents 1Click router: Cross-Chain Collateral inflow, 14+ chain `USDC`/`USDT`/`DAI` Payouts, and Any-Chain Debt Repayment (`Preview` & `Live` modes) |
| `/app/activity` | Onchain contract events & verified 1Click settlements linked directly to Blockscout / NEAR Intents |
| `/faucet` | Mint demo `tBTC` / `tUSDC` on Robinhood Chain Testnet (`46630`) |
| `/docs` | Protocol math formulas, per-market risk parameters, verified contracts, and safety disclosures |

Each transaction shows a step modal (confirm in wallet → pending → confirmed) and a toast that links to the tx on the explorer.

### API

| Route | Purpose |
|---|---|
| `GET /api/markets/stats` | Multicall3 onchain verification of active positions, borrowers, and at-risk accounts |
| `GET /api/prices/history` | Multi-timeframe (`15m`, `1h`, `4h`, `1d`) OHLCV candles from Pyth Pro / Coinbase |
| `GET /api/routes/tokens` | 1Click token discovery with ERC-20 contract addresses (cached) |
| `POST /api/routes/quote` | Server proxy to 1Click `/v0/quote` (`Preview` or `Live` mode); quotes logged with hashed addresses |
| `POST /api/routes/submit` | Submits origin-chain deposit `txHash` to 1Click `/v0/deposit/submit` & persists proof hash |
| `GET /api/routes/status` | Polls live solver & destination settlement status from 1Click `/v0/status` |
| `GET /api/activity[?account=0x…]` | Market-wide or per-account events & settled 1Click routes from the Neon read model |
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

## Current scope & safety limits

- **Capped Mainnet Beta (`4663`).** `WETH / USDG` is live under conservative beta caps (`25 WETH` collateral / `50,000 USDG` supply), with 6 additional isolated markets (`cbBTC`, `WBTC`, `USDe`, `NVDA`, `TSLA`, `AAPL`) deployed and awaiting seeding after external security review.
- **Testnet sandbox (`46630`).** `tBTC` has no Bitcoin backing, and `tUSDC` is not Circle USDC; demo assets have no value.
- **Cross-chain payout (`Preview` & `Live`).** NEAR Intents 1Click supports both read-only market quotes and live end-to-end settlement (`USDG` on Robinhood Chain → `USDC` on Solana, Base, Arbitrum, or Ethereum).
- **Native BTC/ZEC collateral** locking, proof, and redemption are currently in research ([docs/M5-BTC-SPIKE.md](docs/M5-BTC-SPIKE.md)).
