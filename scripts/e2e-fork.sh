#!/usr/bin/env bash
# End-to-end check of the DEPLOYED Lengo contracts on a local anvil fork of RH testnet.
# No real funds or keys: uses anvil's public dev accounts and impersonates the oracle owner on the fork only.
#   anvil --fork-url https://rpc.testnet.chain.robinhood.com --port 8548 --chain-id 46630
#   ./scripts/e2e-fork.sh
set -euo pipefail
RPC=${RPC:-http://127.0.0.1:8548}
M=0xA4f36BEb211186C42B0A6B50Cf85DB062C5e5E25
TBTC=0x2e179ff76ef528821f2dE00D7079F1999ccdEB88
TUSDC=0xe1f1C4292C7AED0D0E99DD1233607e776826762d
ORACLE=0x7e4B30ef399EFE0fab110Ad9ADc3b39c8d19D5cE
OWNER=$(cast call $ORACLE "owner()(address)" --rpc-url $RPC)
# anvil dev accounts (public, fork-only)
A=0x70997970C51812dc3A010C7d01b50e0d17dc79C8; AK=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
B=0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC; BK=0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a

pass=0; fail=0
ok(){ echo "  ✓ $1"; pass=$((pass+1)); }
bad(){ echo "  ✗ $1"; fail=$((fail+1)); }
send(){ cast send "$@" --rpc-url $RPC >/dev/null; }
pos(){ cast call $M "getPosition(address)(uint256,uint256,uint256,uint256,uint256)" $1 --rpc-url $RPC | tr '\n' ' ' | sed 's/ \[[^]]*\]//g'; }
num(){ echo "$1" | awk '{print $1}'; }
refresh(){ send $ORACLE "setPrice(address,uint256,bool)" $TBTC ${1:-10000000000000} ${2:-false} --from $OWNER --unlocked
           send $ORACLE "setPrice(address,uint256,bool)" $TUSDC 100000000 false --from $OWNER --unlocked; }

cast rpc anvil_impersonateAccount $OWNER --rpc-url $RPC >/dev/null
cast rpc anvil_setBalance $OWNER 0x56BC75E2D63100000 --rpc-url $RPC >/dev/null
refresh

echo "M1 · lending lifecycle (wallet A)"
send $TBTC "faucet()" --private-key $AK
send $TUSDC "faucet()" --private-key $AK
[ "$(num "$(cast call $TBTC 'balanceOf(address)(uint256)' $A --rpc-url $RPC)")" = "50000000" ] && ok "faucet minted 0.5 tBTC" || bad "faucet tBTC"
if cast send $TBTC "faucet()" --private-key $AK --rpc-url $RPC >/dev/null 2>&1; then bad "faucet cooldown not enforced"; else ok "second faucet within 24h reverts"; fi

send $TBTC "approve(address,uint256)" $M 10000000 --private-key $AK
send $M "depositCollateral(uint256)" 10000000 --private-key $AK
ok "deposit 0.1 tBTC"
if cast send $M "borrow(uint256)" 6000000001 --private-key $AK --rpc-url $RPC >/dev/null 2>&1; then bad "borrow above 60% LTV allowed"; else ok "borrow above 60% LTV reverts"; fi
send $M "borrow(uint256)" 4000000000 --private-key $AK
P=$(pos $A); HF=$(echo $P | awk '{print $3}')
[ "$HF" = "1875000000000000000" ] && ok "borrow 4,000 tUSDC → HF 1.875 (brief fixture)" || bad "HF after borrow = $HF"

send $TBTC "approve(address,uint256)" $M 2000000 --private-key $AK
send $M "depositCollateral(uint256)" 2000000 --private-key $AK
HF2=$(pos $A | awk '{print $3}'); [ "$HF2" \> "1875000000000000000" ] && ok "top-up 0.02 tBTC raises HF to $(cast to-unit $HF2 ether)" || bad "top-up HF"

send $TUSDC "approve(address,uint256)" $M 1000000000 --private-key $AK
send $M "repay(uint256)" 1000000000 --private-key $AK
D=$(pos $A | awk '{print $2}'); [ "$D" -lt 3000100000 ] && ok "partial repay 1,000 → debt $(cast to-unit $D mwei | cut -c1-9) tUSDC" || bad "partial repay debt $D"

cast rpc evm_increaseTime 2592000 --rpc-url $RPC >/dev/null; cast rpc evm_mine --rpc-url $RPC >/dev/null   # 30 days
D30=$(pos $A | awk '{print $2}'); [ "$D30" -gt "$D" ] && ok "30 days of 8% APR accrued: $(cast to-unit $D30 mwei | cut -c1-9) tUSDC" || bad "no accrual"
if cast send $M "borrow(uint256)" 1000000 --private-key $AK --rpc-url $RPC >/dev/null 2>&1; then bad "borrow allowed on stale oracle"; else ok "borrow blocked on stale oracle"; fi

send $TUSDC "approve(address,uint256)" $M $((D30 * 1001 / 1000)) --private-key $AK
send $M "repay(uint256)" 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff --private-key $AK
[ "$(pos $A | awk '{print $2}')" = "0" ] && ok "Repay All with stale oracle → debt exactly 0 (no dust)" || bad "dust left"
send $M "withdrawCollateral(uint256)" 12000000 --private-key $AK
[ "$(pos $A | awk '{print $1}')" = "0" ] && ok "Withdraw All with stale oracle → 0.12 tBTC back" || bad "withdraw all"

echo "M2 · liquidation (borrower A, liquidator B)"
refresh
send $TBTC "approve(address,uint256)" $M 10000000 --private-key $AK
send $M "depositCollateral(uint256)" 10000000 --private-key $AK
send $M "borrow(uint256)" 5500000000 --private-key $AK
send $TUSDC "faucet()" --private-key $BK
if cast send $M "liquidate(address,uint256)" $A 1000000000 --private-key $BK --rpc-url $RPC >/dev/null 2>&1; then bad "healthy position liquidated"; else ok "healthy position (HF $(cast to-unit $(pos $A | awk '{print $3}') ether | cut -c1-5)) cannot be liquidated"; fi
refresh 7000000000000 true
HFL=$(pos $A | awk '{print $3}'); ok "demo price override → \$70,000, HF $(cast to-unit $HFL ether | cut -c1-6)"
B0=$(num "$(cast call $TBTC 'balanceOf(address)(uint256)' $B --rpc-url $RPC)")
DB=$(pos $A | awk '{print $2}')
send $TUSDC "approve(address,uint256)" $M 3000000000 --private-key $BK
send $M "liquidate(address,uint256)" $A 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff --private-key $BK
B1=$(num "$(cast call $TBTC 'balanceOf(address)(uint256)' $B --rpc-url $RPC)")
DA=$(pos $A | awk '{print $2}')
SEIZED=$((B1 - B0)); REPAID=$((DB - DA))
[ "$REPAID" -le $(( (DB + 1) / 2 )) ] && ok "close factor: repaid $(cast to-unit $REPAID mwei | cut -c1-8) of $(cast to-unit $DB mwei | cut -c1-8) tUSDC (≤50%)" || bad "close factor exceeded"
EXP=$(( REPAID * 105 / 100 * 100000000 / 70000 / 1000000 ))   # repaid USD × 1.05 / $70k, in tBTC units
[ $(( SEIZED - EXP < 0 ? EXP - SEIZED : SEIZED - EXP )) -le 2 ] && ok "liquidator B received $(cast to-unit $SEIZED 8 | cut -c1-10) tBTC (incl. 5% bonus)" || bad "seized $SEIZED expected ~$EXP"

S=$(num "$(cast call $M 'totalSupplyAssets()(uint256)' --rpc-url $RPC)"); I=$(num "$(cast call $M 'idle()(uint256)' --rpc-url $RPC)"); T=$(num "$(cast call $M 'totalDebt()(uint256)' --rpc-url $RPC)")
GAP=$(( S - I - T )); [ ${GAP#-} -le 1 ] && ok "accounting: claims = idle + debt (Δ $GAP)" || bad "accounting gap $GAP"

echo; echo "$pass passed, $fail failed"
[ $fail -eq 0 ]
