#!/usr/bin/env bash
set -euo pipefail

# Deploys 6 additional isolated markets (cbBTC, WBTC, USDe, NVDA, TSLA, AAPL / USDG)
# on Robinhood Chain Mainnet (4663) using https://4663.rpc.thirdweb.com (no VPN required).
# Total gas cost: ~0.00025 ETH (~$0.42 / ~Rp 6.800).
# Usage:
#   PRIVATE_KEY=0x... ./scripts/deploy-extra-markets.sh

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RPC="${RH_MAINNET_RPC:-https://4663.rpc.thirdweb.com}"

if [[ -z "${PRIVATE_KEY:-}" ]]; then
  echo "Error: PRIVATE_KEY is required (e.g. PRIVATE_KEY=0x... ./scripts/deploy-extra-markets.sh)"
  exit 1
fi

cd "$ROOT/contracts"
echo "==> Broadcasting 6 additional Mainnet markets via $RPC..."
forge script script/DeployExtraMarkets.s.sol --rpc-url "$RPC" --broadcast

echo "==> Submitting Sourcify verification for newly deployed LengoMarket instances..."
node -e '
const fs = require("fs");
const { execSync } = require("child_process");
const m = JSON.parse(fs.readFileSync("./deployments/4663-markets.json", "utf8")).markets || {};
for (const [k, addr] of Object.entries(m)) {
  if (!addr || k === "WETH") continue;
  try {
    console.log("Verifying", k, addr);
    execSync(`forge verify-contract ${addr} src/LengoMarket.sol:LengoMarket --chain-id 4663 --verifier sourcify`, { stdio: "inherit" });
  } catch {}
}
'
echo "✅ All 7 Mainnet markets recorded in contracts/deployments/4663-markets.json!"
