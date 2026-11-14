// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {DemoOracle} from "./DemoOracle.sol";

/// @title LengoMarket
/// @notice One isolated market: one collateral asset, one debt asset, one aggregate position per wallet.
/// Debt uses shares over a global borrow index (fixed APR, simple per-second accrual folded into the index).
/// Lenders hold supply shares over (idle liquidity + outstanding debt). No protocol reserve in v0.1.
contract LengoMarket is ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Math for uint256;

    uint256 internal constant WAD = 1e18;
    uint256 internal constant RAY = 1e27;
    uint256 internal constant YEAR = 365 days;
    uint256 internal constant VIRTUAL_SHARES = 1e6; // inflation-attack offset
    uint256 internal constant VIRTUAL_ASSETS = 1;

    IERC20 public immutable collateral;
    IERC20 public immutable debtAsset;
    DemoOracle public immutable oracle;
    uint8 public immutable collDec;
    uint8 public immutable debtDec;

    // risk parameters (WAD)
    uint256 public immutable maxLtv;          // 0.60e18
    uint256 public immutable liqThreshold;    // 0.75e18
    uint256 public immutable liqBonus;        // 0.05e18
    uint256 public immutable closeFactor;     // 0.50e18
    uint256 public immutable aprWad;          // 0.08e18
    uint256 public immutable maxOracleAge;    // seconds

    // global state
    uint256 public borrowIndex = RAY;
    uint256 public lastAccrual;
    uint256 public totalDebtShares;
    uint256 public totalSupplyShares;
    uint256 public idle; // debt asset held for lenders/borrowers

    struct Position { uint256 collateral; uint256 debtShares; }
    mapping(address => Position) public positions;
    mapping(address => uint256) public supplyShares;

    event Accrued(uint256 borrowIndex, uint256 timestamp);
    event CollateralDeposited(address indexed account, uint256 assets);
    event CollateralWithdrawn(address indexed account, uint256 assets);
    event Borrowed(address indexed account, uint256 assets, uint256 shares);
    event Repaid(address indexed payer, address indexed account, uint256 assets, uint256 shares);
    event Supplied(address indexed account, uint256 assets, uint256 shares);
    event SupplyWithdrawn(address indexed account, uint256 assets, uint256 shares);
    event Liquidated(address indexed liquidator, address indexed borrower, uint256 repaid, uint256 seized);
    event BadDebt(address indexed borrower, uint256 assets);

    error ZeroAmount();
    error InsufficientLiquidity();
    error ExceedsMaxLtv();
    error StalePrice();
    error Healthy();
    error InsufficientCollateral();

    struct Params {
        address collateral; address debtAsset; address oracle;
        uint256 maxLtv; uint256 liqThreshold; uint256 liqBonus; uint256 closeFactor; uint256 aprWad; uint256 maxOracleAge;
    }

    constructor(Params memory p) {
        require(p.maxLtv < p.liqThreshold && p.liqThreshold < WAD, "params");
        collateral = IERC20(p.collateral);
        debtAsset = IERC20(p.debtAsset);
        oracle = DemoOracle(p.oracle);
        collDec = IERC20Metadata(p.collateral).decimals();
        debtDec = IERC20Metadata(p.debtAsset).decimals();
        maxLtv = p.maxLtv; liqThreshold = p.liqThreshold; liqBonus = p.liqBonus;
        closeFactor = p.closeFactor; aprWad = p.aprWad; maxOracleAge = p.maxOracleAge;
        lastAccrual = block.timestamp;
    }

    // ---------------------------------------------------------------- accrual

    function _projectedIndex() internal view returns (uint256) {
        uint256 dt = block.timestamp - lastAccrual;
        if (dt == 0 || totalDebtShares == 0) return borrowIndex;
        return borrowIndex + borrowIndex.mulDiv(aprWad * dt, WAD * YEAR);
    }

    function accrue() public {
        uint256 idx = _projectedIndex();
        if (idx != borrowIndex) { borrowIndex = idx; emit Accrued(idx, block.timestamp); }
        lastAccrual = block.timestamp;
    }

    function totalDebt() public view returns (uint256) {
        return totalDebtShares.mulDiv(_projectedIndex(), RAY, Math.Rounding.Ceil);
    }

    function debtOf(address a) public view returns (uint256) {
        return positions[a].debtShares.mulDiv(_projectedIndex(), RAY, Math.Rounding.Ceil);
    }

    function totalSupplyAssets() public view returns (uint256) {
        return idle + totalDebtShares.mulDiv(_projectedIndex(), RAY);
    }

    // ---------------------------------------------------------------- pricing

    function _price(address asset, bool requireFresh) internal view returns (uint256 p) {
        uint256 at;
        (p, at) = oracle.getPrice(asset);
        if (requireFresh && (p == 0 || block.timestamp - at > maxOracleAge)) revert StalePrice();
    }

    /// @dev USD value with 8 decimals.
    function _collValue(uint256 amt, bool fresh) internal view returns (uint256) {
        return amt.mulDiv(_price(address(collateral), fresh), 10 ** collDec);
    }

    function _debtValue(uint256 amt, bool fresh) internal view returns (uint256) {
        return amt.mulDiv(_price(address(debtAsset), fresh), 10 ** debtDec, Math.Rounding.Ceil);
    }

    /// @return hf health factor in WAD; type(uint256).max when no debt
    function healthFactor(address a) public view returns (uint256) {
        uint256 d = debtOf(a);
        if (d == 0) return type(uint256).max;
        return _collValue(positions[a].collateral, false).mulDiv(liqThreshold, _debtValue(d, false));
    }

    function _checkLtv(address a) internal view {
        uint256 d = debtOf(a);
        if (d == 0) return;
        if (_debtValue(d, true) * WAD > _collValue(positions[a].collateral, true) * maxLtv) revert ExceedsMaxLtv();
    }

    // ---------------------------------------------------------------- borrower

    function depositCollateral(uint256 assets) external nonReentrant {
        if (assets == 0) revert ZeroAmount();
        positions[msg.sender].collateral += assets;
        collateral.safeTransferFrom(msg.sender, address(this), assets);
        emit CollateralDeposited(msg.sender, assets);
    }

    function withdrawCollateral(uint256 assets) external nonReentrant {
        if (assets == 0) revert ZeroAmount();
        accrue();
        Position storage p = positions[msg.sender];
        if (assets > p.collateral) revert InsufficientCollateral();
        p.collateral -= assets;
        _checkLtv(msg.sender); // debt-free exit skips oracle entirely
        collateral.safeTransfer(msg.sender, assets);
        emit CollateralWithdrawn(msg.sender, assets);
    }

    function borrow(uint256 assets) external nonReentrant {
        if (assets == 0) revert ZeroAmount();
        accrue();
        if (assets > idle) revert InsufficientLiquidity();
        uint256 shares = assets.mulDiv(RAY, borrowIndex, Math.Rounding.Ceil);
        positions[msg.sender].debtShares += shares;
        totalDebtShares += shares;
        idle -= assets;
        _checkLtv(msg.sender); // fresh price required: a borrow never passes on a stale feed
        debtAsset.safeTransfer(msg.sender, assets);
        emit Borrowed(msg.sender, assets, shares);
    }

    /// @notice Repays up to `maxAssets`, capped at actual debt. Pass type(uint256).max for Repay All (no dust).
    function repay(uint256 maxAssets) external nonReentrant returns (uint256 paid) {
        return _repay(msg.sender, msg.sender, maxAssets);
    }

    function _repay(address payer, address account, uint256 maxAssets) internal returns (uint256 paid) {
        accrue();
        Position storage p = positions[account];
        uint256 debt = p.debtShares.mulDiv(borrowIndex, RAY, Math.Rounding.Ceil);
        if (debt == 0 || maxAssets == 0) revert ZeroAmount();
        uint256 shares;
        if (maxAssets >= debt) { paid = debt; shares = p.debtShares; }
        else { paid = maxAssets; shares = maxAssets.mulDiv(RAY, borrowIndex); }
        p.debtShares -= shares;
        totalDebtShares -= shares;
        idle += paid;
        debtAsset.safeTransferFrom(payer, address(this), paid);
        emit Repaid(payer, account, paid, shares);
    }

    // ---------------------------------------------------------------- lender

    function _toShares(uint256 assets, Math.Rounding r) internal view returns (uint256) {
        return assets.mulDiv(totalSupplyShares + VIRTUAL_SHARES, totalSupplyAssets() + VIRTUAL_ASSETS, r);
    }

    function _toAssets(uint256 shares, Math.Rounding r) internal view returns (uint256) {
        return shares.mulDiv(totalSupplyAssets() + VIRTUAL_ASSETS, totalSupplyShares + VIRTUAL_SHARES, r);
    }

    function claimOf(address a) external view returns (uint256) { return _toAssets(supplyShares[a], Math.Rounding.Floor); }

    function supply(uint256 assets) external nonReentrant returns (uint256 shares) {
        if (assets == 0) revert ZeroAmount();
        accrue();
        shares = _toShares(assets, Math.Rounding.Floor);
        if (shares == 0) revert ZeroAmount();
        supplyShares[msg.sender] += shares;
        totalSupplyShares += shares;
        idle += assets;
        debtAsset.safeTransferFrom(msg.sender, address(this), assets);
        emit Supplied(msg.sender, assets, shares);
    }

    function withdrawSupply(uint256 assets) external nonReentrant returns (uint256 shares) {
        if (assets == 0) revert ZeroAmount();
        accrue();
        if (assets > idle) revert InsufficientLiquidity();
        shares = _toShares(assets, Math.Rounding.Ceil);
        supplyShares[msg.sender] -= shares; // reverts on underflow
        totalSupplyShares -= shares;
        idle -= assets;
        debtAsset.safeTransfer(msg.sender, assets);
        emit SupplyWithdrawn(msg.sender, assets, shares);
    }

    // ---------------------------------------------------------------- liquidation

    function liquidate(address borrower, uint256 maxRepayAssets) external nonReentrant returns (uint256 repaid, uint256 seized) {
        accrue();
        if (healthFactor(borrower) >= WAD) revert Healthy();
        Position storage p = positions[borrower];
        uint256 debt = debtOf(borrower);
        uint256 cap = debt.mulDiv(closeFactor, WAD, Math.Rounding.Ceil);
        repaid = Math.min(maxRepayAssets, cap);
        if (repaid == 0) revert ZeroAmount();

        uint256 pc = _price(address(collateral), true);
        uint256 pd = _price(address(debtAsset), true);
        // seize = repaid value * (1 + bonus) / collateral price
        seized = repaid.mulDiv(pd, 10 ** debtDec).mulDiv(WAD + liqBonus, WAD).mulDiv(10 ** collDec, pc);
        if (seized > p.collateral) {
            // collateral exhausted: shrink repay to what the collateral covers
            seized = p.collateral;
            repaid = seized.mulDiv(pc, 10 ** collDec).mulDiv(WAD, WAD + liqBonus).mulDiv(10 ** debtDec, pd, Math.Rounding.Ceil);
            if (repaid > debt) repaid = debt;
        }
        _repay(msg.sender, borrower, repaid);
        p.collateral -= seized;
        collateral.safeTransfer(msg.sender, seized);
        emit Liquidated(msg.sender, borrower, repaid, seized);

        // residual bad debt: recognized as a loss to lenders, never hidden
        if (p.collateral == 0 && p.debtShares > 0) {
            uint256 bad = p.debtShares.mulDiv(borrowIndex, RAY, Math.Rounding.Ceil);
            totalDebtShares -= p.debtShares;
            p.debtShares = 0;
            emit BadDebt(borrower, bad);
        }
    }

    // ---------------------------------------------------------------- views for UI

    function getPosition(address a) external view returns (uint256 coll, uint256 debt, uint256 hf, uint256 collValueUsd, uint256 debtValueUsd) {
        coll = positions[a].collateral;
        debt = debtOf(a);
        hf = healthFactor(a);
        collValueUsd = _collValue(coll, false);
        debtValueUsd = debt == 0 ? 0 : _debtValue(debt, false);
    }

    function getMarketState() external view returns (uint256 supplied, uint256 borrowed, uint256 available, uint256 index, uint256 collPrice, uint256 collPriceAt) {
        borrowed = totalDebt();
        available = idle;
        supplied = totalSupplyAssets();
        index = _projectedIndex();
        (collPrice, collPriceAt) = oracle.getPrice(address(collateral));
    }
}
