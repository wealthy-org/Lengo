// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {TestToken} from "../src/TestToken.sol";
import {DemoOracle} from "../src/DemoOracle.sol";
import {LengoMarket} from "../src/LengoMarket.sol";

contract LengoMarketTest is Test {
    TestToken tbtc; TestToken tusdc; DemoOracle oracle; LengoMarket m;
    address lender = address(0x1E);
    address bob = address(0xB0B);
    address liq = address(0x11C);

    function setUp() public {
        tbtc = new TestToken("Test BTC (no value)", "tBTC", 8, 1e8, 1 days);
        tusdc = new TestToken("Test USDC (no value)", "tUSDC", 6, 10_000e6, 1 days);
        oracle = new DemoOracle(address(this));
        oracle.setPrice(address(tbtc), 100_000e8, false);
        oracle.setPrice(address(tusdc), 1e8, false);
        m = new LengoMarket(LengoMarket.Params(address(tbtc), address(tusdc), address(oracle), 0.6e18, 0.75e18, 0.05e18, 0.5e18, 0.08e18, 300));

        deal(address(tusdc), lender, 250_000e6);
        vm.startPrank(lender); tusdc.approve(address(m), type(uint256).max); m.supply(250_000e6); vm.stopPrank();
        deal(address(tbtc), bob, 1e8);
        deal(address(tusdc), bob, 10_000e6);
        vm.startPrank(bob); tbtc.approve(address(m), type(uint256).max); tusdc.approve(address(m), type(uint256).max); vm.stopPrank();
        deal(address(tusdc), liq, 100_000e6);
        vm.prank(liq); tusdc.approve(address(m), type(uint256).max);
    }

    function _open() internal {
        vm.startPrank(bob); m.depositCollateral(0.1e8); m.borrow(4_000e6); vm.stopPrank();
    }

    function test_fixtureFromBrief() public {
        _open();
        (uint256 coll, uint256 debt, uint256 hf, uint256 cv, uint256 dv) = m.getPosition(bob);
        assertEq(coll, 0.1e8); assertEq(debt, 4_000e6);
        assertEq(cv, 10_000e8); assertEq(dv, 4_000e8);
        assertEq(hf, 1.875e18); // (10000 * 0.75) / 4000
    }

    function test_borrowBlockedAboveMaxLtv() public {
        vm.startPrank(bob); m.depositCollateral(0.1e8);
        vm.expectRevert(LengoMarket.ExceedsMaxLtv.selector); m.borrow(6_000e6 + 1);
        m.borrow(6_000e6); vm.stopPrank();
    }

    function test_borrowBlockedOnStalePrice() public {
        vm.prank(bob); m.depositCollateral(0.1e8);
        vm.warp(block.timestamp + 301);
        vm.prank(bob); vm.expectRevert(LengoMarket.StalePrice.selector); m.borrow(1_000e6);
    }

    function test_borrowBlockedWithoutLiquidity() public {
        deal(address(tbtc), bob, 10e8);
        vm.startPrank(bob); m.depositCollateral(10e8);
        vm.expectRevert(LengoMarket.InsufficientLiquidity.selector); m.borrow(250_001e6); vm.stopPrank();
    }

    function test_interestAccruesAndRepayAllLeavesNoDust() public {
        _open();
        vm.warp(block.timestamp + 365 days);
        uint256 d = m.debtOf(bob);
        assertApproxEqAbs(d, 4_320e6, 1); // 8% simple over one year
        vm.prank(bob); m.repay(type(uint256).max);
        assertEq(m.debtOf(bob), 0);
        assertEq(m.totalDebtShares(), 0);
    }

    function test_repayAndExitWorkWhenOracleStale() public {
        _open();
        vm.warp(block.timestamp + 1 days); // oracle stale
        vm.startPrank(bob);
        m.repay(type(uint256).max);
        m.withdrawCollateral(0.1e8); // debt-free exit needs no price
        vm.stopPrank();
        assertEq(tbtc.balanceOf(bob), 1e8);
    }

    function test_withdrawCollateralRespectsLtv() public {
        _open(); // 4000 debt, needs >= 6666.67 collateral value at 60%
        vm.startPrank(bob);
        vm.expectRevert(LengoMarket.ExceedsMaxLtv.selector); m.withdrawCollateral(0.04e8);
        m.withdrawCollateral(0.03e8);
        vm.stopPrank();
    }

    function test_lenderEarnsBorrowerInterest() public {
        _open();
        vm.warp(block.timestamp + 365 days);
        vm.prank(bob); m.repay(type(uint256).max);
        assertApproxEqAbs(m.claimOf(lender), 250_320e6, 2);
    }

    function test_liquidationTwoWallets() public {
        _open();
        vm.prank(liq); vm.expectRevert(LengoMarket.Healthy.selector); m.liquidate(bob, 1_000e6);
        oracle.setPrice(address(tbtc), 50_000e8, true); // demo override: HF = 5000*.75/4000 = 0.9375
        assertLt(m.healthFactor(bob), 1e18);
        uint256 before = tbtc.balanceOf(liq);
        vm.prank(liq); (uint256 repaid, uint256 seized) = m.liquidate(bob, type(uint256).max);
        assertEq(repaid, 2_000e6); // close factor 50%
        assertEq(seized, 0.042e8); // 2000 * 1.05 / 50000
        assertEq(tbtc.balanceOf(liq) - before, seized);
        assertEq(m.debtOf(bob), 2_000e6);
    }

    function test_badDebtRecognizedWhenCollateralExhausted() public {
        _open();
        oracle.setPrice(address(tbtc), 20_000e8, true); // coll worth 2000 < debt 4000
        vm.prank(liq); m.liquidate(bob, type(uint256).max);
        (uint256 coll,,,,) = m.getPosition(bob);
        assertEq(coll, 0);
        assertEq(m.debtOf(bob), 0); // residual written off as BadDebt
        assertLt(m.claimOf(lender), 250_000e6); // loss visible to lenders
    }

    function test_faucetCooldown() public {
        vm.startPrank(address(0xF));
        tbtc.faucet();
        vm.expectRevert(); tbtc.faucet();
        vm.warp(block.timestamp + 1 days); tbtc.faucet();
        vm.stopPrank();
        assertEq(tbtc.balanceOf(address(0xF)), 2e8);
    }

    function testFuzz_borrowNeverExceedsLtv(uint256 collAmt, uint256 borrowAmt) public {
        collAmt = bound(collAmt, 1e4, 1e8);
        borrowAmt = bound(borrowAmt, 1, 200_000e6);
        vm.startPrank(bob); m.depositCollateral(collAmt);
        try m.borrow(borrowAmt) {
            (, uint256 debt,, uint256 cv,) = m.getPosition(bob);
            assertLe(debt * 1e2 * 1e18, cv * 0.6e18 + 1e20); // debt USD(1e8) <= 60% coll
        } catch {}
        vm.stopPrank();
    }
}
