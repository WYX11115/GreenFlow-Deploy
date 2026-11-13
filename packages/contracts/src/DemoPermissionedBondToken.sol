// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Pausable } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import { IBondTokenAdapter } from "./interfaces/IBondTokenAdapter.sol";
import { IInvestorEligibilityRegistry } from "./interfaces/IInvestorEligibilityRegistry.sol";

/// @title Demo Permissioned Green Bond Token
/// @notice A restricted, zero-decimal local token for the GreenFlow teaching demo.
/// @dev This contract is NOT ERC-3643 compliant and does not implement ONCHAINID.
contract DemoPermissionedBondToken is ERC20, ERC20Pausable, AccessControl, IBondTokenAdapter {
    bytes32 public constant MINTER_ADMIN_ROLE = keccak256("MINTER_ADMIN_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ADMIN_ROLE = keccak256("BURNER_ADMIN_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant LIFECYCLE_ADMIN_ROLE = keccak256("LIFECYCLE_ADMIN_ROLE");
    bytes32 public constant LIFECYCLE_ROLE = keccak256("LIFECYCLE_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    IInvestorEligibilityRegistry public immutable eligibilityRegistry;
    uint256 public immutable override maxSupply;
    bool public transfersFrozen;

    error InvalidAddress();
    error InvalidAmount();
    error InvestorNotEligible(address investor);
    error SupplyCapExceeded(uint256 attemptedSupply, uint256 supplyCap);
    error TransfersPermanentlyFrozen();

    constructor(address admin, IInvestorEligibilityRegistry registry, uint256 supplyCap)
        ERC20("GreenSun Solar Green Bond 2026", "GSGB")
    {
        if (admin == address(0) || address(registry) == address(0)) revert InvalidAddress();
        if (supplyCap == 0) revert InvalidAmount();

        eligibilityRegistry = registry;
        maxSupply = supplyCap;
        // Mint administration is isolated from DEFAULT_ADMIN_ROLE. A deployment can assign the
        // offering and then remove the final MINTER_ADMIN_ROLE holder, permanently sealing issuance
        // authority to the configured offering while retaining independent pause administration.
        _setRoleAdmin(MINTER_ROLE, MINTER_ADMIN_ROLE);
        _setRoleAdmin(MINTER_ADMIN_ROLE, MINTER_ADMIN_ROLE);
        _setRoleAdmin(BURNER_ROLE, BURNER_ADMIN_ROLE);
        _setRoleAdmin(BURNER_ADMIN_ROLE, BURNER_ADMIN_ROLE);
        _setRoleAdmin(LIFECYCLE_ROLE, LIFECYCLE_ADMIN_ROLE);
        _setRoleAdmin(LIFECYCLE_ADMIN_ROLE, LIFECYCLE_ADMIN_ROLE);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(BURNER_ADMIN_ROLE, admin);
        _grantRole(BURNER_ROLE, admin);
        _grantRole(LIFECYCLE_ADMIN_ROLE, admin);
        _grantRole(LIFECYCLE_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    function decimals() public pure override returns (uint8) {
        return 0;
    }

    function isEligible(address investor) public view override returns (bool) {
        return eligibilityRegistry.isEligible(investor);
    }

    function balanceOf(address investor)
        public
        view
        override(ERC20, IBondTokenAdapter)
        returns (uint256)
    {
        return super.balanceOf(investor);
    }

    function totalSupply() public view override(ERC20, IBondTokenAdapter) returns (uint256) {
        return super.totalSupply();
    }

    function mint(address investor, uint256 units) external override onlyRole(MINTER_ROLE) {
        if (units == 0) revert InvalidAmount();
        uint256 attemptedSupply = totalSupply() + units;
        if (attemptedSupply > maxSupply) {
            revert SupplyCapExceeded(attemptedSupply, maxSupply);
        }

        _mint(investor, units);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function burnFrom(address investor, uint256 units) external onlyRole(BURNER_ROLE) {
        if (units == 0) revert InvalidAmount();
        _burn(investor, units);
    }

    function freezeTransfers() external onlyRole(LIFECYCLE_ROLE) {
        transfersFrozen = true;
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Pausable)
    {
        if (transfersFrozen && from != address(0) && to != address(0)) {
            revert TransfersPermanentlyFrozen();
        }
        if (to != address(0) && !eligibilityRegistry.isEligible(to)) {
            revert InvestorNotEligible(to);
        }
        super._update(from, to, value);
    }
}

