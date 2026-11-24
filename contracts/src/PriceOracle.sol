// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IPriceOracle} from "./IPriceOracle.sol";

/// @title PriceOracle
/// @notice Mainnet price feed receiver with role separation (owner vs keeper), sanity bounds,
/// and per-update deviation circuit breakers. Prices are USD with 8 decimals per whole token.
/// No demo override path exists on this contract.
contract PriceOracle is Ownable2Step, IPriceOracle {
    struct Price {
        uint256 price;
        uint256 updatedAt;
    }

    struct Bounds {
        uint256 minPrice;
        uint256 maxPrice;
        uint256 maxDeviationBps; // max single-step keeper move in bps (e.g. 1500 = 15%)
    }

    address public keeper;
    mapping(address => Price) public prices;
    mapping(address => Bounds) public bounds;

    event KeeperUpdated(address indexed previousKeeper, address indexed newKeeper);
    event BoundsUpdated(address indexed asset, uint256 minPrice, uint256 maxPrice, uint256 maxDeviationBps);
    event PriceUpdated(address indexed asset, uint256 price, uint256 updatedAt);

    error Unauthorized();
    error InvalidPrice();
    error InvalidBounds();
    error PriceOutOfBounds(uint256 price, uint256 minPrice, uint256 maxPrice);
    error ExcessiveDeviation(uint256 previousPrice, uint256 newPrice, uint256 maxDeviationBps);

    constructor(address owner_, address keeper_) Ownable(owner_) {
        keeper = keeper_ == address(0) ? owner_ : keeper_;
        emit KeeperUpdated(address(0), keeper);
    }

    function setKeeper(address newKeeper) external onlyOwner {
        emit KeeperUpdated(keeper, newKeeper);
        keeper = newKeeper;
    }

    function setBounds(address asset, uint256 minPrice, uint256 maxPrice, uint256 maxDeviationBps) external onlyOwner {
        if (minPrice == 0 || maxPrice < minPrice || maxDeviationBps > 10_000) revert InvalidBounds();
        bounds[asset] = Bounds(minPrice, maxPrice, maxDeviationBps);
        emit BoundsUpdated(asset, minPrice, maxPrice, maxDeviationBps);
    }

    /// @notice Posts a live market price. Keeper updates must stay within configured bounds & deviation limits.
    function setPrice(address asset, uint256 price) external {
        bool isOwn = msg.sender == owner();
        if (!isOwn && msg.sender != keeper) revert Unauthorized();
        if (price == 0) revert InvalidPrice();

        Bounds memory b = bounds[asset];
        if (b.maxPrice != 0 && (price < b.minPrice || price > b.maxPrice)) {
            revert PriceOutOfBounds(price, b.minPrice, b.maxPrice);
        }

        uint256 prev = prices[asset].price;
        if (!isOwn && prev != 0 && b.maxDeviationBps != 0) {
            uint256 diff = price > prev ? price - prev : prev - price;
            if (diff * 10_000 > prev * b.maxDeviationBps) {
                revert ExcessiveDeviation(prev, price, b.maxDeviationBps);
            }
        }

        prices[asset] = Price(price, block.timestamp);
        emit PriceUpdated(asset, price, block.timestamp);
    }

    function getPrice(address asset) external view returns (uint256 price, uint256 updatedAt) {
        Price memory p = prices[asset];
        return (p.price, p.updatedAt);
    }
}
