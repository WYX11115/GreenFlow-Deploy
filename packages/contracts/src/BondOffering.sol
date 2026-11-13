// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IBondTokenAdapter } from "./interfaces/IBondTokenAdapter.sol";

/// @title GreenFlow Bond Offering
/// @notice Sells the fixed fictional bond for MockUSD and routes proceeds to GreenTreasury.
/// @dev Payment and permissioned-token minting happen in one transaction and therefore revert
///      together. MockUSD has no value and the bond is a local teaching instrument only.
contract BondOffering is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    uint256 public constant FACE_VALUE = 100_000_000;
    uint256 public constant TOTAL_UNITS = 10;

    enum OfferingState {
        Draft,
        Open,
        Full
    }

    IERC20 public immutable paymentToken;
    IBondTokenAdapter public immutable bondToken;
    address public immutable greenTreasury;

    OfferingState public state;
    uint256 public unitsSold;
    uint256 public totalRaised;

    error InvalidAddress();
    error InvalidBondSupplyCap(uint256 actual, uint256 expected);
    error InvalidUnits();
    error OfferingNotDraft(OfferingState currentState);
    error OfferingNotOpen(OfferingState currentState);
    error InvestorNotEligible(address investor);
    error IssuanceCapExceeded(uint256 requestedUnits, uint256 remainingUnits);

    event OfferingOpened(address indexed issuer);
    event Subscribed(
        address indexed investor,
        uint256 units,
        uint256 paidAmount,
        uint256 cumulativeUnits,
        uint256 cumulativeRaised
    );
    event OfferingFilled(uint256 totalUnits, uint256 totalRaised);

    constructor(
        address admin,
        address issuer,
        IERC20 paymentToken_,
        IBondTokenAdapter bondToken_,
        address greenTreasury_
    ) {
        if (
            admin == address(0) || issuer == address(0) || address(paymentToken_) == address(0)
                || address(bondToken_) == address(0) || greenTreasury_ == address(0)
        ) revert InvalidAddress();
        if (bondToken_.maxSupply() != TOTAL_UNITS) {
            revert InvalidBondSupplyCap(bondToken_.maxSupply(), TOTAL_UNITS);
        }

        paymentToken = paymentToken_;
        bondToken = bondToken_;
        greenTreasury = greenTreasury_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ISSUER_ROLE, issuer);
    }

    function openOffering() external onlyRole(ISSUER_ROLE) {
        if (state != OfferingState.Draft) revert OfferingNotDraft(state);
        state = OfferingState.Open;
        emit OfferingOpened(msg.sender);
    }

    function subscribe(uint256 units) external nonReentrant {
        if (state != OfferingState.Open) revert OfferingNotOpen(state);
        if (units == 0) revert InvalidUnits();
        if (!bondToken.isEligible(msg.sender)) revert InvestorNotEligible(msg.sender);

        uint256 remainingUnits = TOTAL_UNITS - unitsSold;
        if (units > remainingUnits) revert IssuanceCapExceeded(units, remainingUnits);

        uint256 paymentAmount = units * FACE_VALUE;

        // If minting fails, the preceding ERC-20 transfer is reverted by EVM transaction atomicity.
        paymentToken.safeTransferFrom(msg.sender, greenTreasury, paymentAmount);
        bondToken.mint(msg.sender, units);

        unitsSold += units;
        totalRaised += paymentAmount;
        emit Subscribed(msg.sender, units, paymentAmount, unitsSold, totalRaised);

        if (unitsSold == TOTAL_UNITS) {
            state = OfferingState.Full;
            emit OfferingFilled(unitsSold, totalRaised);
        }
    }
}
