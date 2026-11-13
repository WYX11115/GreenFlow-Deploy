// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { DemoInvestorEligibilityRegistry } from "../src/DemoInvestorEligibilityRegistry.sol";
import { DemoPermissionedBondToken } from "../src/DemoPermissionedBondToken.sol";
import { MockUSD } from "../src/MockUSD.sol";

interface Vm {
    function startBroadcast() external;

    function stopBroadcast() external;
}

/// @notice Deterministic Phase 1 deployment for the standard local Anvil account order.
contract DeployPhase1 {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 private constant USD = 1_000_000;
    address private constant ADMIN = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
    address private constant ISSUER = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
    address private constant ALICE = 0x90F79bf6EB2c4f870365E785982E1f101E93b906;
    address private constant BOB = 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65;
    address private constant CHARLIE = 0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc;

    function run()
        external
        returns (
            MockUSD mockUsd,
            DemoInvestorEligibilityRegistry registry,
            DemoPermissionedBondToken bond
        )
    {
        vm.startBroadcast();

        // Deploy first so CREATE addresses remain stable across every clean Anvil reset.
        mockUsd = new MockUSD(ADMIN);
        registry = new DemoInvestorEligibilityRegistry(ADMIN);
        bond = new DemoPermissionedBondToken(ADMIN, registry, 10);

        registry.setEligibility(ALICE, type(uint64).max, 0x5347, true);
        registry.setEligibility(BOB, type(uint64).max, 0x5347, true);

        mockUsd.mint(ISSUER, 1_050 * USD);
        mockUsd.mint(ALICE, 1_000 * USD);
        mockUsd.mint(BOB, 1_000 * USD);
        mockUsd.mint(CHARLIE, 1_000 * USD);

        vm.stopBroadcast();
    }
}

