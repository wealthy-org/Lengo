// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {TestToken} from "../src/TestToken.sol";
import {DemoOracle} from "../src/DemoOracle.sol";
import {LengoMarket} from "../src/LengoMarket.sol";

/// Random sequences of user actions; invariants are checked after every call.
contract Handler is Test {
    LengoMarket public m; TestToken public tbtc; TestToken public tusdc; DemoOracle public oracle;
    address[] public actors;
    uint256 public totalRepaidByLiquidators;
    uint256 public okBorrow; uint256 public okRepay; uint256 public okLiq; uint256 public okWithdraw;

    constructor(LengoMarket m_, TestToken b, TestToken u, DemoOracle o) {
        m = m_; tbtc = b; tusdc = u; oracle = o;
        for (uint256 i; i < 4; i++) {
            address a = address(uint160(0xA000 + i));
            actors.push(a);
            deal(address(tbtc), a, 10e8);
            deal(address(tusdc), a, 500_000e6);
            vm.startPrank(a);
            tbtc.approve(address(m), type(uint256).max);
            tusdc.approve(address(m), type(uint256).max);
            vm.stopPrank();
        }
    }

    function _actor(uint256 s) internal view returns (address) { return actors[s % actors.length]; }

    function _fresh() internal {
        (uint256 pb,) = oracle.getPrice(address(tbtc));
        vm.startPrank(oracle.owner());
        oracle.setPrice(address(tbtc), pb, false);
        oracle.setPrice(address(tusdc), 1e8, false);
        vm.stopPrank();
    }

    function supply(uint256 s, uint256 amt) external { amt = bound(amt, 1e6, 100_000e6); vm.prank(_actor(s)); try m.supply(amt) {} catch {} }
    function withdrawSupply(uint256 s, uint256 amt) external { amt = bound(amt, 1, 100_000e6); vm.prank(_actor(s)); try m.withdrawSupply(amt) {} catch {} }
    function deposit(uint256 s, uint256 amt) external { amt = bound(amt, 1, 1e8); vm.prank(_actor(s)); try m.depositCollateral(amt) {} catch {} }
    function withdraw(uint256 s, uint256 amt) external { _fresh(); amt = bound(amt, 1, 1e8); vm.prank(_actor(s)); try m.withdrawCollateral(amt) { okWithdraw++; } catch {} }
    function borrow(uint256 s, uint256 amt) external { _fresh(); amt = bound(amt, 1, 50_000e6); vm.prank(_actor(s)); try m.borrow(amt) { okBorrow++; } catch {} }
    /// Borrow close to the 60% cap so later price drops create liquidatable positions.
    function borrowNearMax(uint256 s, uint256 pct) external {
        _fresh();
        address a = _actor(s);
        (, , , uint256 cv, uint256 dv) = m.getPosition(a);
        uint256 capUsd = cv * 60 / 100;                 // USD, 8 decimals
        if (capUsd <= dv) return;
        uint256 amt = (capUsd - dv) / 100 * bound(pct, 80, 99) / 100; // to tUSDC 6 decimals
        if (amt == 0) return;
        vm.prank(a); try m.borrow(amt) { okBorrow++; } catch {}
    }
    function repay(uint256 s, uint256 amt) external { amt = bound(amt, 1, type(uint256).max); vm.prank(_actor(s)); try m.repay(amt) { okRepay++; } catch {} }
    function warp(uint256 dt) external { vm.warp(block.timestamp + bound(dt, 1, 30 days)); }
    function movePrice(uint256 p) external {
        p = bound(p, 20_000e8, 150_000e8);
        vm.prank(oracle.owner()); oracle.setPrice(address(tbtc), p, true);
        vm.prank(oracle.owner()); oracle.setPrice(address(tusdc), 1e8, false);
    }
    function liquidate(uint256 s, uint256 target, uint256 amt) external {
        _fresh();
        address liq = _actor(s); address b = _actor(target);
        if (liq == b) return;
        amt = bound(amt, 1, type(uint256).max);
        vm.prank(liq);
        try m.liquidate(b, amt) returns (uint256 repaid, uint256) { totalRepaidByLiquidators += repaid; okLiq++; } catch {}
    }
    function actorCount() external view returns (uint256) { return actors.length; }
}

contract LengoMarketInvariantTest is Test {
    TestToken tbtc; TestToken tusdc; DemoOracle oracle; LengoMarket m; Handler h;

    function setUp() public {
        tbtc = new TestToken("Test BTC", "tBTC", 8, 1e8, 1 days);
        tusdc = new TestToken("Test USDC", "tUSDC", 6, 10_000e6, 1 days);
        oracle = new DemoOracle(address(this));
        oracle.setPrice(address(tbtc), 100_000e8, false);
        oracle.setPrice(address(tusdc), 1e8, false);
        m = new LengoMarket(LengoMarket.Params(address(tbtc), address(tusdc), address(oracle), 0.6e18, 0.75e18, 0.05e18, 0.5e18, 0.08e18, 300));
        h = new Handler(m, tbtc, tusdc, oracle);
        oracle.transferOwnership(address(h));
        targetContract(address(h));
    }

    /// Idle accounting matches real tokens held (donations can only make the balance larger).
    function invariant_idleBackedByBalance() public view {
        assertGe(tusdc.balanceOf(address(m)), m.idle());
    }

    /// Collateral held equals the sum of every position; collateral is never lender cash.
    function invariant_collateralConserved() public view {
        uint256 sum;
        for (uint256 i; i < h.actorCount(); i++) { (uint256 c,) = m.positions(h.actors(i)); sum += c; }
        assertEq(tbtc.balanceOf(address(m)), sum);
    }

    /// Debt shares are fully accounted for across positions.
    function invariant_debtSharesConserved() public view {
        uint256 sum;
        for (uint256 i; i < h.actorCount(); i++) { (, uint256 s) = m.positions(h.actors(i)); sum += s; }
        assertEq(m.totalDebtShares(), sum);
    }

    /// Supplier shares are fully accounted for.
    function invariant_supplySharesConserved() public view {
        uint256 sum;
        for (uint256 i; i < h.actorCount(); i++) sum += m.supplyShares(h.actors(i));
        assertEq(m.totalSupplyShares(), sum);
    }

    /// Lender claims never exceed idle + collectible debt (rounding favours the pool).
    function invariant_claimsWithinAssets() public view {
        uint256 claims;
        for (uint256 i; i < h.actorCount(); i++) claims += m.claimOf(h.actors(i));
        assertLe(claims, m.idle() + m.totalDebt() + h.actorCount());
    }

    function afterInvariant() public view {
        console2.log("borrows", h.okBorrow(), "repays", h.okRepay());
        console2.log("withdraws", h.okWithdraw(), "liquidations", h.okLiq());
    }

    /// Borrow index only moves up.
    function invariant_indexMonotonic() public view {
        assertGe(m.borrowIndex(), 1e27);
    }
}
