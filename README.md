# Lengo v0.1

**Live:** https://lengo-two.vercel.app · **Release package / proof index:** [docs/HANDOFF.md](docs/HANDOFF.md) · **BTC research:** [docs/M5-BTC-SPIKE.md](docs/M5-BTC-SPIKE.md)

Cross-chain lending on Robinhood Chain. Release 0.1 runs the lending lifecycle on RH testnet (chain 46630) with demo assets, plus a NEAR Intents 1Click route preview (`dry: true`, no funds moved).

## Run the app

```bash
npm install
cp .env.example .env.local   # fill contract addresses after deploying
npm run dev                  # http://localhost:3000
```

Without contract addresses the app runs in **demo mode**: the UI labels every number as simulated. Route preview always uses real 1Click discovery and quotes.

## Contracts (Foundry)

```bash
cd contracts
forge build
forge test        # 24 tests: unit, fuzz, edge cases and 6 invariants (128k random calls)
```

| Contract | Role |
|---|---|
| `TestToken` | tBTC (8 dec) and tUSDC (6 dec), capped faucet, 24h cooldown, no value |
| `DemoOracle` | USD prices (8 dec) with timestamp; overrides emit `demoOverride = true` |
| `LengoMarket` | Collateral, debt shares + borrow index, lender shares, liquidation, bad-debt recognition |

## Deploy to RH testnet

Use a **testnet-only** wallet funded with RH testnet ETH. The script refuses any chain except 46630 (and local anvil).

```bash
cd contracts
PRIVATE_KEY=<testnet key> forge script script/Deploy.s.sol --rpc-url rh_testnet --broadcast
```

The script writes `contracts/deployments/46630.json`. Copy its addresses into `.env.local` (`NEXT_PUBLIC_LENGO_*`), set `NEXT_PUBLIC_LENGO_START_BLOCK`, and restart `npm run dev`. The app then reads balances, positions and activity from the chain.

## Pages

`/` landing · `/app` markets · `/app/routes` route preview · `/app/activity` events · `/faucet` · `/docs`

API: `GET /api/routes/tokens`, `POST /api/routes/quote` (server proxy to 1Click, always `dry: true`).

## Not in v0.1

Native BTC/ZEC collateral, private positions, executed cross-chain payouts, mainnet. Contracts are not audited.
