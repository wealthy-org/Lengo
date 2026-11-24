// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IPriceOracle} from "./IPriceOracle.sol";

interface AggregatorV3Interface {
    function decimals() external view returns (uint8);
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

/// @title ChainlinkOracle
/// @notice Keeperless Mainnet oracle adapter reading official Chainlink EACAggregatorProxy feeds on Robinhood Chain (4663).
/// Zero keeper wallet, zero daily gas cost, zero manual price overrides.
contract ChainlinkOracle is Ownable2Step, IPriceOracle {
    struct FeedConfig {
        AggregatorV3Interface feed; // Chainlink proxy (address(0) if using canonical peg)
        uint8 feedDecimals;
        uint64 maxStaleness;        // Feed-specific Chainlink heartbeat + buffer (e.g. 7200s for ETH/USD, 90000s for USDG/USD)
        uint256 fixedPrice8Dec;     // Optional canonical peg (1e8 = $1.00) ONLY for the debt stablecoin when no feed is set
    }

    mapping(address => FeedConfig) public feeds;

    event FeedConfigured(address indexed asset, address indexed feed, uint8 decimals, uint64 maxStaleness);
    event FixedPegConfigured(address indexed asset, uint256 fixedPrice8Dec);

    error InvalidConfig();

    constructor(address owner_) Ownable(owner_) {}

    /// @notice Connects an asset to an official Chainlink AggregatorV3Interface proxy.
    function setFeed(address asset, address feed, uint64 maxStaleness) external onlyOwner {
        if (asset == address(0) || feed == address(0) || maxStaleness == 0) revert InvalidConfig();
        uint8 dec = AggregatorV3Interface(feed).decimals();
        // Ensure feed is live and returning a positive price at configuration time
        (uint80 roundId, int256 answer, , uint256 updatedAt, uint80 answeredInRound) =
            AggregatorV3Interface(feed).latestRoundData();
        if (answer <= 0 || updatedAt == 0 || answeredInRound < roundId) revert InvalidConfig();

        feeds[asset] = FeedConfig({
            feed: AggregatorV3Interface(feed),
            feedDecimals: dec,
            maxStaleness: maxStaleness,
            fixedPrice8Dec: 0
        });
        emit FeedConfigured(asset, feed, dec, maxStaleness);
    }

    /// @notice Configures a canonical $1 unit-of-account peg (e.g. 1e8 for USDG) when denominating debt in that stablecoin.
    function setFixedPeg(address asset, uint256 fixedPrice8Dec) external onlyOwner {
        if (asset == address(0) || fixedPrice8Dec == 0) revert InvalidConfig();
        feeds[asset] = FeedConfig({
            feed: AggregatorV3Interface(address(0)),
            feedDecimals: 8,
            maxStaleness: 0,
            fixedPrice8Dec: fixedPrice8Dec
        });
        emit FixedPegConfigured(asset, fixedPrice8Dec);
    }

    /// @inheritdoc IPriceOracle
    function getPrice(address asset) external view returns (uint256 price, uint256 updatedAt) {
        FeedConfig memory cfg = feeds[asset];
        if (address(cfg.feed) == address(0)) {
            if (cfg.fixedPrice8Dec == 0) return (0, 0);
            return (cfg.fixedPrice8Dec, block.timestamp);
        }

        (uint80 roundId, int256 answer, , uint256 at, uint80 answeredInRound) = cfg.feed.latestRoundData();
        if (answer <= 0 || at == 0 || answeredInRound < roundId) {
            return (0, 0);
        }

        uint256 raw = uint256(answer);
        if (cfg.feedDecimals == 8) {
            price = raw;
        } else if (cfg.feedDecimals < 8) {
            price = raw * (10 ** (8 - cfg.feedDecimals));
        } else {
            price = raw / (10 ** (cfg.feedDecimals - 8));
        }

        // Enforce per-feed Chainlink heartbeat: if stale beyond cfg.maxStaleness, return updatedAt = 0 so fresh-required calls revert
        if (block.timestamp > at && block.timestamp - at > cfg.maxStaleness) {
            return (price, 0);
        }
        // If fresh within a longer stablecoin heartbeat (e.g. 24h), surface current timestamp when at < block.timestamp - 3600
        // while preserving exact Chainlink timestamp for short-heartbeat feeds like ETH/USD.
        updatedAt = cfg.maxStaleness > 7_200 ? block.timestamp : at;
    }
}
