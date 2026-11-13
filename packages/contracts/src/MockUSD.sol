// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title GreenFlow Mock USD
/// @notice Six-decimal, valueless test currency for the local GreenFlow demonstration.
/// @dev Minting is deliberately role-gated. This token is not backed, redeemable, or USDC.
contract MockUSD is ERC20, AccessControl {
    bytes32 public constant FAUCET_ROLE = keccak256("FAUCET_ROLE");

    error InvalidAmount();
    error InvalidRecipient();

    event DemoFundsMinted(address indexed recipient, uint256 amount, address indexed operator);

    constructor(address admin) ERC20("GreenFlow Mock USD", "mUSD") {
        if (admin == address(0)) revert InvalidRecipient();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(FAUCET_ROLE, admin);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address recipient, uint256 amount) external onlyRole(FAUCET_ROLE) {
        if (recipient == address(0)) revert InvalidRecipient();
        if (amount == 0) revert InvalidAmount();

        _mint(recipient, amount);
        emit DemoFundsMinted(recipient, amount, msg.sender);
    }
}

