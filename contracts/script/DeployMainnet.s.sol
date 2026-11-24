// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ChainlinkOracle} from "../src/ChainlinkOracle.sol";
import {LengoMarket} from "../src/LengoMarket.sol";

/// @notice Deploys Keeperless ChainlinkOracle + LengoMarket (WETH / USDG) to Robinhood Chain Mainnet (4663).
/// Zero keeper needed — reads official Chainlink ETH/USD EACAggregatorProxy directly onchain!
/// Usage:
///   cd contracts
///   PRIVATE_KEY=0x... forge script script/DeployMainnet.s.sol \
///     --rpc-url rh_mainnet --broadcast \
///     --verify --verifier blockscout --verifier-url https://robinhoodchain.blockscout.com/api/
contract DeployMainnet is Script {
    // Official Robinhood Chain Mainnet (4663) contracts
    address constant WETH_MAINNET = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73; // 18 dec
    address constant USDG_MAINNET = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168; // 6 dec
    address constant CHAINLINK_ETH_USD = 0x78F3556b67E17Df817D51Ef5a990cDaF09E8d3A9; // EACAggregatorProxy (8 dec)

    function run() external {
        require(block.chainid == 4663 || block.chainid == 31337, "Robinhood Chain Mainnet (4663) only");

        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address guardian = vm.envOr("GUARDIAN_ADDRESS", deployer);

        address weth = vm.envOr("COLLATERAL_TOKEN", WETH_MAINNET);
        address usdg = vm.envOr("DEBT_TOKEN", USDG_MAINNET);
        address ethFeed = vm.envOr("CHAINLINK_ETH_FEED", CHAINLINK_ETH_USD);
        address usdgFeed = vm.envOr("CHAINLINK_USDG_FEED", address(0)); // optional Chainlink USDG/USD proxy

        // Conservative beta TVL caps (25 WETH collateral, 50,000 USDG supply)
        uint256 collCap = vm.envOr("COLLATERAL_CAP", uint256(25 ether));
        uint256 supCap = vm.envOr("SUPPLY_CAP", uint256(50_000e6));
        uint64 ethHeartbeat = uint64(vm.envOr("MAX_ORACLE_AGE", uint256(7_200))); // 2h window for Chainlink 1h ETH/USD heartbeat

        vm.startBroadcast(pk);

        ChainlinkOracle oracle = new ChainlinkOracle(guardian);
        oracle.setFeed(weth, ethFeed, ethHeartbeat);
        if (usdgFeed != address(0)) {
            oracle.setFeed(usdg, usdgFeed, 90_000); // 25h window for Chainlink 24h stablecoin heartbeat
        } else {
            oracle.setFixedPeg(usdg, 1e8); // $1.00 Global Dollar unit-of-account peg
        }

        LengoMarket market = new LengoMarket(LengoMarket.Params({
            collateral: weth,
            debtAsset: usdg,
            oracle: address(oracle),
            maxLtv: 0.60e18,
            liqThreshold: 0.75e18,
            liqBonus: 0.05e18,
            closeFactor: 0.50e18,
            aprWad: 0.08e18,
            maxOracleAge: ethHeartbeat
        }));

        market.setCaps(collCap, supCap);
        if (guardian != deployer) {
            market.setGuardian(guardian);
        }

        vm.stopBroadcast();

        string memory o = "mainnet";
        vm.serializeUint(o, "chainId", block.chainid);
        vm.serializeAddress(o, "collateral", weth);
        vm.serializeAddress(o, "debtAsset", usdg);
        vm.serializeAddress(o, "chainlinkEthUsd", ethFeed);
        vm.serializeAddress(o, "oracle", address(oracle));
        vm.serializeAddress(o, "guardian", guardian);
        vm.serializeUint(o, "collateralCap", collCap);
        vm.serializeUint(o, "supplyCap", supCap);
        string memory json = vm.serializeAddress(o, "market", address(market));
        vm.writeJson(json, string.concat("./deployments/", vm.toString(block.chainid), ".json"));

        console2.log("ChainlinkOracle:", address(oracle));
        console2.log("LengoMarket:", address(market));
    }
}
