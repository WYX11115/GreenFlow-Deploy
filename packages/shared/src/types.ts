export type HexAddress = `0x${string}`;

export type DemoRole =
  | 'ADMIN'
  | 'ISSUER'
  | 'VERIFIER'
  | 'INVESTOR'
  | 'VENDOR';

export type MilestoneId = 'M1' | 'M2';

export interface DemoActor {
  id: string;
  displayName: string;
  organization: string;
  role: DemoRole;
  address: HexAddress;
  eligibleInvestor: boolean | null;
  description: string;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  service: 'greenflow-api';
  phase: 5;
  chain: {
    connected: boolean;
    contractsReady: boolean;
    chainId: number | null;
    expectedChainId: number;
    latestBlock: string | null;
    rpcUrl: string;
  };
  contracts: {
    mockUsd: HexAddress;
    eligibilityRegistry: HexAddress;
    bondToken: HexAddress;
    greenTreasury: HexAddress;
    bondOffering: HexAddress;
    bondServicingVault: HexAddress;
  };
  message: string;
  timestamp: string;
}

export interface ActorListResponse {
  actors: DemoActor[];
  activeActorId: string;
}

export interface ActorSelectionResponse extends ActorListResponse {
  activeActor: DemoActor;
}

export type OfferingState =
  | 'DRAFT'
  | 'OPEN'
  | 'FULL'
  | 'ACTIVE'
  | 'CLAIMS_OPEN'
  | 'REDEEMED';

export type MilestoneState =
  | 'REGISTERED'
  | 'PENDING_VERIFICATION'
  | 'REJECTED'
  | 'PAID';

export interface OfferingView {
  id: 'GSGB-2026';
  symbol: 'GSGB';
  faceValueSubunits: string;
  totalUnits: number;
  soldUnits: number;
  raisedSubunits: string;
  state: OfferingState;
}

export interface PaymentRequestView {
  id: `REQUEST-${MilestoneId}`;
  projectId: string;
  milestoneId: MilestoneId;
  amountSubunits: string;
  vendorAddress: HexAddress;
  evidenceHash: `0x${string}`;
  state: MilestoneState;
  requestedBy: HexAddress;
  verifiedBy?: HexAddress;
  paidTxHash?: `0x${string}`;
  blockNumber?: string;
}

export interface TransactionResult {
  success: true;
  txHash: `0x${string}`;
  blockNumber: string;
  message: string;
}

export interface EvidenceView {
  id: string;
  milestoneId: MilestoneId;
  fileName: string;
  mimeType: 'application/pdf' | 'image/png' | 'image/jpeg';
  size: number;
  sha256: `0x${string}`;
  createdAt: string;
  fileUrl: string;
}

export interface RejectedAttemptView {
  id: string;
  kind: 'INELIGIBLE_INVESTOR' | 'POLICY_NOT_APPROVED' | 'UNKNOWN_VENDOR' | 'OVER_LIMIT';
  code: string;
  message: string;
  actorAddress: HexAddress;
  txHash: `0x${string}`;
  blockNumber: string;
  createdAt: string;
}

export interface DashboardResponse {
  activeActor: DemoActor;
  offering: OfferingView;
  treasury: {
    balanceSubunits: string;
    totalReleasedSubunits: string;
    paused: boolean;
  };
  servicing: {
    vaultAddress: HexAddress;
    balanceSubunits: string;
    requiredFundingSubunits: string;
    totalFundedSubunits: string;
    outstandingFundingSubunits: string;
    totalPrincipalPaidSubunits: string;
    totalCouponPaidSubunits: string;
    totalUnitsRedeemed: string;
    maturityTimestamp: string;
    currentTimestamp: string;
    matured: boolean;
    recordDateFinalized: boolean;
    transfersFrozen: boolean;
    activeInvestor: {
      units: string;
      principalSubunits: string;
      couponSubunits: string;
      totalPaymentSubunits: string;
      claimed: boolean;
    };
  };
  project: {
    id: 'PROJECT-001';
    name: string;
    status: 'NOT_PROPOSED' | 'PROPOSED' | 'ACTIVE';
    budgetSubunits: string;
    spentSubunits: string;
    remainingSubunits: string;
    vendorAddress: HexAddress;
    milestones: Array<{
      id: MilestoneId;
      label: string;
      maxAmountSubunits: string;
      spentSubunits: string;
      completed: boolean;
    }>;
  };
  request: (PaymentRequestView & { evidence?: EvidenceView }) | null;
  requests: Array<PaymentRequestView & { evidence?: EvidenceView }>;
  balances: Array<{
    actorId: string;
    address: HexAddress;
    mockUsdSubunits: string;
    bondUnits: string;
  }>;
  evidence: EvidenceView[];
  rejectedAttempts: RejectedAttemptView[];
  events: Array<{
    id: string;
    type: string;
    label: string;
    txHash: `0x${string}`;
    blockNumber: string;
  }>;
}

export interface TransactionDetail {
  hash: `0x${string}`;
  status: 'success' | 'reverted';
  blockNumber: string;
  from: HexAddress;
  to: HexAddress | null;
  gasUsed: string;
  events: Array<{ type: string; label: string }>;
}

