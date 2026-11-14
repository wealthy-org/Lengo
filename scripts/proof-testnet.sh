#!/usr/bin/env bash
# Real RH testnet proof run (M1 lifecycle + M2 liquidation) with the throwaway wallets in .env.e2e.
# Oracle stays with its owner: keep ./scripts/keep-oracle.sh running for phase 1,
# and set the $70,000 demo override yourself when phase 2 asks (via /dev/scenarios).
# Writes every tx hash to contracts/deployments/proof-46630.json.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env.e2e; set +a
RPC=https://rpc.testnet.chain.robinhood.com
EXP=https://explorer.testnet.chain.robinhood.com/tx
M=0xA4f36BEb211186C42B0A6B50Cf85DB062C5e5E25
TBTC=0x2e179ff76ef528821f2dE00D7079F1999ccdEB88
TUSDC=0xe1f1C4292C7AED0D0E99DD1233607e776826762d
ORACLE=0x7e4B30ef399EFE0fab110Ad9ADc3b39c8d19D5cE
OUT=contracts/deployments/proof-46630.json
MAX=0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
echo "[]" > "$OUT.tmp"

tx(){ # label, key, to, sig, args...
  local label=$1 key=$2; shift 2
  local h; h=$(cast send "$@" --private-key "$key" --rpc-url $RPC --json | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);if(j.status!=='0x1')process.exit(1);console.log(j.transactionHash)})")
  echo "  ✓ $label  $EXP/$h"
  node -e "const f=process.argv[1];const a=JSON.parse(require('fs').readFileSync(f));a.push({step:process.argv[2],tx:process.argv[3]});require('fs').writeFileSync(f,JSON.stringify(a,null,2))" "$OUT.tmp" "$label" "$h"
}
pos(){ cast call $M "getPosition(address)(uint256,uint256,uint256,uint256,uint256)" $1 --rpc-url $RPC | awk '{print $1}' | tr '\n' ' '; }
fresh(){ # wait until the oracle price is <= 240s old
  while :; do
    local at; at=$(cast call $ORACLE "getPrice(address)(uint256,uint256)" $TBTC --rpc-url $RPC | sed -n 2p | awk '{print $1}')
    [ $(( $(date +%s) - at )) -le 240 ] && break
    echo "  … oracle stale; start ./scripts/keep-oracle.sh (or press Refresh in /dev/scenarios)"; sleep 20
  done; }
price(){ cast call $ORACLE "getPrice(address)(uint256,uint256)" $TBTC --rpc-url $RPC | head -1 | awk '{print $1}'; }

for w in $E2E_A_ADDR $E2E_B_ADDR; do
  b=$(cast balance $w --rpc-url $RPC); [ "$b" = "0" ] && { echo "No gas on $w yet. Fund both wallets first."; exit 1; }
done

echo "M1 · lifecycle · borrower A $E2E_A_ADDR"
tx "faucet tBTC" $E2E_A_KEY $TBTC "faucet()"
tx "faucet tUSDC" $E2E_A_KEY $TUSDC "faucet()"
tx "approve 0.12 tBTC" $E2E_A_KEY $TBTC "approve(address,uint256)" $M 12000000
tx "deposit 0.1 tBTC" $E2E_A_KEY $M "depositCollateral(uint256)" 10000000
fresh
tx "borrow 4,000 tUSDC" $E2E_A_KEY $M "borrow(uint256)" 4000000000
echo "    position (coll, debt, hf): $(pos $E2E_A_ADDR)"
tx "top-up 0.02 tBTC" $E2E_A_KEY $M "depositCollateral(uint256)" 2000000
tx "approve tUSDC for repay" $E2E_A_KEY $TUSDC "approve(address,uint256)" $M 4010000000
tx "partial repay 1,000 tUSDC" $E2E_A_KEY $M "repay(uint256)" 1000000000
tx "repay all" $E2E_A_KEY $M "repay(uint256)" $MAX
tx "withdraw all 0.12 tBTC" $E2E_A_KEY $M "withdrawCollateral(uint256)" 12000000
echo "    position after exit: $(pos $E2E_A_ADDR)"

echo "M2 · liquidation · borrower A, liquidator B $E2E_B_ADDR"
tx "approve 0.1 tBTC" $E2E_A_KEY $TBTC "approve(address,uint256)" $M 10000000
tx "deposit 0.1 tBTC" $E2E_A_KEY $M "depositCollateral(uint256)" 10000000
fresh
tx "borrow 5,500 tUSDC" $E2E_A_KEY $M "borrow(uint256)" 5500000000
tx "liquidator faucet tUSDC" $E2E_B_KEY $TUSDC "faucet()"
tx "liquidator approve tUSDC" $E2E_B_KEY $TUSDC "approve(address,uint256)" $M 3000000000
echo "    before: $(pos $E2E_A_ADDR)"
echo "  → Now STOP keep-oracle.sh and click \$70,000 in /dev/scenarios with the oracle owner wallet."
until [ "$(price)" = "7000000000000" ]; do sleep 10; done
echo "  ✓ demo price override seen: tBTC = \$70,000"
tx "liquidate ≤50%" $E2E_B_KEY $M "liquidate(address,uint256)" $E2E_A_ADDR $MAX
echo "    after:  $(pos $E2E_A_ADDR)"
echo "    liquidator tBTC: $(cast call $TBTC 'balanceOf(address)(uint256)' $E2E_B_ADDR --rpc-url $RPC | awk '{print $1}')"

mv "$OUT.tmp" "$OUT"
curl -s -X POST http://localhost:3000/api/index/sync >/dev/null || true
echo; echo "Proof written to $OUT. Restore the price with Refresh/\$100,000 when done."
