// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Stable issuance boundary for the Phase 2 BondOffering.
/// @dev The Phase 1 demo token implements this interface directly. A future audited
///      T-REX integration can provide the same business-facing adapter surface.
interface IBondTokenAdapter {
    function isEligible(address investor) external view returns (bool);

    function balanceOf(address investor) external view returns (uint256);

    function totalSupply() external view returns (uint256);

    function maxSupply() external view returns (uint256);

    function mint(address investor, uint256 units) external;
}

