// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { BondOffering } from "../src/BondOffering.sol";
import { BondServicingVault } from "../src/BondServicingVault.sol";
import { DemoInvestorEligibilityRegistry } from "../src/DemoInvestorEligibilityRegistry.sol";
import { DemoPermissionedBondToken } from "../src/DemoPermissionedBondToken.sol";
import { GreenTreasury } from "../src/GreenTreasury.sol";
import { MockUSD } from "../src/MockUSD.sol";
import { IServicingBondToken } from "../src/interfaces/IServicingBondToken.sol";

interface Vm {
    function startBroadcast() external;

    function stopBroadcast() external;
}

/// @notice Clean deterministic Phase 4 deployment for the standard local Anvil account order.
/// @dev Leaves offering, treasury and servicing lifecycle untouched for browser presentation.
contract DeployPhase4 {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 private constant USD = 1_000_000;
    address private constant ADMIN = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
    address private constant ISSUER = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
    address private constant VERIFIER = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC;
    address private constant ALICE = 0x90F79bf6EB2c4f870365E785982E1f101E93b906;
    address private constant BOB = 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65;
    address private constant CHARLIE = 0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc;

    function run()
        external
        returns (
            MockUSD mockUsd,
            DemoInvestorEligibilityRegistry registry,
            DemoPermissionedBondToken bond,
            GreenTreasury treasury,
            BondOffering offering,
            BondServicingVault servicingVault
        )
    {
        vm.startBroadcast();

        // Deployment order preserves every Phase 2 address and appends the servicing vault.
        mockUsd = new MockUSD(ADMIN);
        registry = new DemoInvestorEligibilityRegistry(ADMIN);
        bond = new DemoPermissionedBondToken(ADMIN, registry, 10);
        treasury = new GreenTreasury(mockUsd, ADMIN, ISSUER, VERIFIER);
        offering = new BondOffering(ADMIN, ISSUER, mockUsd, bond, address(treasury));
        servicingVault = new BondServicingVault(
            mockUsd, IServicingBondToken(address(bond)), ADMIN, ISSUER, block.timestamp + 365 days
        );

        registry.setEligibility(ALICE, type(uint64).max, 0x5347, true);
        registry.setEligibility(BOB, type(uint64).max, 0x5347, true);

        mockUsd.mint(ISSUER, 1_050 * USD);
        mockUsd.mint(ALICE, 1_000 * USD);
        mockUsd.mint(BOB, 1_000 * USD);
        mockUsd.mint(CHARLIE, 1_000 * USD);

        bond.grantRole(bond.MINTER_ROLE(), address(offering));
        bond.grantRole(bond.BURNER_ROLE(), address(servicingVault));
        bond.grantRole(bond.LIFECYCLE_ROLE(), address(servicingVault));

        bond.revokeRole(bond.MINTER_ROLE(), ADMIN);
        bond.revokeRole(bond.MINTER_ADMIN_ROLE(), ADMIN);
        bond.revokeRole(bond.BURNER_ROLE(), ADMIN);
        bond.revokeRole(bond.BURNER_ADMIN_ROLE(), ADMIN);
        bond.revokeRole(bond.LIFECYCLE_ROLE(), ADMIN);
        bond.revokeRole(bond.LIFECYCLE_ADMIN_ROLE(), ADMIN);

        vm.stopBroadcast();
    }
}
