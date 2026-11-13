// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IBondTokenAdapter } from "./IBondTokenAdapter.sol";

/// @notice Minimal lifecycle surface used by the local GreenFlow servicing vault.
interface IServicingBondToken is IBondTokenAdapter {
    function burnFrom(address investor, uint256 units) external;

    function freezeTransfers() external;

    function transfersFrozen() external view returns (bool);
}
