#!/usr/bin/env bash
set -euo pipefail

# Lengo Mainnet Deployment Helper — Robinhood Chain Mainnet (4663)
# Usage:
#   PRIVATE_KEY=0x... GUARDIAN_ADDRESS=0x... ./scripts/deploy-mainnet.sh

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RPC="${RH_MAINNET_RPC:-https://rpc.mainnet.chain.robinhood.com}"

if [[ -z "${PRIVATE_KEY:-}" ]]; then
  echo "Error: PRIVATE_KEY is required (e.g. PRIVATE_KEY=0x... ./scripts/deploy-mainnet.sh)"
  exit 1
fi

echo "==> Checking Robinhood Chain Mainnet RPC ($RPC)..."
CHAIN_ID="$(cast chain-id --rpc-url "$RPC")"
if [[ "$CHAIN_ID" != "4663" ]]; then
  echo "Error: Expected chain ID 4663, got $CHAIN_ID"
  exit 1
fi

DEPLOYER="$(cast wallet address --private-key "$PRIVATE_KEY")"
BAL_WEI="$(cast balance "$DEPLOYER" --rpc-url "$RPC")"
echo "==> Deployer: $DEPLOYER (balance: $(cast from-wei "$BAL_WEI") ETH)"

cd "$ROOT/contracts"
echo "==> Broadcasting DeployMainnet.s.sol to Robinhood Chain Mainnet (4663)..."
forge script script/DeployMainnet.s.sol \
  --rpc-url "$RPC" \
  --broadcast \
  --verify \
  --verifier blockscout \
  --verifier-url "https://robinhoodchain.blockscout.com/api/"

MANIFEST="$ROOT/contracts/deployments/4663.json"
if [[ -f "$MANIFEST" ]]; then
  MARKET="$(node -e "console.log(JSON.parse(require('fs').readFileSync('$MANIFEST','utf8')).market)")"
  ORACLE="$(node -e "console.log(JSON.parse(require('fs').readFileSync('$MANIFEST','utf8')).oracle)")"
  START_BLOCK="$(node -e "const r=JSON.parse(require('fs').readFileSync('$ROOT/contracts/broadcast/DeployMainnet.s.sol/4663/run-latest.json','utf8')).receipts; console.log(parseInt(r[0].blockNumber,16))")"
  echo ""
  echo "✅ Mainnet deployment complete!"
  echo "NEXT_PUBLIC_NETWORK=mainnet"
  echo "NEXT_PUBLIC_LENGO_MAINNET_MARKET=$MARKET"
  echo "NEXT_PUBLIC_LENGO_MAINNET_ORACLE=$ORACLE"
  echo "NEXT_PUBLIC_LENGO_MAINNET_START_BLOCK=$START_BLOCK"
fi
