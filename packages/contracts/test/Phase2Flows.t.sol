// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";
import { IERC20Errors } from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import { BondOffering } from "../src/BondOffering.sol";
import { DemoInvestorEligibilityRegistry } from "../src/DemoInvestorEligibilityRegistry.sol";
import { DemoPermissionedBondToken } from "../src/DemoPermissionedBondToken.sol";
import { GreenTreasury } from "../src/GreenTreasury.sol";
import { MockUSD } from "../src/MockUSD.sol";

interface Vm {
    function expectRevert(bytes calldata revertData) external;

    function expectRevert(bytes4 revertData) external;

    function prank(address msgSender) external;
}

contract Phase2FlowsTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 private constant USD = 1_000_000;
    address private constant ISSUER = address(0x1001);
    address private constant VERIFIER = address(0x1002);
    address private constant ALICE = address(0x1003);
    address private constant BOB = address(0x1004);
    address private constant CHARLIE = address(0x1005);
    address private constant SOLAR_SUPPLY = address(0x1006);
    address private constant UNKNOWN_VENDOR = address(0x1007);
    address private constant OUTSIDER = address(0x1008);

    bytes32 private constant PROJECT = keccak256("PROJECT-001");
    bytes32 private constant M1 = keccak256("M1");
    bytes32 private constant M2 = keccak256("M2");
    bytes32 private constant REQUEST_1 = keccak256("REQUEST-001");
    bytes32 private constant REQUEST_2 = keccak256("REQUEST-002");
    bytes32 private constant DESCRIPTION_HASH = keccak256("Solar Panels for Community Facilities");
    // SHA-256("fictional-equipment-delivery-evidence"), precomputed to avoid a test-time precompile.
    bytes32 private constant EVIDENCE_HASH =
        0xcc6dd56ca91ad456cc49b081668ef1ceadb9d23478f2025d399eca7f32af6db2;

    MockUSD private mockUsd;
    DemoInvestorEligibilityRegistry private registry;
    DemoPermissionedBondToken private bond;
    GreenTreasury private treasury;
    BondOffering private offering;

    function setUp() public {
        mockUsd = new MockUSD(address(this));
        registry = new DemoInvestorEligibilityRegistry(address(this));
        bond = new DemoPermissionedBondToken(address(this), registry, 10);
        treasury = new GreenTreasury(mockUsd, address(this), ISSUER, VERIFIER);
        offering = new BondOffering(address(this), ISSUER, mockUsd, bond, address(treasury));

        registry.setEligibility(ALICE, type(uint64).max, 0x5347, true);
        registry.setEligibility(BOB, type(uint64).max, 0x5347, true);

        mockUsd.mint(ALICE, 1_000 * USD);
        mockUsd.mint(BOB, 1_000 * USD);
        mockUsd.mint(CHARLIE, 1_000 * USD);

        bond.grantRole(bond.MINTER_ROLE(), address(offering));
        bond.revokeRole(bond.MINTER_ROLE(), address(this));
        bond.revokeRole(bond.MINTER_ADMIN_ROLE(), address(this));
    }

    function testT01AliceSubscribesSixAtomically() public {
        _openOffering();
        _subscribe(ALICE, 6);

        _assertEq(bond.balanceOf(ALICE), 6, "Alice bond units");
        _assertEq(mockUsd.balanceOf(ALICE), 400 * USD, "Alice payment deducted");
        _assertEq(mockUsd.balanceOf(address(treasury)), 600 * USD, "treasury proceeds");
        _assertEq(offering.unitsSold(), 6, "units sold");
        _assertEq(offering.totalRaised(), 600 * USD, "raised amount");
    }

    function testT02BobCompletesOfferingAndAccountingInvariant() public {
        _fundFullOffering();

        _assertEq(bond.balanceOf(ALICE), 6, "Alice bond units");
        _assertEq(bond.balanceOf(BOB), 4, "Bob bond units");
        _assertEq(bond.totalSupply(), 10, "bond supply");
        _assertEq(mockUsd.balanceOf(address(treasury)), 1_000 * USD, "treasury proceeds");
        _assertEq(offering.totalRaised(), bond.totalSupply() * 100 * USD, "payment invariant");
        _assertEq(uint256(offering.state()), uint256(BondOffering.OfferingState.Full), "full");
    }

    function testT03CharlieSubscriptionRejectedAndFundsUnchanged() public {
        _openOffering();
        vm.prank(CHARLIE);
        mockUsd.approve(address(offering), 100 * USD);

        vm.expectRevert(abi.encodeWithSelector(BondOffering.InvestorNotEligible.selector, CHARLIE));
        vm.prank(CHARLIE);
        offering.subscribe(1);

        _assertEq(mockUsd.balanceOf(CHARLIE), 1_000 * USD, "Charlie funds unchanged");
        _assertEq(mockUsd.balanceOf(address(treasury)), 0, "treasury unchanged");
        _assertEq(bond.balanceOf(CHARLIE), 0, "Charlie no bonds");
    }

    function testSubscriptionAboveRemainingSupplyRejected() public {
        _openOffering();
        _subscribe(ALICE, 6);
        vm.prank(BOB);
        mockUsd.approve(address(offering), 500 * USD);

        vm.expectRevert(abi.encodeWithSelector(BondOffering.IssuanceCapExceeded.selector, 5, 4));
        vm.prank(BOB);
        offering.subscribe(5);

        _assertEq(mockUsd.balanceOf(address(treasury)), 600 * USD, "no excess payment");
        _assertEq(bond.totalSupply(), 6, "no excess mint");
    }

    function testInsufficientAllowanceRejectedWithoutPaymentOrMint() public {
        _openOffering();
        vm.prank(ALICE);
        mockUsd.approve(address(offering), 599 * USD);

        vm.expectRevert(
            abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientAllowance.selector,
                address(offering),
                599 * USD,
                600 * USD
            )
        );
        vm.prank(ALICE);
        offering.subscribe(6);

        _assertEq(mockUsd.balanceOf(ALICE), 1_000 * USD, "Alice funds unchanged");
        _assertEq(mockUsd.balanceOf(address(treasury)), 0, "treasury unchanged");
        _assertEq(bond.totalSupply(), 0, "supply unchanged");
    }

    function testInsufficientBalanceRejectedWithoutPaymentOrMint() public {
        address emptyInvestor = address(0x2001);
        registry.setEligibility(emptyInvestor, type(uint64).max, 0x5347, true);
        _openOffering();
        vm.prank(emptyInvestor);
        mockUsd.approve(address(offering), type(uint256).max);

        vm.expectRevert(
            abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientBalance.selector, emptyInvestor, 0, 100 * USD
            )
        );
        vm.prank(emptyInvestor);
        offering.subscribe(1);

        _assertEq(mockUsd.balanceOf(address(treasury)), 0, "treasury unchanged");
        _assertEq(bond.totalSupply(), 0, "supply unchanged");
    }

    function testPaymentRollsBackWhenBondMintFails() public {
        _openOffering();
        vm.prank(ALICE);
        mockUsd.approve(address(offering), 600 * USD);
        bond.pause();

        vm.expectRevert(bytes4(keccak256("EnforcedPause()")));
        vm.prank(ALICE);
        offering.subscribe(6);

        _assertEq(mockUsd.balanceOf(ALICE), 1_000 * USD, "payment rolled back");
        _assertEq(mockUsd.balanceOf(address(treasury)), 0, "treasury remains empty");
        _assertEq(bond.totalSupply(), 0, "mint rolled back");
        _assertEq(offering.totalRaised(), 0, "offering accounting rolled back");
    }

    function testUnauthorizedDirectMintRejectedAfterOfferingHandoff() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                address(this),
                bond.MINTER_ROLE()
            )
        );
        bond.mint(ALICE, 1);

        _assertEq(bond.totalSupply(), 0, "no unpaid bond issuance");
    }

    function testAdminCannotReacquireMintAuthorityAfterHandoff() public {
        bytes32 minterRole = bond.MINTER_ROLE();
        bytes32 minterAdminRole = bond.MINTER_ADMIN_ROLE();
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                address(this),
                minterAdminRole
            )
        );
        bond.grantRole(minterRole, address(this));

        _assertTrue(!bond.hasRole(minterRole, address(this)), "admin remains non-minter");
        _assertTrue(bond.hasRole(minterRole, address(offering)), "offering remains sole minter");
    }

    function testIssuerProposesProjectWithoutActivatingPolicy() public {
        _proposeCanonicalPolicy();
        GreenTreasury.Project memory project = treasury.getProject(PROJECT);
        GreenTreasury.Milestone memory milestone = treasury.getMilestone(PROJECT, M1);

        _assertEq(project.budget, 800 * USD, "project budget");
        _assertEq(project.vendor, SOLAR_SUPPLY, "project vendor");
        _assertEq(uint256(project.status), uint256(GreenTreasury.ProjectStatus.Proposed), "draft");
        _assertEq(milestone.maxAmount, 300 * USD, "M1 cap");
    }

    function testT11IssuerCannotSelfApprovePolicy() public {
        _proposeCanonicalPolicy();

        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                ISSUER,
                treasury.VERIFIER_ROLE()
            )
        );
        vm.prank(ISSUER);
        treasury.approveProjectPolicy(PROJECT);

        GreenTreasury.Project memory project = treasury.getProject(PROJECT);
        _assertEq(
            uint256(project.status), uint256(GreenTreasury.ProjectStatus.Proposed), "not active"
        );
    }

    function testT04VerifierApprovesCanonicalPolicy() public {
        _activateCanonicalPolicy();
        GreenTreasury.Project memory project = treasury.getProject(PROJECT);
        _assertEq(uint256(project.status), uint256(GreenTreasury.ProjectStatus.Active), "active");
    }

    function testT12UnauthorizedActorCannotApprovePolicy() public {
        _proposeCanonicalPolicy();
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                OUTSIDER,
                treasury.VERIFIER_ROLE()
            )
        );
        vm.prank(OUTSIDER);
        treasury.approveProjectPolicy(PROJECT);
    }

    function testT11MilestoneAllocationsCannotExceedProjectBudget() public {
        bytes32[] memory ids = new bytes32[](2);
        uint256[] memory limits = new uint256[](2);
        ids[0] = M1;
        ids[1] = M2;
        limits[0] = 300 * USD;
        limits[1] = 501 * USD;

        vm.expectRevert(
            abi.encodeWithSelector(
                GreenTreasury.MilestoneAllocationExceedsBudget.selector, 801 * USD, 800 * USD
            )
        );
        vm.prank(ISSUER);
        treasury.proposeProjectPolicy(
            PROJECT, DESCRIPTION_HASH, 800 * USD, SOLAR_SUPPLY, ids, limits
        );
    }

    function testUnapprovedProjectRequestRejected() public {
        _proposeCanonicalPolicy();

        vm.expectRevert(abi.encodeWithSelector(GreenTreasury.ProjectNotActive.selector, PROJECT));
        vm.prank(ISSUER);
        treasury.requestDisbursement(REQUEST_1, PROJECT, M1, SOLAR_SUPPLY, 300 * USD, EVIDENCE_HASH);
    }

    function testT07UnknownVendorRequestRejectedWithoutMovement() public {
        _activateCanonicalPolicy();

        vm.expectRevert(
            abi.encodeWithSelector(
                GreenTreasury.VendorNotApproved.selector, PROJECT, UNKNOWN_VENDOR
            )
        );
        vm.prank(ISSUER);
        treasury.requestDisbursement(
            REQUEST_1, PROJECT, M1, UNKNOWN_VENDOR, 300 * USD, EVIDENCE_HASH
        );

        _assertEq(mockUsd.balanceOf(UNKNOWN_VENDOR), 0, "unknown vendor unpaid");
    }

    function testT05RequestRecordsEvidenceWithoutTransferringFunds() public {
        _fundFullOffering();
        _activateCanonicalPolicy();
        _requestM1();

        GreenTreasury.PaymentRequest memory request = treasury.getRequest(REQUEST_1);
        _assertEq(request.amount, 300 * USD, "request amount");
        _assertEq(request.evidenceHash, EVIDENCE_HASH, "evidence digest");
        _assertEq(uint256(request.status), uint256(GreenTreasury.RequestStatus.Pending), "pending");
        _assertEq(mockUsd.balanceOf(address(treasury)), 1_000 * USD, "no request payout");
        _assertEq(mockUsd.balanceOf(SOLAR_SUPPLY), 0, "vendor remains unpaid");
    }

    function testT06IssuerCannotReleasePendingRequest() public {
        _fundFullOffering();
        _activateCanonicalPolicy();
        _requestM1();

        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                ISSUER,
                treasury.VERIFIER_ROLE()
            )
        );
        vm.prank(ISSUER);
        treasury.approveAndRelease(REQUEST_1);

        _assertEq(mockUsd.balanceOf(address(treasury)), 1_000 * USD, "treasury unchanged");
        _assertEq(mockUsd.balanceOf(SOLAR_SUPPLY), 0, "vendor unchanged");
    }

    function testT08VerifierReleasesExactlyM1AndUpdatesAllAccounting() public {
        _fundFullOffering();
        _activateCanonicalPolicy();
        _requestM1();

        vm.prank(VERIFIER);
        treasury.approveAndRelease(REQUEST_1);

        GreenTreasury.Project memory project = treasury.getProject(PROJECT);
        GreenTreasury.Milestone memory milestone = treasury.getMilestone(PROJECT, M1);
        GreenTreasury.PaymentRequest memory request = treasury.getRequest(REQUEST_1);
        _assertEq(mockUsd.balanceOf(address(treasury)), 700 * USD, "treasury after M1");
        _assertEq(mockUsd.balanceOf(SOLAR_SUPPLY), 300 * USD, "vendor payment");
        _assertEq(mockUsd.balanceOf(UNKNOWN_VENDOR), 0, "unknown vendor unpaid");
        _assertEq(project.spent, 300 * USD, "project spent");
        _assertEq(800 * USD - project.spent, 500 * USD, "project remaining");
        _assertEq(milestone.spent, 300 * USD, "milestone spent");
        _assertTrue(milestone.completed, "milestone completed");
        _assertEq(uint256(request.status), uint256(GreenTreasury.RequestStatus.Paid), "paid");
        _assertEq(treasury.totalReleased(), 300 * USD, "released total");
        _assertEq(
            offering.totalRaised(),
            mockUsd.balanceOf(address(treasury)) + treasury.totalReleased(),
            "proceeds reconciliation"
        );
    }

    function testT09DuplicatePaymentRejectedAndBalancesUnchanged() public {
        _completeM1();

        vm.expectRevert(
            abi.encodeWithSelector(
                GreenTreasury.RequestNotPending.selector,
                REQUEST_1,
                GreenTreasury.RequestStatus.Paid
            )
        );
        vm.prank(VERIFIER);
        treasury.approveAndRelease(REQUEST_1);

        _assertEq(mockUsd.balanceOf(address(treasury)), 700 * USD, "treasury no duplicate");
        _assertEq(mockUsd.balanceOf(SOLAR_SUPPLY), 300 * USD, "vendor no duplicate");
    }

    function testT10RequestExceedingMilestoneLimitRejected() public {
        _activateCanonicalPolicy();

        vm.expectRevert(
            abi.encodeWithSelector(
                GreenTreasury.MilestoneLimitExceeded.selector, M2, 501 * USD, 500 * USD
            )
        );
        vm.prank(ISSUER);
        treasury.requestDisbursement(REQUEST_2, PROJECT, M2, SOLAR_SUPPLY, 501 * USD, EVIDENCE_HASH);
    }

    function testSecondPendingRequestForMilestoneRejected() public {
        _activateCanonicalPolicy();
        _requestM1();

        vm.expectRevert(
            abi.encodeWithSelector(
                GreenTreasury.MilestoneHasPendingRequest.selector, PROJECT, M1, REQUEST_1
            )
        );
        vm.prank(ISSUER);
        treasury.requestDisbursement(REQUEST_2, PROJECT, M1, SOLAR_SUPPLY, 100 * USD, EVIDENCE_HASH);
    }

    function testT13UnderfundedTreasuryRevertsAtomicallyAndRequestStaysPending() public {
        _openOffering();
        _subscribe(ALICE, 6);
        _proposeSingleMilestonePolicy(800 * USD, 800 * USD);
        vm.prank(VERIFIER);
        treasury.approveProjectPolicy(PROJECT);
        vm.prank(ISSUER);
        treasury.requestDisbursement(REQUEST_1, PROJECT, M1, SOLAR_SUPPLY, 800 * USD, EVIDENCE_HASH);

        vm.expectRevert(
            abi.encodeWithSelector(
                GreenTreasury.TreasuryInsufficientFunds.selector, 600 * USD, 800 * USD
            )
        );
        vm.prank(VERIFIER);
        treasury.approveAndRelease(REQUEST_1);

        GreenTreasury.PaymentRequest memory request = treasury.getRequest(REQUEST_1);
        _assertEq(mockUsd.balanceOf(address(treasury)), 600 * USD, "treasury unchanged");
        _assertEq(mockUsd.balanceOf(SOLAR_SUPPLY), 0, "vendor unpaid");
        _assertEq(
            uint256(request.status), uint256(GreenTreasury.RequestStatus.Pending), "still pending"
        );
    }

    function testT14PausedTreasuryBlocksDisbursementAndPreservesState() public {
        _fundFullOffering();
        _activateCanonicalPolicy();
        _requestM1();
        treasury.pauseDisbursements();

        vm.expectRevert(bytes4(keccak256("EnforcedPause()")));
        vm.prank(VERIFIER);
        treasury.approveAndRelease(REQUEST_1);

        _assertEq(mockUsd.balanceOf(address(treasury)), 1_000 * USD, "treasury unchanged");
        _assertEq(mockUsd.balanceOf(SOLAR_SUPPLY), 0, "vendor unpaid");
        treasury.unpauseDisbursements();
        vm.prank(VERIFIER);
        treasury.approveAndRelease(REQUEST_1);
        _assertEq(mockUsd.balanceOf(SOLAR_SUPPLY), 300 * USD, "unpause restores workflow");
    }

    function testUnauthorizedUserCannotPauseOrUnpause() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                OUTSIDER,
                treasury.ADMIN_ROLE()
            )
        );
        vm.prank(OUTSIDER);
        treasury.pauseDisbursements();

        treasury.pauseDisbursements();
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                OUTSIDER,
                treasury.ADMIN_ROLE()
            )
        );
        vm.prank(OUTSIDER);
        treasury.unpauseDisbursements();
    }

    function testVerifierCanRejectAndRejectedRequestCannotBePaid() public {
        _fundFullOffering();
        _activateCanonicalPolicy();
        _requestM1();

        vm.prank(VERIFIER);
        treasury.rejectRequest(REQUEST_1, keccak256("EVIDENCE_INCOMPLETE"));

        vm.expectRevert(
            abi.encodeWithSelector(
                GreenTreasury.RequestNotPending.selector,
                REQUEST_1,
                GreenTreasury.RequestStatus.Rejected
            )
        );
        vm.prank(VERIFIER);
        treasury.approveAndRelease(REQUEST_1);
        _assertEq(mockUsd.balanceOf(SOLAR_SUPPLY), 0, "rejected request unpaid");
    }

    function testApprovedPolicyIsImmutable() public {
        _activateCanonicalPolicy();

        bytes32[] memory ids = new bytes32[](1);
        uint256[] memory limits = new uint256[](1);
        ids[0] = M1;
        limits[0] = 1 * USD;
        vm.expectRevert(
            abi.encodeWithSelector(GreenTreasury.ProjectAlreadyExists.selector, PROJECT)
        );
        vm.prank(ISSUER);
        treasury.proposeProjectPolicy(
            PROJECT, keccak256("changed"), 1 * USD, UNKNOWN_VENDOR, ids, limits
        );

        GreenTreasury.Project memory project = treasury.getProject(PROJECT);
        _assertEq(project.budget, 800 * USD, "budget immutable");
        _assertEq(project.vendor, SOLAR_SUPPLY, "vendor immutable");
    }

    function _fundFullOffering() private {
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

    function _proposeCanonicalPolicy() private {
        bytes32[] memory ids = new bytes32[](2);
        uint256[] memory limits = new uint256[](2);
        ids[0] = M1;
        ids[1] = M2;
        limits[0] = 300 * USD;
        limits[1] = 500 * USD;
        vm.prank(ISSUER);
        treasury.proposeProjectPolicy(
            PROJECT, DESCRIPTION_HASH, 800 * USD, SOLAR_SUPPLY, ids, limits
        );
    }

    function _proposeSingleMilestonePolicy(uint256 budget, uint256 milestoneLimit) private {
        bytes32[] memory ids = new bytes32[](1);
        uint256[] memory limits = new uint256[](1);
        ids[0] = M1;
        limits[0] = milestoneLimit;
        vm.prank(ISSUER);
        treasury.proposeProjectPolicy(PROJECT, DESCRIPTION_HASH, budget, SOLAR_SUPPLY, ids, limits);
    }

    function _activateCanonicalPolicy() private {
        _proposeCanonicalPolicy();
        vm.prank(VERIFIER);
        treasury.approveProjectPolicy(PROJECT);
    }

    function _requestM1() private {
        vm.prank(ISSUER);
        treasury.requestDisbursement(REQUEST_1, PROJECT, M1, SOLAR_SUPPLY, 300 * USD, EVIDENCE_HASH);
    }

    function _completeM1() private {
        _fundFullOffering();
        _activateCanonicalPolicy();
        _requestM1();
        vm.prank(VERIFIER);
        treasury.approveAndRelease(REQUEST_1);
    }

    function _assertEq(uint256 actual, uint256 expected, string memory message) private pure {
        require(actual == expected, message);
    }

    function _assertEq(address actual, address expected, string memory message) private pure {
        require(actual == expected, message);
    }

    function _assertEq(bytes32 actual, bytes32 expected, string memory message) private pure {
        require(actual == expected, message);
    }

    function _assertTrue(bool condition, string memory message) private pure {
        require(condition, message);
    }
}
