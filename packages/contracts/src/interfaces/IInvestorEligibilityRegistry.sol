// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Minimal eligibility view consumed by the demo bond token.
/// @dev This is a simulation boundary, not an ONCHAINID or ERC-3643 identity registry.
interface IInvestorEligibilityRegistry {
    function isEligible(address investor) external view returns (bool);
}

