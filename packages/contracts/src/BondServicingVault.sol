// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IServicingBondToken } from "./interfaces/IServicingBondToken.sol";

/// @title GreenFlow Bond Servicing Vault
/// @notice Holds issuer-funded mock debt service separately from ring-fenced green proceeds.
/// @dev One local-demo maturity payment combines principal and final coupon atomically.
contract BondServicingVault is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    uint256 public constant FACE_VALUE = 100_000_000;
    uint256 public constant COUPON_PER_UNIT = 5_000_000;
    uint256 public constant TOTAL_UNITS = 10;
    uint256 public constant REQUIRED_FUNDING = 1_050_000_000;

    IERC20 public immutable paymentToken;
    IServicingBondToken public immutable bondToken;
    uint256 public immutable maturityTimestamp;

    uint256 public totalFunded;
    uint256 public totalPrincipalPaid;
    uint256 public totalCouponPaid;
    uint256 public totalUnitsRedeemed;
    bool public recordDateFinalized;

    mapping(address investor => bool claimed) public hasClaimed;
    mapping(address investor => uint256 units) public claimedUnits;

    error InvalidAddress();
    error InvalidMaturity();
    error InvalidAmount();
    error FundingRequirementExceeded(uint256 attempted, uint256 required);
    error BondIssuanceIncomplete(uint256 actualSupply, uint256 requiredSupply);
    error MaturityNotReached(uint256 currentTimestamp, uint256 maturityTimestamp);
    error RecordDateAlreadyFinalized();
    error RecordDateNotFinalized();
    error InvestorNotEligible(address investor);
    error NoBondEntitlement(address investor);
    error AlreadyClaimed(address investor);
    error ServicingInsufficientFunds(uint256 available, uint256 required);

    event ServicingFunded(
        address indexed issuer, uint256 amount, uint256 totalFunded, uint256 outstandingRequirement
    );
    event MaturityFinalized(uint256 indexed maturityTimestamp, uint256 indexed recordDateTimestamp);
    event MaturityPaymentClaimed(
        address indexed investor,
        uint256 units,
        uint256 principal,
        uint256 coupon,
        uint256 totalPayment
    );

    constructor(
        IERC20 paymentToken_,
        IServicingBondToken bondToken_,
        address admin,
        address issuer,
        uint256 maturityTimestamp_
    ) {
        if (
            address(paymentToken_) == address(0) || address(bondToken_) == address(0)
                || admin == address(0) || issuer == address(0)
        ) revert InvalidAddress();
        if (maturityTimestamp_ <= block.timestamp) revert InvalidMaturity();

        paymentToken = paymentToken_;
        bondToken = bondToken_;
        maturityTimestamp = maturityTimestamp_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(ISSUER_ROLE, issuer);
    }

    function fund(uint256 amount) external onlyRole(ISSUER_ROLE) nonReentrant {
        if (amount == 0) revert InvalidAmount();
        uint256 nextTotal = totalFunded + amount;
        if (nextTotal > REQUIRED_FUNDING) {
            revert FundingRequirementExceeded(nextTotal, REQUIRED_FUNDING);
        }

        totalFunded = nextTotal;
        paymentToken.safeTransferFrom(msg.sender, address(this), amount);
        emit ServicingFunded(msg.sender, amount, nextTotal, REQUIRED_FUNDING - nextTotal);
    }

    function finalizeMaturity() external onlyRole(ADMIN_ROLE) {
        if (recordDateFinalized) revert RecordDateAlreadyFinalized();
        if (block.timestamp < maturityTimestamp) {
            revert MaturityNotReached(block.timestamp, maturityTimestamp);
        }
        uint256 supply = bondToken.totalSupply();
        if (supply != TOTAL_UNITS) revert BondIssuanceIncomplete(supply, TOTAL_UNITS);

        recordDateFinalized = true;
        bondToken.freezeTransfers();
        emit MaturityFinalized(maturityTimestamp, block.timestamp);
    }

    function claimMaturityPayment() external nonReentrant {
        if (!recordDateFinalized) revert RecordDateNotFinalized();
        if (hasClaimed[msg.sender]) revert AlreadyClaimed(msg.sender);
        if (!bondToken.isEligible(msg.sender)) revert InvestorNotEligible(msg.sender);

        uint256 units = bondToken.balanceOf(msg.sender);
        if (units == 0) revert NoBondEntitlement(msg.sender);
        uint256 principal = units * FACE_VALUE;
        uint256 coupon = units * COUPON_PER_UNIT;
        uint256 totalPayment = principal + coupon;
        uint256 available = paymentToken.balanceOf(address(this));
        if (available < totalPayment) {
            revert ServicingInsufficientFunds(available, totalPayment);
        }

        hasClaimed[msg.sender] = true;
        claimedUnits[msg.sender] = units;
        totalPrincipalPaid += principal;
        totalCouponPaid += coupon;
        totalUnitsRedeemed += units;
        bondToken.burnFrom(msg.sender, units);
        paymentToken.safeTransfer(msg.sender, totalPayment);

        emit MaturityPaymentClaimed(msg.sender, units, principal, coupon, totalPayment);
    }

    function outstandingFunding() external view returns (uint256) {
        return REQUIRED_FUNDING - totalFunded;
    }

    function entitlementOf(address investor)
        external
        view
        returns (uint256 units, uint256 principal, uint256 coupon, uint256 totalPayment)
    {
        units = hasClaimed[investor] ? claimedUnits[investor] : bondToken.balanceOf(investor);
        principal = units * FACE_VALUE;
        coupon = units * COUPON_PER_UNIT;
        totalPayment = principal + coupon;
    }
}
