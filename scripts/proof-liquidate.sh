#!/usr/bin/env bash
# Finishes the M2 proof: waits until BOTH oracle prices are fresh, then wallet B liquidates wallet A.
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

age(){ local at; at=$(cast call $ORACLE "getPrice(address)(uint256,uint256)" $1 --rpc-url $RPC 2>/dev/null | sed -n 2p | awk '{print $1}'); echo $(( $(date +%s) - at )); }
pos(){ cast call $M "getPosition(address)(uint256,uint256,uint256,uint256,uint256)" $E2E_A_ADDR --rpc-url $RPC 2>/dev/null | awk '{print $1}' | tr '\n' ' '; }

until [ "$(age $TBTC)" -le 280 ] && [ "$(age $TUSDC)" -le 280 ]; do
  echo "waiting: tBTC age $(age $TBTC)s, tUSDC age $(age $TUSDC)s (click \$70,000 again in /dev/scenarios)"; sleep 15
done
echo "before: $(pos)"
B0=$(cast call $TBTC "balanceOf(address)(uint256)" $E2E_B_ADDR --rpc-url $RPC | awk '{print $1}')
H=$(cast send $M "liquidate(address,uint256)" $E2E_A_ADDR $MAX --private-key "$E2E_B_KEY" --rpc-url $RPC --json | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);if(j.status!=='0x1')process.exit(1);console.log(j.transactionHash)})")
B1=$(cast call $TBTC "balanceOf(address)(uint256)" $E2E_B_ADDR --rpc-url $RPC | awk '{print $1}')
echo "✓ liquidate ≤50%  $EXP/$H"
echo "after:  $(pos)"
echo "liquidator received $((B1 - B0)) tBTC units (8 dec)"

SRC=$OUT; [ -f "$OUT.tmp" ] && SRC="$OUT.tmp"
node -e "const fs=require('fs');const a=fs.existsSync(process.argv[1])?JSON.parse(fs.readFileSync(process.argv[1])):[];a.push({step:'liquidate ≤50%',tx:process.argv[3]});fs.writeFileSync(process.argv[2],JSON.stringify(a,null,2))" "$SRC" "$OUT" "$H"
rm -f "$OUT.tmp"
curl -s -X POST http://localhost:3000/api/index/sync >/dev/null || true
echo "Proof written to $OUT"
