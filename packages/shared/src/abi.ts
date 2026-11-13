/**
 * Human-readable Phase 2 ABI surfaces for viem's `parseAbi` in the Phase 3 API.
 * Foundry artifacts in packages/contracts/out remain the complete compiler-generated source.
 */
export const MOCK_USD_ABI = [
  'function approve(address spender,uint256 amount) returns (bool)',
  'function allowance(address owner,address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'event Transfer(address indexed from,address indexed to,uint256 value)',
  'event Approval(address indexed owner,address indexed spender,uint256 value)'
] as const;

export const BOND_TOKEN_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function isEligible(address investor) view returns (bool)',
  'function maxSupply() view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function transfersFrozen() view returns (bool)',
  'function hasRole(bytes32 role,address account) view returns (bool)',
  'event Transfer(address indexed from,address indexed to,uint256 value)',
  'error InvestorNotEligible(address investor)',
  'error SupplyCapExceeded(uint256 attemptedSupply,uint256 supplyCap)'
] as const;

export const BOND_SERVICING_VAULT_ABI = [
  'function REQUIRED_FUNDING() view returns (uint256)',
  'function FACE_VALUE() view returns (uint256)',
  'function COUPON_PER_UNIT() view returns (uint256)',
  'function maturityTimestamp() view returns (uint256)',
  'function totalFunded() view returns (uint256)',
  'function outstandingFunding() view returns (uint256)',
  'function totalPrincipalPaid() view returns (uint256)',
  'function totalCouponPaid() view returns (uint256)',
  'function totalUnitsRedeemed() view returns (uint256)',
  'function recordDateFinalized() view returns (bool)',
  'function hasClaimed(address investor) view returns (bool)',
  'function entitlementOf(address investor) view returns (uint256 units,uint256 principal,uint256 coupon,uint256 totalPayment)',
  'function fund(uint256 amount)',
  'function finalizeMaturity()',
  'function claimMaturityPayment()',
  'event ServicingFunded(address indexed issuer,uint256 amount,uint256 totalFunded,uint256 outstandingRequirement)',
  'event MaturityFinalized(uint256 indexed maturityTimestamp,uint256 indexed recordDateTimestamp)',
  'event MaturityPaymentClaimed(address indexed investor,uint256 units,uint256 principal,uint256 coupon,uint256 totalPayment)',
  'error FundingRequirementExceeded(uint256 attempted,uint256 required)',
  'error BondIssuanceIncomplete(uint256 actualSupply,uint256 requiredSupply)',
  'error MaturityNotReached(uint256 currentTimestamp,uint256 maturityTimestamp)',
  'error RecordDateNotFinalized()',
  'error NoBondEntitlement(address investor)',
  'error AlreadyClaimed(address investor)',
  'error ServicingInsufficientFunds(uint256 available,uint256 required)'
] as const;

export const BOND_OFFERING_ABI = [
  'function FACE_VALUE() view returns (uint256)',
  'function TOTAL_UNITS() view returns (uint256)',
  'function openOffering()',
  'function subscribe(uint256 units)',
  'function state() view returns (uint8)',
  'function unitsSold() view returns (uint256)',
  'function totalRaised() view returns (uint256)',
  'function greenTreasury() view returns (address)',
  'event OfferingOpened(address indexed issuer)',
  'event Subscribed(address indexed investor,uint256 units,uint256 paidAmount,uint256 cumulativeUnits,uint256 cumulativeRaised)',
  'event OfferingFilled(uint256 totalUnits,uint256 totalRaised)',
  'error InvalidUnits()',
  'error OfferingNotDraft(uint8 currentState)',
  'error OfferingNotOpen(uint8 currentState)',
  'error InvestorNotEligible(address investor)',
  'error IssuanceCapExceeded(uint256 requestedUnits,uint256 remainingUnits)'
] as const;

export const GREEN_TREASURY_ABI = [
  'function proposeProjectPolicy(bytes32 projectId,bytes32 descriptionHash,uint256 budget,address vendor,bytes32[] milestoneIds,uint256[] milestoneLimits)',
  'function approveProjectPolicy(bytes32 projectId)',
  'function requestDisbursement(bytes32 requestId,bytes32 projectId,bytes32 milestoneId,address vendor,uint256 amount,bytes32 evidenceHash)',
  'function approveAndRelease(bytes32 requestId)',
  'function rejectRequest(bytes32 requestId,bytes32 reasonCode)',
  'function cancelRequest(bytes32 requestId)',
  'function pauseDisbursements()',
  'function unpauseDisbursements()',
  'function paused() view returns (bool)',
  'function totalReleased() view returns (uint256)',
  'function remainingProjectBudget(bytes32 projectId) view returns (uint256)',
  'function getProject(bytes32 projectId) view returns ((bytes32 descriptionHash,uint256 budget,uint256 spent,address vendor,uint8 status))',
  'function getMilestone(bytes32 projectId,bytes32 milestoneId) view returns ((bytes32 projectId,uint256 maxAmount,uint256 spent,bool exists,bool completed))',
  'function getRequest(bytes32 requestId) view returns ((bytes32 projectId,bytes32 milestoneId,address vendor,uint256 amount,bytes32 evidenceHash,address requester,address verifier,uint8 status))',
  'function activeRequestForMilestone(bytes32 projectId,bytes32 milestoneId) view returns (bytes32)',
  'event ProjectProposed(bytes32 indexed projectId,bytes32 indexed descriptionHash,uint256 budget,address indexed vendor,address issuer)',
  'event MilestoneProposed(bytes32 indexed projectId,bytes32 indexed milestoneId,address indexed vendor,uint256 limit)',
  'event ProjectPolicyApproved(bytes32 indexed projectId,address indexed verifier,address indexed vendor,uint256 budget)',
  'event DisbursementRequested(bytes32 indexed requestId,bytes32 indexed projectId,bytes32 indexed milestoneId,address vendor,uint256 amount,bytes32 evidenceHash,address requester)',
  'event MilestoneVerified(bytes32 indexed requestId,bytes32 indexed projectId,bytes32 indexed milestoneId,bytes32 evidenceHash,address verifier)',
  'event DisbursementReleased(bytes32 indexed requestId,bytes32 indexed projectId,bytes32 indexed milestoneId,address vendor,uint256 amount,bytes32 evidenceHash,address verifier)',
  'event DisbursementRejected(bytes32 indexed requestId,bytes32 indexed reasonCode,address verifier)',
  'event DisbursementCancelled(bytes32 indexed requestId,address issuer)',
  'error ProjectNotActive(bytes32 projectId)',
  'error VendorNotApproved(bytes32 projectId,address vendor)',
  'error MilestoneLimitExceeded(bytes32 milestoneId,uint256 attempted,uint256 limit)',
  'error ProjectBudgetExceeded(bytes32 projectId,uint256 attempted,uint256 budget)',
  'error RequestNotPending(bytes32 requestId,uint8 currentStatus)',
  'error TreasuryInsufficientFunds(uint256 available,uint256 required)'
] as const;
