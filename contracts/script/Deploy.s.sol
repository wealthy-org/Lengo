// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {TestToken} from "../src/TestToken.sol";
import {DemoOracle} from "../src/DemoOracle.sol";
import {LengoMarket} from "../src/LengoMarket.sol";

/// forge script script/Deploy.s.sol --rpc-url rh_testnet --broadcast
/// Env: PRIVATE_KEY (testnet-only deployer). Refuses any chain other than RH testnet 46630 or local anvil.
contract Deploy is Script {
    function run() external {
        require(block.chainid == 46630 || block.chainid == 31337, "testnet only");
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address me = vm.addr(pk);
        vm.startBroadcast(pk);

        TestToken tbtc = new TestToken("Lengo Test BTC (no value)", "tBTC", 8, 0.5e8, 1 days);
        TestToken tusdc = new TestToken("Lengo Test USDC (no value)", "tUSDC", 6, 10_000e6, 1 days);
        DemoOracle oracle = new DemoOracle(me);
        oracle.setPrice(address(tbtc), 100_000e8, false);
        oracle.setPrice(address(tusdc), 1e8, false);
        LengoMarket market = new LengoMarket(LengoMarket.Params(
            address(tbtc), address(tusdc), address(oracle), 0.6e18, 0.75e18, 0.05e18, 0.5e18, 0.08e18, 300
        ));

        // seed lender liquidity (visible tx): faucet a few times is rate-limited, so the seed uses its own mint path
        tusdc.faucet();
        tusdc.approve(address(market), type(uint256).max);
        market.supply(10_000e6);
        vm.stopBroadcast();

        string memory o = "d";
        vm.serializeUint(o, "chainId", block.chainid);
        // block.number on RH (Arbitrum Orbit) returns the L1 block; take the start block from the broadcast receipts instead
        vm.serializeAddress(o, "tBTC", address(tbtc));
        vm.serializeAddress(o, "tUSDC", address(tusdc));
        vm.serializeAddress(o, "oracle", address(oracle));
        string memory json = vm.serializeAddress(o, "market", address(market));
        vm.writeJson(json, string.concat("./deployments/", vm.toString(block.chainid), ".json"));
        console2.log("market", address(market));
    }
}
