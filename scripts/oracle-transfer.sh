#!/usr/bin/env bash
# One-time: hand DemoOracle ownership from the deploy wallet to the keeper wallet.
# Run with the CURRENT owner (deploy wallet) key:
#   read -s "PRIVATE_KEY?Deploy key: " && export PRIVATE_KEY && ./scripts/oracle-transfer.sh 0xKEEPER_ADDRESS
# After this, price overrides in /dev/scenarios must be done with the keeper wallet.
set -euo pipefail
: "${PRIVATE_KEY:?set PRIVATE_KEY (current oracle owner)}"
NEW=${1:?usage: oracle-transfer.sh <keeper address>}
RPC=https://rpc.testnet.chain.robinhood.com
ORACLE=0x7e4B30ef399EFE0fab110Ad9ADc3b39c8d19D5cE
echo "owner before: $(cast call $ORACLE 'owner()(address)' --rpc-url $RPC)"
cast send $ORACLE "transferOwnership(address)" "$NEW" --rpc-url $RPC --private-key "$PRIVATE_KEY" | grep -E "transactionHash|status"
echo "owner after:  $(cast call $ORACLE 'owner()(address)' --rpc-url $RPC)"
