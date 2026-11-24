// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ChainlinkOracle} from "../src/ChainlinkOracle.sol";
import {PriceOracle} from "../src/PriceOracle.sol";
import {LengoMarket} from "../src/LengoMarket.sol";

contract MockAggregator {
    uint8 public immutable decimals;
    int256 public answer;
    uint256 public updatedAt;
    uint80 public roundId = 1;

    constructor(uint8 dec_, int256 answer_) {
        decimals = dec_;
        answer = answer_;
        updatedAt = block.timestamp;
    }

    function update(int256 answer_, uint256 updatedAt_) external {
        roundId++;
        answer = answer_;
        updatedAt = updatedAt_;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (roundId, answer, updatedAt, updatedAt, roundId);
    }
}

contract MockERC20 is ERC20 {
    uint8 private immutable _dec;
    constructor(string memory n, string memory s, uint8 d) ERC20(n, s) { _dec = d; }
    function decimals() public view override returns (uint8) { return _dec; }
    function mint(address to, uint256 amt) external { _mint(to, amt); }
}

contract LengoMainnetTest is Test {
    MockERC20 weth;
    MockERC20 usdg;
    PriceOracle oracle;
    LengoMarket m;

    address owner = address(0xA11CE);
    address keeper = address(0xBEEF);
    address lender = address(0x1E);
    address user = address(0xB0B);
    address liquidator = address(0x11C);

    function setUp() public {
        weth = new MockERC20("Wrapped Ether", "WETH", 18);
        usdg = new MockERC20("Global Dollar", "USDG", 6);

        vm.startPrank(owner);
        oracle = new PriceOracle(owner, keeper);
        oracle.setBounds(address(weth), 200e8, 25_000e8, 1_500); // 15% max step
        oracle.setBounds(address(usdg), 0.90e8, 1.10e8, 300);    // 3% max step
        oracle.setPrice(address(weth), 2_000e8);
        oracle.setPrice(address(usdg), 1e8);

        m = new LengoMarket(LengoMarket.Params({
            collateral: address(weth),
            debtAsset: address(usdg),
            oracle: address(oracle),
            maxLtv: 0.60e18,
            liqThreshold: 0.75e18,
            liqBonus: 0.05e18,
            closeFactor: 0.50e18,
            aprWad: 0.08e18,
            maxOracleAge: 900
        }));
        m.setCaps(10 ether, 50_000e6);
        vm.stopPrank();

        usdg.mint(lender, 40_000e6);
        vm.startPrank(lender);
        usdg.approve(address(m), type(uint256).max);
        m.supply(40_000e6);
        vm.stopPrank();

        weth.mint(user, 20 ether);
        usdg.mint(user, 5_000e6);
        vm.startPrank(user);
        weth.approve(address(m), type(uint256).max);
        usdg.approve(address(m), type(uint256).max);
        vm.stopPrank();

        usdg.mint(liquidator, 20_000e6);
        vm.prank(liquidator);
        usdg.approve(address(m), type(uint256).max);
    }

    function test_weth18DecAndUsdg6DecAccounting() public {
        vm.startPrank(user);
        m.depositCollateral(2 ether); // $4,000 collateral
        m.borrow(1_600e6);            // $1,600 debt -> LTV 40%, HF = (4000 * 0.75) / 1600 = 1.875
        vm.stopPrank();

        (uint256 coll, uint256 debt, uint256 hf, uint256 cv, uint256 dv) = m.getPosition(user);
        assertEq(coll, 2 ether);
        assertEq(debt, 1_600e6);
        assertEq(cv, 4_000e8);
        assertEq(dv, 1_600e8);
        assertEq(hf, 1.875e18);
    }

    function test_keeperDeviationCircuitBreaker() public {
        // Keeper can move WETH within 15% ($2,000 -> $1,750 is -12.5%)
        vm.prank(keeper);
        oracle.setPrice(address(weth), 1_750e8);

        // Compromised keeper cannot crash WETH by 50% in a single update
        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(PriceOracle.ExcessiveDeviation.selector, 1_750e8, 800e8, 1_500));
        oracle.setPrice(address(weth), 800e8);

        // Keeper cannot set price outside hard bounds
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(PriceOracle.PriceOutOfBounds.selector, 50e8, 200e8, 25_000e8));
        oracle.setPrice(address(weth), 50e8);

        // Random address cannot update oracle
        vm.prank(user);
        vm.expectRevert(PriceOracle.Unauthorized.selector);
        oracle.setPrice(address(weth), 1_750e8);
    }

    function test_capsEnforcedAndUnaffectedByDonation() public {
        // Donate 50 WETH directly to market — must NOT brick legitimate deposits under cap
        weth.mint(address(m), 50 ether);

        vm.startPrank(user);
        m.depositCollateral(10 ether); // exact cap succeeds
        vm.expectRevert(LengoMarket.CapExceeded.selector);
        m.depositCollateral(1);
        vm.stopPrank();

        // Supply cap is 50,000 USDG; 40,000 already supplied
        usdg.mint(lender, 20_000e6);
        vm.startPrank(lender);
        vm.expectRevert(LengoMarket.CapExceeded.selector);
        m.supply(10_001e6);
        m.supply(10_000e6);
        vm.stopPrank();
    }

    function test_pauseBlocksNewRiskButNeverBlocksExitOrLiquidation() public {
        vm.startPrank(user);
        m.depositCollateral(2 ether);
        m.borrow(2_200e6);
        vm.stopPrank();

        vm.prank(owner);
        m.setPaused(true);

        // New risk is blocked
        vm.startPrank(user);
        vm.expectRevert(LengoMarket.MarketPaused.selector);
        m.depositCollateral(1 ether);
        vm.expectRevert(LengoMarket.MarketPaused.selector);
        m.borrow(100e6);
        vm.stopPrank();

        vm.prank(lender);
        vm.expectRevert(LengoMarket.MarketPaused.selector);
        m.supply(100e6);

        // Liquidation STILL works while paused if price drops
        vm.prank(owner);
        oracle.setPrice(address(weth), 1_400e8); // coll = $2,800, liq = $2,100 < $2,200 -> HF < 1
        vm.prank(liquidator);
        (uint256 repaid, uint256 seized) = m.liquidate(user, type(uint256).max);
        assertGt(repaid, 0);
        assertGt(seized, 0);

        // Repay All + full collateral withdrawal + lender withdrawal STILL work while paused
        vm.startPrank(user);
        m.repay(type(uint256).max);
        uint256 rem = weth.balanceOf(user);
        (uint256 c,,,,) = m.getPosition(user);
        m.withdrawCollateral(c);
        assertEq(weth.balanceOf(user), rem + c);
        vm.stopPrank();

        vm.prank(lender);
        m.withdrawSupply(1_000e6);
    }

    function test_keeperlessChainlinkOracleMainnetFlow() public {
        vm.warp(100_000);
        MockAggregator ethAgg = new MockAggregator(8, 2_000e8); // Chainlink ETH/USD 8 dec

        vm.startPrank(owner);
        ChainlinkOracle clOracle = new ChainlinkOracle(owner);
        clOracle.setFeed(address(weth), address(ethAgg), 7_200);
        clOracle.setFixedPeg(address(usdg), 1e8);

        LengoMarket clMarket = new LengoMarket(LengoMarket.Params({
            collateral: address(weth),
            debtAsset: address(usdg),
            oracle: address(clOracle),
            maxLtv: 0.60e18,
            liqThreshold: 0.75e18,
            liqBonus: 0.05e18,
            closeFactor: 0.50e18,
            aprWad: 0.08e18,
            maxOracleAge: 7_200
        }));
        vm.stopPrank();

        usdg.mint(lender, 20_000e6);
        vm.prank(lender);
        usdg.approve(address(clMarket), type(uint256).max);
        vm.prank(lender);
        clMarket.supply(20_000e6);

        vm.startPrank(user);
        weth.approve(address(clMarket), type(uint256).max);
        clMarket.depositCollateral(1 ether); // $2,000
        clMarket.borrow(1_000e6);            // $1,000 -> HF 1.50
        vm.stopPrank();

        (, , uint256 hf, , ) = clMarket.getPosition(user);
        assertEq(hf, 1.5e18);

        // If Chainlink ETH/USD goes stale past 7,200s, new borrows revert with StalePrice() without any keeper!
        vm.warp(block.timestamp + 7_201);
        vm.prank(user);
        vm.expectRevert(LengoMarket.StalePrice.selector);
        clMarket.borrow(100e6);

        // Once Chainlink updates round onchain, borrowing & liquidation work immediately
        ethAgg.update(1_200e8, block.timestamp); // ETH drops to $1,200 -> liq threshold $900 < $1,000 debt -> HF 0.90
        vm.prank(liquidator);
        usdg.approve(address(clMarket), type(uint256).max);
        vm.prank(liquidator);
        (uint256 repaid, uint256 seized) = clMarket.liquidate(user, type(uint256).max);
        assertGt(repaid, 0);
        assertGt(seized, 0);
    }
}
