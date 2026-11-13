// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";
import { BondOffering } from "../src/BondOffering.sol";
import { BondServicingVault } from "../src/BondServicingVault.sol";
import { DemoInvestorEligibilityRegistry } from "../src/DemoInvestorEligibilityRegistry.sol";
import { DemoPermissionedBondToken } from "../src/DemoPermissionedBondToken.sol";
import { GreenTreasury } from "../src/GreenTreasury.sol";
import { MockUSD } from "../src/MockUSD.sol";
import { IServicingBondToken } from "../src/interfaces/IServicingBondToken.sol";

interface Vm {
    function expectRevert(bytes calldata revertData) external;

    function expectRevert(bytes4 revertData) external;

    function prank(address msgSender) external;

    function warp(uint256 newTimestamp) external;
}

contract Phase4ServicingTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 private constant USD = 1_000_000;
    address private constant ISSUER = address(0x1001);
    address private constant VERIFIER = address(0x1002);
    address private constant ALICE = address(0x1003);
    address private constant BOB = address(0x1004);
    address private constant OUTSIDER = address(0x1005);

    MockUSD private mockUsd;
    DemoInvestorEligibilityRegistry private registry;
    DemoPermissionedBondToken private bond;
    GreenTreasury private treasury;
    BondOffering private offering;
    BondServicingVault private vault;
    uint256 private maturity;

    function setUp() public {
        mockUsd = new MockUSD(address(this));
        registry = new DemoInvestorEligibilityRegistry(address(this));
        bond = new DemoPermissionedBondToken(address(this), registry, 10);
        treasury = new GreenTreasury(mockUsd, address(this), ISSUER, VERIFIER);
        offering = new BondOffering(address(this), ISSUER, mockUsd, bond, address(treasury));
        maturity = block.timestamp + 365 days;
        vault = new BondServicingVault(
            mockUsd, IServicingBondToken(address(bond)), address(this), ISSUER, maturity
        );

        registry.setEligibility(ALICE, type(uint64).max, 0x5347, true);
        registry.setEligibility(BOB, type(uint64).max, 0x5347, true);
        mockUsd.mint(ISSUER, 1_050 * USD);
        mockUsd.mint(ALICE, 1_000 * USD);
        mockUsd.mint(BOB, 1_000 * USD);

        bond.grantRole(bond.MINTER_ROLE(), address(offering));
        bond.grantRole(bond.BURNER_ROLE(), address(vault));
        bond.grantRole(bond.LIFECYCLE_ROLE(), address(vault));
        bond.revokeRole(bond.MINTER_ROLE(), address(this));
        bond.revokeRole(bond.MINTER_ADMIN_ROLE(), address(this));
        bond.revokeRole(bond.BURNER_ROLE(), address(this));
        bond.revokeRole(bond.BURNER_ADMIN_ROLE(), address(this));
        bond.revokeRole(bond.LIFECYCLE_ROLE(), address(this));
        bond.revokeRole(bond.LIFECYCLE_ADMIN_ROLE(), address(this));
    }

    function testT15IssuerFundsServicingSeparately() public {
        _issueAll();
        uint256 treasuryBefore = mockUsd.balanceOf(address(treasury));
        _fundVault(1_050 * USD);

        _assertEq(mockUsd.balanceOf(ISSUER), 0, "issuer funded independently");
        _assertEq(mockUsd.balanceOf(address(vault)), 1_050 * USD, "vault funded");
        _assertEq(vault.totalFunded(), 1_050 * USD, "funding accounting");
        _assertEq(vault.outstandingFunding(), 0, "nothing outstanding");
        _assertEq(mockUsd.balanceOf(address(treasury)), treasuryBefore, "treasury untouched");
    }

    function testUnauthorizedFundingRejectedAndBalancesUnchanged() public {
        vm.prank(OUTSIDER);
        mockUsd.approve(address(vault), 1 * USD);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                OUTSIDER,
                vault.ISSUER_ROLE()
            )
        );
        vm.prank(OUTSIDER);
        vault.fund(1 * USD);

        _assertEq(mockUsd.balanceOf(address(vault)), 0, "vault unchanged");
        _assertEq(vault.totalFunded(), 0, "accounting unchanged");
    }

    function testFundingCannotExceedFixedRequirement() public {
        _fundVault(1_050 * USD);
        mockUsd.mint(ISSUER, 1 * USD);
        vm.prank(ISSUER);
        mockUsd.approve(address(vault), 1 * USD);
        vm.expectRevert(
            abi.encodeWithSelector(
                BondServicingVault.FundingRequirementExceeded.selector, 1_051 * USD, 1_050 * USD
            )
        );
        vm.prank(ISSUER);
        vault.fund(1 * USD);

        _assertEq(mockUsd.balanceOf(address(vault)), 1_050 * USD, "no overfunding");
    }

    function testMaturityCannotFinalizeEarly() public {
        _issueAll();
        vm.expectRevert(
            abi.encodeWithSelector(
                BondServicingVault.MaturityNotReached.selector, block.timestamp, maturity
            )
        );
        vault.finalizeMaturity();
        _assertTrue(!vault.recordDateFinalized(), "record date remains open");
        _assertTrue(!bond.transfersFrozen(), "transfers remain open");
    }

    function testUnauthorizedAccountCannotFinalizeMaturity() public {
        _issueAll();
        _fundVault(1_050 * USD);
        vm.warp(maturity);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                OUTSIDER,
                vault.ADMIN_ROLE()
            )
        );
        vm.prank(OUTSIDER);
        vault.finalizeMaturity();

        _assertTrue(!vault.recordDateFinalized(), "record date unchanged");
        _assertTrue(!bond.transfersFrozen(), "transfers unchanged");
    }

    function testRevokedAuthorityCannotRegrantBurnOrLifecycleRoles() public {
        bytes32 burnerRole = bond.BURNER_ROLE();
        bytes32 burnerAdminRole = bond.BURNER_ADMIN_ROLE();
        bytes32 lifecycleRole = bond.LIFECYCLE_ROLE();
        bytes32 lifecycleAdminRole = bond.LIFECYCLE_ADMIN_ROLE();
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                address(this),
                burnerAdminRole
            )
        );
        bond.grantRole(burnerRole, address(this));

        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                address(this),
                lifecycleAdminRole
            )
        );
        bond.grantRole(lifecycleRole, address(this));
    }

    function testRedemptionBeforeMaturityRejectedWithoutMovement() public {
        _issueAll();
        _fundVault(1_050 * USD);
        uint256 aliceUsd = mockUsd.balanceOf(ALICE);

        vm.expectRevert(BondServicingVault.RecordDateNotFinalized.selector);
        vm.prank(ALICE);
        vault.claimMaturityPayment();

        _assertEq(mockUsd.balanceOf(ALICE), aliceUsd, "Alice cash unchanged");
        _assertEq(bond.balanceOf(ALICE), 6, "Alice bonds unchanged");
        _assertEq(mockUsd.balanceOf(address(vault)), 1_050 * USD, "vault unchanged");
    }

    function testIncompleteIssuanceCannotFinalizeRecordDate() public {
        _openOffering();
        _subscribe(ALICE, 6);
        vm.warp(maturity);
        vm.expectRevert(
            abi.encodeWithSelector(BondServicingVault.BondIssuanceIncomplete.selector, 6, 10)
        );
        vault.finalizeMaturity();
        _assertTrue(!bond.transfersFrozen(), "no premature freeze");
    }

    function testT18FinalizationFreezesTransfersButAllowsVaultBurn() public {
        _prepareMaturity();
        vm.expectRevert(DemoPermissionedBondToken.TransfersPermanentlyFrozen.selector);
        vm.prank(ALICE);
        bond.transfer(BOB, 1);

        vm.prank(ALICE);
        vault.claimMaturityPayment();
        _assertEq(bond.balanceOf(ALICE), 0, "authorized redemption burn succeeds");
    }

    function testT16T17AliceReceivesCombinedCouponPrincipalAndBondsRetire() public {
        _prepareMaturity();
        uint256 aliceBefore = mockUsd.balanceOf(ALICE);
        vm.prank(ALICE);
        vault.claimMaturityPayment();

        _assertEq(mockUsd.balanceOf(ALICE), aliceBefore + 630 * USD, "Alice total payment");
        _assertEq(bond.balanceOf(ALICE), 0, "Alice units burned");
        _assertEq(bond.totalSupply(), 4, "six units retired");
        _assertEq(vault.totalPrincipalPaid(), 600 * USD, "Alice principal");
        _assertEq(vault.totalCouponPaid(), 30 * USD, "Alice coupon");
        _assertTrue(vault.hasClaimed(ALICE), "Alice claimed");
    }

    function testT16T17BobReceivesCombinedCouponPrincipalAndVaultReconciles() public {
        _prepareMaturity();
        uint256 treasuryBefore = mockUsd.balanceOf(address(treasury));
        uint256 bobBefore = mockUsd.balanceOf(BOB);
        vm.prank(ALICE);
        vault.claimMaturityPayment();
        vm.prank(BOB);
        vault.claimMaturityPayment();

        _assertEq(mockUsd.balanceOf(BOB), bobBefore + 420 * USD, "Bob total payment");
        _assertEq(bond.totalSupply(), 0, "all units retired");
        _assertEq(mockUsd.balanceOf(address(vault)), 0, "vault exhausted exactly");
        _assertEq(vault.totalPrincipalPaid(), 1_000 * USD, "principal total");
        _assertEq(vault.totalCouponPaid(), 50 * USD, "coupon total");
        _assertEq(vault.totalUnitsRedeemed(), 10, "all units redeemed");
        _assertEq(mockUsd.balanceOf(address(treasury)), treasuryBefore, "treasury unchanged");
    }

    function testDoubleRedemptionRejectedWithoutOverpayment() public {
        _prepareMaturity();
        vm.prank(ALICE);
        vault.claimMaturityPayment();
        uint256 aliceAfter = mockUsd.balanceOf(ALICE);

        vm.expectRevert(abi.encodeWithSelector(BondServicingVault.AlreadyClaimed.selector, ALICE));
        vm.prank(ALICE);
        vault.claimMaturityPayment();

        _assertEq(mockUsd.balanceOf(ALICE), aliceAfter, "no duplicate cash");
        _assertEq(vault.totalPrincipalPaid(), 600 * USD, "no duplicate principal");
        _assertEq(vault.totalCouponPaid(), 30 * USD, "no duplicate coupon");
    }

    function testUnderfundedClaimRevertsAtomically() public {
        _issueAll();
        _fundVault(600 * USD);
        vm.warp(maturity);
        vault.finalizeMaturity();
        uint256 aliceBefore = mockUsd.balanceOf(ALICE);

        vm.expectRevert(
            abi.encodeWithSelector(
                BondServicingVault.ServicingInsufficientFunds.selector, 600 * USD, 630 * USD
            )
        );
        vm.prank(ALICE);
        vault.claimMaturityPayment();

        _assertEq(mockUsd.balanceOf(ALICE), aliceBefore, "Alice unchanged");
        _assertEq(bond.balanceOf(ALICE), 6, "bonds not burned");
        _assertTrue(!vault.hasClaimed(ALICE), "claim not consumed");
    }

    function testNonHolderCannotClaim() public {
        _prepareMaturity();
        registry.setEligibility(OUTSIDER, type(uint64).max, 0x5347, true);
        vm.expectRevert(
            abi.encodeWithSelector(BondServicingVault.NoBondEntitlement.selector, OUTSIDER)
        );
        vm.prank(OUTSIDER);
        vault.claimMaturityPayment();
        _assertEq(mockUsd.balanceOf(OUTSIDER), 0, "outsider unpaid");
    }

    function _prepareMaturity() private {
        _issueAll();
        _fundVault(1_050 * USD);
        vm.warp(maturity);
        vault.finalizeMaturity();
    }

    function _issueAll() private {
        _openOffering();
        _subscribe(ALICE, 6);
        _subscribe(BOB, 4);
    }

    function _openOffering() private {
        vm.prank(ISSUER);
        offering.openOffering();
    }

    function _subscribe(address investor, uint256 units) private {
        vm.prank(investor);
        mockUsd.approve(address(offering), units * 100 * USD);
        vm.prank(investor);
        offering.subscribe(units);
    }

    function _fundVault(uint256 amount) private {
        vm.prank(ISSUER);
        mockUsd.approve(address(vault), amount);
        vm.prank(ISSUER);
        vault.fund(amount);
    }

    function _assertTrue(bool condition, string memory message) private pure {
        require(condition, message);
    }

    function _assertEq(uint256 actual, uint256 expected, string memory message) private pure {
        require(actual == expected, message);
    }
}
