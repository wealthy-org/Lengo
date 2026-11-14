// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {TestToken} from "../src/TestToken.sol";
import {DemoOracle} from "../src/DemoOracle.sol";
import {LengoMarket} from "../src/LengoMarket.sol";

contract LengoMarketEdgeTest is Test {
    TestToken tbtc; TestToken tusdc; DemoOracle oracle; LengoMarket m;
    address lender = address(0x1E); address bob = address(0xB0B); address liq = address(0x11C); address eve = address(0xE7E);

    function setUp() public {
        tbtc = new TestToken("Test BTC", "tBTC", 8, 1e8, 1 days);
        tusdc = new TestToken("Test USDC", "tUSDC", 6, 10_000e6, 1 days);
        oracle = new DemoOracle(address(this));
        oracle.setPrice(address(tbtc), 100_000e8, false);
        oracle.setPrice(address(tusdc), 1e8, false);
        m = new LengoMarket(LengoMarket.Params(address(tbtc), address(tusdc), address(oracle), 0.6e18, 0.75e18, 0.05e18, 0.5e18, 0.08e18, 300));
        for (uint160 i = 0; i < 4; i++) {
            address a = [lender, bob, liq, eve][i];
            deal(address(tbtc), a, 10e8); deal(address(tusdc), a, 1_000_000e6);
            vm.startPrank(a); tbtc.approve(address(m), type(uint256).max); tusdc.approve(address(m), type(uint256).max); vm.stopPrank();
        }
        vm.prank(lender); m.supply(250_000e6);
    }

    function test_hfExactlyOneIsNotLiquidatable() public {
        vm.startPrank(bob); m.depositCollateral(0.1e8); m.borrow(6_000e6); vm.stopPrank();
        // HF = 0.1 * P * 0.75 / 6000 = 1  ->  P = 80,000
        oracle.setPrice(address(tbtc), 80_000e8, true);
        assertEq(m.healthFactor(bob), 1e18);
        vm.prank(liq); vm.expectRevert(LengoMarket.Healthy.selector); m.liquidate(bob, 1e6);
        oracle.setPrice(address(tbtc), 79_999e8, true);
        assertLt(m.healthFactor(bob), 1e18);
        vm.prank(liq); m.liquidate(bob, 1e6);
    }

    function test_noDebtMeansMaxHealth() public {
        vm.prank(bob); m.depositCollateral(0.1e8);
        assertEq(m.healthFactor(bob), type(uint256).max);
        (,,, , uint256 dv) = m.getPosition(bob);
        assertEq(dv, 0);
    }

    function test_cannotBorrowWithoutCollateral() public {
        vm.prank(bob); vm.expectRevert(LengoMarket.ExceedsMaxLtv.selector); m.borrow(1);
    }

    function test_donationDoesNotInflateIdleOrBreakAccounting() public {
        uint256 claimBefore = m.claimOf(lender);
        vm.prank(eve); tusdc.transfer(address(m), 50_000e6); // direct donation
        assertEq(m.idle(), 250_000e6);                       // idle ignores donations
        assertEq(m.claimOf(lender), claimBefore);            // no share-price manipulation via transfer
    }

    function test_firstDepositorInflationAttackBlunted() public {
        LengoMarket fresh = new LengoMarket(LengoMarket.Params(address(tbtc), address(tusdc), address(oracle), 0.6e18, 0.75e18, 0.05e18, 0.5e18, 0.08e18, 300));
        vm.startPrank(eve); tusdc.approve(address(fresh), type(uint256).max); fresh.supply(1); vm.stopPrank();
        vm.prank(eve); tusdc.transfer(address(fresh), 100_000e6); // donation can't move share price (idle-based)
        vm.startPrank(lender); tusdc.approve(address(fresh), type(uint256).max); uint256 shares = fresh.supply(10_000e6); vm.stopPrank();
        assertGt(shares, 0);
        assertApproxEqAbs(fresh.claimOf(lender), 10_000e6, 1);
    }

    function test_supplyWithdrawRoundTripNeverProfits() public {
        vm.startPrank(eve);
        for (uint256 i; i < 20; i++) { m.supply(1_000_003); m.withdrawSupply(1_000_003 - 1); }
        vm.stopPrank();
        assertLe(m.claimOf(eve), 20 * 1 + 20); // dust left behind, never extracted extra
        assertGe(tusdc.balanceOf(address(m)), m.idle());
    }

    function test_partialRepayRoundingFavoursPool() public {
        vm.startPrank(bob); m.depositCollateral(0.1e8); m.borrow(4_000e6); vm.stopPrank();
        vm.warp(block.timestamp + 17 days);
        vm.startPrank(bob);
        for (uint256 i; i < 10; i++) m.repay(333_333);
        m.repay(type(uint256).max);
        vm.stopPrank();
        assertEq(m.debtOf(bob), 0);
        assertEq(m.totalDebtShares(), 0);
    }

    function test_closeFactorRepeatUntilHealthy() public {
        vm.startPrank(bob); m.depositCollateral(0.1e8); m.borrow(6_000e6); vm.stopPrank();
        oracle.setPrice(address(tbtc), 70_000e8, true);
        uint256 d0 = m.debtOf(bob);
        vm.prank(liq); (uint256 r1,) = m.liquidate(bob, type(uint256).max);
        assertLe(r1, (d0 + 1) / 2);
        if (m.healthFactor(bob) < 1e18) { vm.prank(liq); m.liquidate(bob, type(uint256).max); }
        assertGe(m.healthFactor(bob), 1e18);
    }

    function test_withdrawSupplyBlockedBeyondIdle() public {
        vm.startPrank(bob); m.depositCollateral(5e8); m.borrow(200_000e6); vm.stopPrank();
        vm.prank(lender); vm.expectRevert(LengoMarket.InsufficientLiquidity.selector); m.withdrawSupply(60_000e6);
        vm.prank(lender); m.withdrawSupply(50_000e6);
    }

    function test_selfLiquidationOnlyWhenUnhealthy() public {
        vm.startPrank(bob); m.depositCollateral(0.1e8); m.borrow(5_000e6);
        vm.expectRevert(LengoMarket.Healthy.selector); m.liquidate(bob, 1e6);
        vm.stopPrank();
    }

    function test_onlyOwnerMovesOracle() public {
        vm.prank(eve); vm.expectRevert(); oracle.setPrice(address(tbtc), 1, true);
    }
}
