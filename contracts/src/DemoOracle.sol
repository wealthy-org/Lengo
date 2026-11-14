// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Testnet price source. Prices are USD with 8 decimals per whole token.
/// Every write is an onchain event; overrides are explicitly labeled as demo.
contract DemoOracle is Ownable {
    struct Price { uint256 price; uint256 updatedAt; }
    mapping(address => Price) public prices;

    event PriceUpdated(address indexed asset, uint256 price, uint256 updatedAt, bool demoOverride);

    constructor(address owner_) Ownable(owner_) {}

    function setPrice(address asset, uint256 price, bool demoOverride) external onlyOwner {
        require(price > 0, "price=0");
        prices[asset] = Price(price, block.timestamp);
        emit PriceUpdated(asset, price, block.timestamp, demoOverride);
    }

    function getPrice(address asset) external view returns (uint256 price, uint256 updatedAt) {
        Price memory p = prices[asset];
        return (p.price, p.updatedAt);
    }
}
