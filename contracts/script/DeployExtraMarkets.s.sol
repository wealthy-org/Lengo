// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ChainlinkOracle} from "../src/ChainlinkOracle.sol";
import {LengoMarket} from "../src/LengoMarket.sol";

/// @notice Registers 6 additional Chainlink feeds on the existing ChainlinkOracle and deploys 6 isolated LengoMarket contracts:
/// cbBTC/USDG, WBTC/USDG, USDe/USDG, NVDA/USDG, TSLA/USDG, AAPL/USDG on Robinhood Chain Mainnet (4663).
contract DeployExtraMarkets is Script {
    address constant EXISTING_ORACLE = 0xAc892397986B84ff42894739F05fE884D1D4c6da;
    address constant EXISTING_WETH_MARKET = 0x8f1CDFEa078D84d0a2f974c658f71CF4B54c5900;
    address constant USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;

    struct Spec {
        string key;
        address token;
        address feed;
        uint64 maxStaleness;
        uint256 maxLtv;
        uint256 liqThreshold;
        uint256 aprWad;
        uint256 collCap;
        uint256 supCap;
    }

    function run() external {
        require(block.chainid == 4663 || block.chainid == 31337, "Robinhood Chain Mainnet (4663) only");
        uint256 pk = vm.envUint("PRIVATE_KEY");
        ChainlinkOracle oracle = ChainlinkOracle(vm.envOr("MAINNET_ORACLE", EXISTING_ORACLE));

        Spec[6] memory specs = [
            Spec({
                key: "cbBTC",
                token: 0xCEC185eB182c47d1bA1EFc84e6959e18cd620Be4,
                feed: 0x0009cD492adf8167f9eEBf1293556A673530a21a,
                maxStaleness: 90_000,
                maxLtv: 0.65e18,
                liqThreshold: 0.78e18,
                aprWad: 0.075e18,
                collCap: 1e8,       // 1 cbBTC beta cap (~$60k)
                supCap: 50_000e6
            }),
            Spec({
                key: "WBTC",
                token: 0x6bac06600D220Ac5Ac281AD1f504D2Cf0F90F6e6,
                feed: 0x62107b0d3adA75fc1697fD342d99eed947a3aA5E,
                maxStaleness: 90_000,
                maxLtv: 0.65e18,
                liqThreshold: 0.78e18,
                aprWad: 0.075e18,
                collCap: 1e8,       // 1 WBTC beta cap (~$60k)
                supCap: 50_000e6
            }),
            Spec({
                key: "USDe",
                token: 0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34,
                feed: 0xb9fB4e65744E4178894f7C61CF80E8a48A5f224a,
                maxStaleness: 7_200,
                maxLtv: 0.80e18,
                liqThreshold: 0.88e18,
                aprWad: 0.065e18,
                collCap: 50_000 ether,
                supCap: 50_000e6
            }),
            Spec({
                key: "NVDA",
                token: 0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC,
                feed: 0x321A36e441DfBadA01Aa6f9884F14a344E133D1F,
                maxStaleness: 90_000,
                maxLtv: 0.50e18,
                liqThreshold: 0.65e18,
                aprWad: 0.09e18,
                collCap: 300 ether, // 300 NVDA shares (~$45k)
                supCap: 50_000e6
            }),
            Spec({
                key: "TSLA",
                token: 0x322F0929c4625eD5bAd873c95208D54E1c003b2d,
                feed: 0x39eDf5ef54150A30d2C4F1b982FbB8f93050BC37,
                maxStaleness: 90_000,
                maxLtv: 0.50e18,
                liqThreshold: 0.65e18,
                aprWad: 0.09e18,
                collCap: 150 ether, // 150 TSLA shares (~$57k)
                supCap: 50_000e6
            }),
            Spec({
                key: "AAPL",
                token: 0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9,
                feed: 0x6B22A786bAa607d76728168703a39Ea9C99f2cD0,
                maxStaleness: 90_000,
                maxLtv: 0.55e18,
                liqThreshold: 0.70e18,
                aprWad: 0.085e18,
                collCap: 150 ether, // 150 AAPL shares (~$53k)
                supCap: 50_000e6
            })
        ];

        address[6] memory deployed;

        vm.startBroadcast(pk);
        for (uint256 i = 0; i < specs.length; i++) {
            Spec memory sp = specs[i];
            oracle.setFeed(sp.token, sp.feed, sp.maxStaleness);
            LengoMarket mkt = new LengoMarket(LengoMarket.Params({
                collateral: sp.token,
                debtAsset: USDG,
                oracle: address(oracle),
                maxLtv: sp.maxLtv,
                liqThreshold: sp.liqThreshold,
                liqBonus: 0.05e18,
                closeFactor: 0.50e18,
                aprWad: sp.aprWad,
                maxOracleAge: sp.maxStaleness
            }));
            mkt.setCaps(sp.collCap, sp.supCap);
            deployed[i] = address(mkt);
            console2.log(sp.key, address(mkt));
        }
        vm.stopBroadcast();

        string memory mObj = "mkts";
        vm.serializeAddress(mObj, "WETH", EXISTING_WETH_MARKET);
        for (uint256 i = 0; i < specs.length; i++) {
            string memory mkJson = vm.serializeAddress(mObj, specs[i].key, deployed[i]);
            if (i + 1 == specs.length) {
                string memory root = "root";
                vm.serializeUint(root, "chainId", block.chainid);
                vm.serializeAddress(root, "oracle", address(oracle));
                vm.serializeAddress(root, "debtAsset", USDG);
                string memory finalJson = vm.serializeString(root, "markets", mkJson);
                vm.writeJson(finalJson, "./deployments/4663-markets.json");
            }
        }
    }
}
