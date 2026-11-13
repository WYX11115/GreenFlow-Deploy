// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";
import { DemoInvestorEligibilityRegistry } from "../src/DemoInvestorEligibilityRegistry.sol";
import { DemoPermissionedBondToken } from "../src/DemoPermissionedBondToken.sol";
import { MockUSD } from "../src/MockUSD.sol";

interface Vm {
    function expectRevert(bytes calldata revertData) external;

    function prank(address msgSender) external;

    function warp(uint256 newTimestamp) external;
}

contract Phase1TokensTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 private constant USD = 1_000_000;
    address private constant ALICE = 0x90F79bf6EB2c4f870365E785982E1f101E93b906;
    address private constant BOB = 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65;
    address private constant CHARLIE = 0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc;
    address private constant ISSUER = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;

    MockUSD private mockUsd;
    DemoInvestorEligibilityRegistry private registry;
    DemoPermissionedBondToken private bond;

    function setUp() public {
        mockUsd = new MockUSD(address(this));
        registry = new DemoInvestorEligibilityRegistry(address(this));
        bond = new DemoPermissionedBondToken(address(this), registry, 10);

        uint64 expiry = uint64(block.timestamp + 365 days);
        registry.setEligibility(ALICE, expiry, 0x5347, true);
        registry.setEligibility(BOB, expiry, 0x5347, true);

        mockUsd.mint(ISSUER, 1_050 * USD);
        mockUsd.mint(ALICE, 1_000 * USD);
        mockUsd.mint(BOB, 1_000 * USD);
        mockUsd.mint(CHARLIE, 1_000 * USD);
    }

    function testMockUsdSeedBalancesAndSupplyAreExact() public view {
        _assertEq(mockUsd.decimals(), 6, "MockUSD decimals");
        _assertEq(mockUsd.balanceOf(ISSUER), 1_050 * USD, "issuer balance");
        _assertEq(mockUsd.balanceOf(ALICE), 1_000 * USD, "Alice balance");
        _assertEq(mockUsd.balanceOf(BOB), 1_000 * USD, "Bob balance");
        _assertEq(mockUsd.balanceOf(CHARLIE), 1_000 * USD, "Charlie balance");
        _assertEq(mockUsd.totalSupply(), 4_050 * USD, "seed supply");
    }

    function testAuthorizedMockUsdMintUpdatesBalanceAndSupply() public {
        uint256 supplyBefore = mockUsd.totalSupply();
        mockUsd.mint(ALICE, 25 * USD);

        _assertEq(mockUsd.balanceOf(ALICE), 1_025 * USD, "minted balance");
        _assertEq(mockUsd.totalSupply(), supplyBefore + 25 * USD, "minted supply");
    }

    function testUnauthorizedMockUsdMintRevertsAndPreservesSupply() public {
        uint256 supplyBefore = mockUsd.totalSupply();

        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                CHARLIE,
                mockUsd.FAUCET_ROLE()
            )
        );
        vm.prank(CHARLIE);
        mockUsd.mint(CHARLIE, 1 * USD);

        _assertEq(mockUsd.totalSupply(), supplyBefore, "supply unchanged");
    }

    function testMockUsdTransferMaintainsAccounting() public {
        vm.prank(ALICE);
        bool transferred = mockUsd.transfer(BOB, 125 * USD);

        _assertTrue(transferred, "transfer result");
        _assertEq(mockUsd.balanceOf(ALICE), 875 * USD, "Alice after transfer");
        _assertEq(mockUsd.balanceOf(BOB), 1_125 * USD, "Bob after transfer");
        _assertEq(mockUsd.totalSupply(), 4_050 * USD, "supply unchanged");
    }

    function testEligibleAliceAndBobCanReceiveFullBondSupply() public {
        bond.mint(ALICE, 6);
        bond.mint(BOB, 4);

        _assertEq(bond.decimals(), 0, "bond decimals");
        _assertEq(bond.balanceOf(ALICE), 6, "Alice bonds");
        _assertEq(bond.balanceOf(BOB), 4, "Bob bonds");
        _assertEq(bond.balanceOf(CHARLIE), 0, "Charlie bonds");
        _assertEq(bond.totalSupply(), 10, "bond supply");
    }

    function testIneligibleCharlieCannotReceiveMint() public {
        vm.expectRevert(
            abi.encodeWithSelector(DemoPermissionedBondToken.InvestorNotEligible.selector, CHARLIE)
        );
        bond.mint(CHARLIE, 1);

        _assertEq(bond.balanceOf(CHARLIE), 0, "Charlie remains empty");
        _assertEq(bond.totalSupply(), 0, "supply remains zero");
    }

    function testTransferToIneligibleCharlieReverts() public {
        bond.mint(ALICE, 6);

        vm.expectRevert(
            abi.encodeWithSelector(DemoPermissionedBondToken.InvestorNotEligible.selector, CHARLIE)
        );
        vm.prank(ALICE);
        // This expected-revert call never returns a boolean.
        // forge-lint: disable-next-line(erc20-unchecked-transfer)
        bond.transfer(CHARLIE, 1);

        _assertEq(bond.balanceOf(ALICE), 6, "Alice unchanged");
        _assertEq(bond.balanceOf(CHARLIE), 0, "Charlie unchanged");
    }

    function testEligibleHolderToHolderTransferSucceeds() public {
        bond.mint(ALICE, 6);

        vm.prank(ALICE);
        bool transferred = bond.transfer(BOB, 2);

        _assertTrue(transferred, "bond transfer result");
        _assertEq(bond.balanceOf(ALICE), 4, "Alice remaining");
        _assertEq(bond.balanceOf(BOB), 2, "Bob received");
        _assertEq(bond.totalSupply(), 6, "supply unchanged");
    }

    function testRevokedInvestorCannotReceiveFurtherTransfers() public {
        bond.mint(ALICE, 6);
        registry.revokeEligibility(BOB);

        vm.expectRevert(
            abi.encodeWithSelector(DemoPermissionedBondToken.InvestorNotEligible.selector, BOB)
        );
        vm.prank(ALICE);
        // This expected-revert call never returns a boolean.
        // forge-lint: disable-next-line(erc20-unchecked-transfer)
        bond.transfer(BOB, 1);

        _assertEq(bond.balanceOf(ALICE), 6, "Alice unchanged after revoke");
        _assertEq(bond.balanceOf(BOB), 0, "Bob cannot receive");
    }

    function testExpiredInvestorCannotReceiveFurtherTransfers() public {
        bond.mint(ALICE, 2);
        DemoInvestorEligibilityRegistry.EligibilityRecord memory record =
            registry.getEligibility(BOB);
        vm.warp(uint256(record.claimExpiry));

        vm.expectRevert(
            abi.encodeWithSelector(DemoPermissionedBondToken.InvestorNotEligible.selector, BOB)
        );
        vm.prank(ALICE);
        // This expected-revert call never returns a boolean.
        // forge-lint: disable-next-line(erc20-unchecked-transfer)
        bond.transfer(BOB, 1);
    }

    function testUnauthorizedUserCannotApproveEligibility() public {
        uint64 expiry = uint64(block.timestamp + 365 days);

        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                CHARLIE,
                registry.REGISTRAR_ROLE()
            )
        );
        vm.prank(CHARLIE);
        registry.setEligibility(CHARLIE, expiry, 0x5347, true);

        _assertTrue(!registry.isEligible(CHARLIE), "Charlie remains ineligible");
    }

    function testUnauthorizedUserCannotRevokeEligibility() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                CHARLIE,
                registry.REGISTRAR_ROLE()
            )
        );
        vm.prank(CHARLIE);
        registry.revokeEligibility(ALICE);

        _assertTrue(registry.isEligible(ALICE), "Alice remains eligible");
    }

    function testUnauthorizedUserCannotMintBonds() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                CHARLIE,
                bond.MINTER_ROLE()
            )
        );
        vm.prank(CHARLIE);
        bond.mint(ALICE, 1);

        _assertEq(bond.totalSupply(), 0, "no unauthorized supply");
    }

    function testBondSupplyCapPreservesInternalConsistency() public {
        bond.mint(ALICE, 6);
        bond.mint(BOB, 4);

        vm.expectRevert(
            abi.encodeWithSelector(DemoPermissionedBondToken.SupplyCapExceeded.selector, 11, 10)
        );
        bond.mint(ALICE, 1);

        _assertEq(bond.totalSupply(), 10, "capped supply");
        _assertEq(
            bond.balanceOf(ALICE) + bond.balanceOf(BOB),
            bond.totalSupply(),
            "holder sum equals supply"
        );
    }

    function testPausedTokenBlocksTransfers() public {
        bond.mint(ALICE, 2);
        bond.pause();

        vm.expectRevert(abi.encodeWithSignature("EnforcedPause()"));
        vm.prank(ALICE);
        // This expected-revert call never returns a boolean.
        // forge-lint: disable-next-line(erc20-unchecked-transfer)
        bond.transfer(BOB, 1);

        _assertEq(bond.balanceOf(ALICE), 2, "pause preserves Alice");
        _assertEq(bond.balanceOf(BOB), 0, "pause preserves Bob");
    }

    function _assertEq(uint256 actual, uint256 expected, string memory message) private pure {
        require(actual == expected, message);
    }

    function _assertTrue(bool condition, string memory message) private pure {
        require(condition, message);
    }
}

