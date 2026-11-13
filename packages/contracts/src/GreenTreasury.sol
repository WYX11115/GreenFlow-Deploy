// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title GreenFlow Programmable Green Treasury
/// @notice Holds fictional bond proceeds and enforces independently approved spending policy.
/// @dev Environmental assessment remains off-chain. The verifier records its evidence digest and
///      approval here; this contract does not prove real-world environmental performance.
contract GreenTreasury is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    enum ProjectStatus {
        None,
        Proposed,
        Active
    }

    enum RequestStatus {
        None,
        Pending,
        Rejected,
        Paid,
        Cancelled
    }

    struct Project {
        bytes32 descriptionHash;
        uint256 budget;
        uint256 spent;
        address vendor;
        ProjectStatus status;
    }

    struct Milestone {
        bytes32 projectId;
        uint256 maxAmount;
        uint256 spent;
        bool exists;
        bool completed;
    }

    struct PaymentRequest {
        bytes32 projectId;
        bytes32 milestoneId;
        address vendor;
        uint256 amount;
        bytes32 evidenceHash;
        address requester;
        address verifier;
        RequestStatus status;
    }

    IERC20 public immutable paymentToken;
    uint256 public totalReleased;

    mapping(bytes32 projectId => Project project) private _projects;
    mapping(bytes32 projectId => mapping(bytes32 milestoneId => Milestone milestone)) private
        _milestones;
    mapping(bytes32 requestId => PaymentRequest request) private _requests;
    mapping(bytes32 projectId => mapping(bytes32 milestoneId => bytes32 requestId)) public
        activeRequestForMilestone;

    error InvalidAddress();
    error RolesMustBeIndependent();
    error InvalidIdentifier();
    error InvalidDescriptionHash();
    error InvalidAmount();
    error InvalidMilestoneConfiguration();
    error ProjectAlreadyExists(bytes32 projectId);
    error ProjectNotProposed(bytes32 projectId);
    error ProjectNotActive(bytes32 projectId);
    error MilestoneAlreadyExists(bytes32 projectId, bytes32 milestoneId);
    error MilestoneNotFound(bytes32 projectId, bytes32 milestoneId);
    error MilestoneAllocationExceedsBudget(uint256 allocated, uint256 budget);
    error VendorNotApproved(bytes32 projectId, address vendor);
    error MilestoneLimitExceeded(bytes32 milestoneId, uint256 attempted, uint256 limit);
    error ProjectBudgetExceeded(bytes32 projectId, uint256 attempted, uint256 budget);
    error MilestoneAlreadyCompleted(bytes32 projectId, bytes32 milestoneId);
    error MilestoneHasPendingRequest(bytes32 projectId, bytes32 milestoneId, bytes32 requestId);
    error RequestAlreadyExists(bytes32 requestId);
    error RequestNotPending(bytes32 requestId, RequestStatus currentStatus);
    error RequesterMismatch(address caller, address requester);
    error TreasuryInsufficientFunds(uint256 available, uint256 required);

    event ProjectProposed(
        bytes32 indexed projectId,
        bytes32 indexed descriptionHash,
        uint256 budget,
        address indexed vendor,
        address issuer
    );
    event MilestoneProposed(
        bytes32 indexed projectId,
        bytes32 indexed milestoneId,
        address indexed vendor,
        uint256 limit
    );
    event ProjectPolicyApproved(
        bytes32 indexed projectId, address indexed verifier, address indexed vendor, uint256 budget
    );
    event DisbursementRequested(
        bytes32 indexed requestId,
        bytes32 indexed projectId,
        bytes32 indexed milestoneId,
        address vendor,
        uint256 amount,
        bytes32 evidenceHash,
        address requester
    );
    event MilestoneVerified(
        bytes32 indexed requestId,
        bytes32 indexed projectId,
        bytes32 indexed milestoneId,
        bytes32 evidenceHash,
        address verifier
    );
    event DisbursementReleased(
        bytes32 indexed requestId,
        bytes32 indexed projectId,
        bytes32 indexed milestoneId,
        address vendor,
        uint256 amount,
        bytes32 evidenceHash,
        address verifier
    );
    event DisbursementRejected(
        bytes32 indexed requestId, bytes32 indexed reasonCode, address verifier
    );
    event DisbursementCancelled(bytes32 indexed requestId, address issuer);

    constructor(IERC20 paymentToken_, address admin, address issuer, address verifier) {
        if (
            address(paymentToken_) == address(0) || admin == address(0) || issuer == address(0)
                || verifier == address(0)
        ) revert InvalidAddress();
        if (issuer == verifier) revert RolesMustBeIndependent();

        paymentToken = paymentToken_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(ISSUER_ROLE, issuer);
        _grantRole(VERIFIER_ROLE, verifier);
    }

    function proposeProjectPolicy(
        bytes32 projectId,
        bytes32 descriptionHash,
        uint256 budget,
        address vendor,
        bytes32[] calldata milestoneIds,
        uint256[] calldata milestoneLimits
    ) external onlyRole(ISSUER_ROLE) {
        if (projectId == bytes32(0)) revert InvalidIdentifier();
        if (descriptionHash == bytes32(0)) revert InvalidDescriptionHash();
        if (budget == 0) revert InvalidAmount();
        if (vendor == address(0)) revert InvalidAddress();
        if (milestoneIds.length == 0 || milestoneIds.length != milestoneLimits.length) {
            revert InvalidMilestoneConfiguration();
        }
        if (_projects[projectId].status != ProjectStatus.None) {
            revert ProjectAlreadyExists(projectId);
        }

        uint256 totalAllocation;
        for (uint256 index = 0; index < milestoneIds.length; ++index) {
            bytes32 milestoneId = milestoneIds[index];
            uint256 limit = milestoneLimits[index];
            if (milestoneId == bytes32(0)) revert InvalidIdentifier();
            if (limit == 0) revert InvalidAmount();
            if (_milestones[projectId][milestoneId].exists) {
                revert MilestoneAlreadyExists(projectId, milestoneId);
            }

            totalAllocation += limit;
            _milestones[projectId][milestoneId] = Milestone({
                projectId: projectId, maxAmount: limit, spent: 0, exists: true, completed: false
            });
        }
        if (totalAllocation > budget) {
            revert MilestoneAllocationExceedsBudget(totalAllocation, budget);
        }

        _projects[projectId] = Project({
            descriptionHash: descriptionHash,
            budget: budget,
            spent: 0,
            vendor: vendor,
            status: ProjectStatus.Proposed
        });

        emit ProjectProposed(projectId, descriptionHash, budget, vendor, msg.sender);
        for (uint256 index = 0; index < milestoneIds.length; ++index) {
            emit MilestoneProposed(projectId, milestoneIds[index], vendor, milestoneLimits[index]);
        }
    }

    function approveProjectPolicy(bytes32 projectId) external onlyRole(VERIFIER_ROLE) {
        Project storage project = _projects[projectId];
        if (project.status != ProjectStatus.Proposed) revert ProjectNotProposed(projectId);

        project.status = ProjectStatus.Active;
        emit ProjectPolicyApproved(projectId, msg.sender, project.vendor, project.budget);
    }

    function requestDisbursement(
        bytes32 requestId,
        bytes32 projectId,
        bytes32 milestoneId,
        address vendor,
        uint256 amount,
        bytes32 evidenceHash
    ) external onlyRole(ISSUER_ROLE) {
        if (requestId == bytes32(0)) revert InvalidIdentifier();
        if (evidenceHash == bytes32(0)) revert InvalidDescriptionHash();
        if (amount == 0) revert InvalidAmount();
        if (_requests[requestId].status != RequestStatus.None) {
            revert RequestAlreadyExists(requestId);
        }

        Project storage project = _projects[projectId];
        if (project.status != ProjectStatus.Active) revert ProjectNotActive(projectId);
        if (vendor != project.vendor) revert VendorNotApproved(projectId, vendor);

        Milestone storage milestone = _milestones[projectId][milestoneId];
        if (!milestone.exists || milestone.projectId != projectId) {
            revert MilestoneNotFound(projectId, milestoneId);
        }
        if (milestone.completed) revert MilestoneAlreadyCompleted(projectId, milestoneId);
        bytes32 activeRequestId = activeRequestForMilestone[projectId][milestoneId];
        if (activeRequestId != bytes32(0)) {
            revert MilestoneHasPendingRequest(projectId, milestoneId, activeRequestId);
        }
        if (milestone.spent + amount > milestone.maxAmount) {
            revert MilestoneLimitExceeded(
                milestoneId, milestone.spent + amount, milestone.maxAmount
            );
        }
        if (project.spent + amount > project.budget) {
            revert ProjectBudgetExceeded(projectId, project.spent + amount, project.budget);
        }

        _requests[requestId] = PaymentRequest({
            projectId: projectId,
            milestoneId: milestoneId,
            vendor: vendor,
            amount: amount,
            evidenceHash: evidenceHash,
            requester: msg.sender,
            verifier: address(0),
            status: RequestStatus.Pending
        });
        activeRequestForMilestone[projectId][milestoneId] = requestId;

        emit DisbursementRequested(
            requestId, projectId, milestoneId, vendor, amount, evidenceHash, msg.sender
        );
    }

    function approveAndRelease(bytes32 requestId)
        external
        onlyRole(VERIFIER_ROLE)
        whenNotPaused
        nonReentrant
    {
        PaymentRequest storage request = _requests[requestId];
        if (request.status != RequestStatus.Pending) {
            revert RequestNotPending(requestId, request.status);
        }

        Project storage project = _projects[request.projectId];
        if (project.status != ProjectStatus.Active) revert ProjectNotActive(request.projectId);
        if (request.vendor != project.vendor) {
            revert VendorNotApproved(request.projectId, request.vendor);
        }

        Milestone storage milestone = _milestones[request.projectId][request.milestoneId];
        if (!milestone.exists || milestone.projectId != request.projectId) {
            revert MilestoneNotFound(request.projectId, request.milestoneId);
        }
        if (milestone.completed) {
            revert MilestoneAlreadyCompleted(request.projectId, request.milestoneId);
        }
        if (milestone.spent + request.amount > milestone.maxAmount) {
            revert MilestoneLimitExceeded(
                request.milestoneId, milestone.spent + request.amount, milestone.maxAmount
            );
        }
        if (project.spent + request.amount > project.budget) {
            revert ProjectBudgetExceeded(
                request.projectId, project.spent + request.amount, project.budget
            );
        }

        uint256 treasuryBalance = paymentToken.balanceOf(address(this));
        if (treasuryBalance < request.amount) {
            revert TreasuryInsufficientFunds(treasuryBalance, request.amount);
        }

        request.status = RequestStatus.Paid;
        request.verifier = msg.sender;
        milestone.spent += request.amount;
        milestone.completed = true;
        project.spent += request.amount;
        totalReleased += request.amount;
        activeRequestForMilestone[request.projectId][request.milestoneId] = bytes32(0);

        emit MilestoneVerified(
            requestId, request.projectId, request.milestoneId, request.evidenceHash, msg.sender
        );
        paymentToken.safeTransfer(request.vendor, request.amount);
        emit DisbursementReleased(
            requestId,
            request.projectId,
            request.milestoneId,
            request.vendor,
            request.amount,
            request.evidenceHash,
            msg.sender
        );
    }

    function rejectRequest(bytes32 requestId, bytes32 reasonCode) external onlyRole(VERIFIER_ROLE) {
        PaymentRequest storage request = _requests[requestId];
        if (request.status != RequestStatus.Pending) {
            revert RequestNotPending(requestId, request.status);
        }

        request.status = RequestStatus.Rejected;
        request.verifier = msg.sender;
        activeRequestForMilestone[request.projectId][request.milestoneId] = bytes32(0);
        emit DisbursementRejected(requestId, reasonCode, msg.sender);
    }

    function cancelRequest(bytes32 requestId) external onlyRole(ISSUER_ROLE) {
        PaymentRequest storage request = _requests[requestId];
        if (request.status != RequestStatus.Pending) {
            revert RequestNotPending(requestId, request.status);
        }
        if (request.requester != msg.sender) {
            revert RequesterMismatch(msg.sender, request.requester);
        }

        request.status = RequestStatus.Cancelled;
        activeRequestForMilestone[request.projectId][request.milestoneId] = bytes32(0);
        emit DisbursementCancelled(requestId, msg.sender);
    }

    function pauseDisbursements() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpauseDisbursements() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    function getProject(bytes32 projectId) external view returns (Project memory) {
        return _projects[projectId];
    }

    function getMilestone(bytes32 projectId, bytes32 milestoneId)
        external
        view
        returns (Milestone memory)
    {
        return _milestones[projectId][milestoneId];
    }

    function getRequest(bytes32 requestId) external view returns (PaymentRequest memory) {
        return _requests[requestId];
    }

    function remainingProjectBudget(bytes32 projectId) external view returns (uint256) {
        Project memory project = _projects[projectId];
        return project.budget - project.spent;
    }
}
