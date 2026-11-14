// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Testnet-only demo token with a capped, rate-limited faucet. Has no value and no backing.
contract TestToken is ERC20 {
    uint8 private immutable _dec;
    uint256 public immutable faucetAmount;
    uint256 public immutable faucetCooldown;
    mapping(address => uint256) public lastMint;

    error FaucetCooldown(uint256 nextAt);

    constructor(string memory name_, string memory symbol_, uint8 dec_, uint256 faucetAmount_, uint256 cooldown_)
        ERC20(name_, symbol_)
    {
        _dec = dec_;
        faucetAmount = faucetAmount_;
        faucetCooldown = cooldown_;
    }

    function decimals() public view override returns (uint8) {
        return _dec;
    }

    function faucet() external {
        uint256 next = lastMint[msg.sender] + faucetCooldown;
        if (lastMint[msg.sender] != 0 && block.timestamp < next) revert FaucetCooldown(next);
        lastMint[msg.sender] = block.timestamp;
        _mint(msg.sender, faucetAmount);
    }
}
