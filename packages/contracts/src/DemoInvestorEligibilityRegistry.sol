// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IInvestorEligibilityRegistry } from "./interfaces/IInvestorEligibilityRegistry.sol";

/// @title Demo Investor Eligibility Registry
/// @notice Stores fictional eligibility flags for the localhost demonstration.
/// @dev This is not KYC, ONCHAINID, an ERC-3643 Identity Registry, or a regulatory attestation.
contract DemoInvestorEligibilityRegistry is AccessControl, IInvestorEligibilityRegistry {
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    struct EligibilityRecord {
        bool active;
        bool accredited;
        uint64 claimExpiry;
        bytes2 jurisdictionCode;
    }

    mapping(address investor => EligibilityRecord record) private _records;

    error EligibilityAlreadyRevoked(address investor);
    error InvalidClaimExpiry(uint64 claimExpiry);
    error InvalidInvestor();

    event EligibilitySet(
        address indexed investor,
        bool eligible,
        uint64 claimExpiry,
        bytes2 jurisdictionCode,
        bool accredited,
        address indexed registrar
    );

    constructor(address admin) {
        if (admin == address(0)) revert InvalidInvestor();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(REGISTRAR_ROLE, admin);
    }

    function setEligibility(
        address investor,
        uint64 claimExpiry,
        bytes2 jurisdictionCode,
        bool accredited
    ) external onlyRole(REGISTRAR_ROLE) {
        if (investor == address(0)) revert InvalidInvestor();
        // Demo expiry intentionally follows local chain time; Phase 6 must define production clock policy.
        // forge-lint: disable-next-line(block-timestamp)
        if (claimExpiry <= block.timestamp) revert InvalidClaimExpiry(claimExpiry);

        _records[investor] = EligibilityRecord({
            active: true,
            accredited: accredited,
            claimExpiry: claimExpiry,
            jurisdictionCode: jurisdictionCode
        });

        emit EligibilitySet(investor, true, claimExpiry, jurisdictionCode, accredited, msg.sender);
    }

    function revokeEligibility(address investor) external onlyRole(REGISTRAR_ROLE) {
        EligibilityRecord storage record = _records[investor];
        if (!record.active) revert EligibilityAlreadyRevoked(investor);

        record.active = false;
        emit EligibilitySet(
            investor,
            false,
            record.claimExpiry,
            record.jurisdictionCode,
            record.accredited,
            msg.sender
        );
    }

    function isEligible(address investor) public view override returns (bool) {
        EligibilityRecord memory record = _records[investor];
        // Eligibility expiration is a timestamp rule by design.
        // forge-lint: disable-next-line(block-timestamp)
        return record.active && record.claimExpiry > block.timestamp;
    }

    function getEligibility(address investor) external view returns (EligibilityRecord memory) {
        return _records[investor];
    }
}

