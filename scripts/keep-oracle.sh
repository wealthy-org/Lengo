#!/usr/bin/env bash
# Testnet oracle keeper: re-posts the demo prices every 4 minutes so the 300s freshness window stays open.
# Run with the oracle owner's TESTNET key:  read -s PRIVATE_KEY && export PRIVATE_KEY && ./scripts/keep-oracle.sh
set -euo pipefail
: "${PRIVATE_KEY:?set PRIVATE_KEY (testnet oracle owner)}"
RPC=https://rpc.testnet.chain.robinhood.com
ORACLE=0x7e4B30ef399EFE0fab110Ad9ADc3b39c8d19D5cE
TBTC=0x2e179ff76ef528821f2dE00D7079F1999ccdEB88
TUSDC=0xe1f1C4292C7AED0D0E99DD1233607e776826762d
BTC_PRICE=${BTC_PRICE:-10000000000000}   # $100,000 with 8 decimals
while true; do
  cast send $ORACLE "setPrice(address,uint256,bool)" $TBTC $BTC_PRICE false --rpc-url $RPC --private-key "$PRIVATE_KEY" >/dev/null
  cast send $ORACLE "setPrice(address,uint256,bool)" $TUSDC 100000000 false --rpc-url $RPC --private-key "$PRIVATE_KEY" >/dev/null
  echo "$(date '+%H:%M:%S') prices refreshed"
  sleep 240
done
