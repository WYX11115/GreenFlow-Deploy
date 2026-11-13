import {
  BOND_OFFERING_ABI,
  BOND_SERVICING_VAULT_ABI,
  BOND_TOKEN_ABI,
  DEMO_ACTORS,
  DEMO_TERMS,
  GREEN_TREASURY_ABI,
  MOCK_USD_ABI,
  PHASE2_CONTRACTS,
  PHASE4_CONTRACTS,
  type DashboardResponse,
  type DemoActor,
  type HexAddress,
  type MilestoneId,
  type TransactionDetail,
  type TransactionResult
} from '@greenflow/shared';
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  encodeFunctionData,
  http,
  keccak256,
  parseAbi,
  sha256,
  stringToHex,
  type Hex
} from 'viem';
import { foundry } from 'viem/chains';
import type { ApiConfig } from '../config.js';
import type { DemoStore } from './demo-store.js';

const projectId = keccak256(stringToHex(DEMO_TERMS.projectId));
const milestone1Id = keccak256(stringToHex('M1'));
const milestone2Id = keccak256(stringToHex('M2'));
const milestoneIds: Record<MilestoneId, Hex> = { M1: milestone1Id, M2: milestone2Id };
const requestIds: Record<MilestoneId, Hex> = {
  M1: keccak256(stringToHex('REQUEST-M1')),
  M2: keccak256(stringToHex('REQUEST-M2'))
};
const requestId = requestIds.M1;
const ZERO_BYTES = `0x${'0'.repeat(64)}` as Hex;
const ZERO_ADDRESS = `0x${'0'.repeat(40)}` as HexAddress;
const projectDescriptionHash = sha256(stringToHex(DEMO_TERMS.projectName));
const allEventAbi = parseAbi([
  'event Transfer(address indexed from,address indexed to,uint256 value)',
  'event Approval(address indexed owner,address indexed spender,uint256 value)',
  'event OfferingOpened(address indexed issuer)',
  'event Subscribed(address indexed investor,uint256 units,uint256 paidAmount,uint256 cumulativeUnits,uint256 cumulativeRaised)',
  'event OfferingFilled(uint256 totalUnits,uint256 totalRaised)',
  'event ProjectProposed(bytes32 indexed projectId,bytes32 indexed descriptionHash,uint256 budget,address indexed vendor,address issuer)',
  'event ProjectPolicyApproved(bytes32 indexed projectId,address indexed verifier,address indexed vendor,uint256 budget)',
  'event DisbursementRequested(bytes32 indexed requestId,bytes32 indexed projectId,bytes32 indexed milestoneId,address vendor,uint256 amount,bytes32 evidenceHash,address requester)',
  'event MilestoneVerified(bytes32 indexed requestId,bytes32 indexed projectId,bytes32 indexed milestoneId,bytes32 evidenceHash,address verifier)',
  'event DisbursementReleased(bytes32 indexed requestId,bytes32 indexed projectId,bytes32 indexed milestoneId,address vendor,uint256 amount,bytes32 evidenceHash,address verifier)',
  'event DisbursementRejected(bytes32 indexed requestId,bytes32 indexed reasonCode,address verifier)',
  'event ServicingFunded(address indexed issuer,uint256 amount,uint256 totalFunded,uint256 outstandingRequirement)',
  'event MaturityFinalized(uint256 indexed maturityTimestamp,uint256 indexed recordDateTimestamp)',
  'event MaturityPaymentClaimed(address indexed investor,uint256 units,uint256 principal,uint256 coupon,uint256 totalPayment)'
]);

export class ChainTransactionError extends Error {
  constructor(
    public code: string,
    message: string,
    public txHash?: Hex,
    public blockNumber?: string
  ) {
    super(message);
  }
}

function actor(id: string): DemoActor {
  const value = DEMO_ACTORS.find((candidate) => candidate.id === id);
  if (!value) throw new Error(`Missing demo actor ${id}.`);
  return value;
}

function stateName(state: number): DashboardResponse['offering']['state'] {
  return ['DRAFT', 'OPEN', 'FULL'][state] as DashboardResponse['offering']['state'];
}

export class ChainService {
  readonly publicClient;

  constructor(private config: ApiConfig) {
    this.publicClient = createPublicClient({ chain: foundry, transport: http(config.ANVIL_RPC_URL) });
  }

  private wallet(address: HexAddress) {
    return createWalletClient({ account: address, chain: foundry, transport: http(this.config.ANVIL_RPC_URL) });
  }

  private async send(
    signer: DemoActor,
    address: HexAddress,
    abi: readonly string[],
    functionName: string,
    args: readonly unknown[],
    failure: { code: string; message: string }
  ): Promise<TransactionResult> {
    const data = encodeFunctionData({ abi: parseAbi(abi), functionName, args });
    const hash = await this.wallet(signer.address).sendTransaction({
      account: signer.address,
      to: address,
      data,
      gas: 3_000_000n
    });
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') {
      throw new ChainTransactionError(failure.code, failure.message, hash, receipt.blockNumber.toString());
    }
    return {
      success: true,
      txHash: hash,
      blockNumber: receipt.blockNumber.toString(),
      message: `${functionName} confirmed on local chain 31337.`
    };
  }

  openOffering(signer: DemoActor) {
    return this.send(signer, PHASE2_CONTRACTS.bondOffering, BOND_OFFERING_ABI, 'openOffering', [], {
      code: signer.role === 'ISSUER' ? 'OFFERING_NOT_DRAFT' : 'ISSUER_ONLY',
      message: signer.role === 'ISSUER' ? 'The offering is no longer in draft.' : 'Only the issuer can open the offering.'
    });
  }

  async subscribe(signer: DemoActor, units: number): Promise<TransactionResult> {
    if (signer.eligibleInvestor) {
      await this.send(
        signer,
        PHASE2_CONTRACTS.mockUsd,
        MOCK_USD_ABI,
        'approve',
        [PHASE2_CONTRACTS.bondOffering, BigInt(units) * BigInt(DEMO_TERMS.faceValueSubunits)],
        { code: 'MOCK_USD_APPROVAL_FAILED', message: 'MockUSD approval was rejected.' }
      );
    }
    return this.send(signer, PHASE2_CONTRACTS.bondOffering, BOND_OFFERING_ABI, 'subscribe', [BigInt(units)], {
      code: signer.eligibleInvestor === false ? 'INVESTOR_NOT_ELIGIBLE' : 'SUBSCRIPTION_REJECTED',
      message:
        signer.eligibleInvestor === false
          ? 'The eligibility token rejected this investor; balances are unchanged.'
          : 'The subscription was rejected by the offering contract.'
    });
  }

  proposeProject(signer: DemoActor) {
    return this.send(
      signer,
      PHASE2_CONTRACTS.greenTreasury,
      GREEN_TREASURY_ABI,
      'proposeProjectPolicy',
      [
        projectId,
        projectDescriptionHash,
        BigInt(DEMO_TERMS.projectBudgetSubunits),
        actor('vendor-a').address,
        [milestone1Id, milestone2Id],
        DEMO_TERMS.milestones.map((item) => BigInt(item.maxAmountSubunits))
      ],
      { code: signer.role === 'ISSUER' ? 'PROJECT_ALREADY_EXISTS' : 'ISSUER_ONLY', message: 'Only the issuer may propose a new project policy.' }
    );
  }

  approveProject(signer: DemoActor) {
    return this.send(signer, PHASE2_CONTRACTS.greenTreasury, GREEN_TREASURY_ABI, 'approveProjectPolicy', [projectId], {
      code: signer.role === 'VERIFIER' ? 'PROJECT_NOT_PROPOSED' : 'VERIFIER_ONLY',
      message: signer.role === 'VERIFIER' ? 'The project is not awaiting approval.' : 'Only the independent verifier may activate policy.'
    });
  }

  requestDisbursement(
    signer: DemoActor,
    evidenceHash: Hex,
    milestoneId: MilestoneId = 'M1',
    options?: { vendor?: HexAddress; amount?: bigint; requestLabel?: string; failureCode?: string; failureMessage?: string }
  ) {
    const milestone = DEMO_TERMS.milestones.find(({ id }) => id === milestoneId)!;
    const id = keccak256(stringToHex(options?.requestLabel ?? `REQUEST-${milestoneId}`));
    return this.send(
      signer,
      PHASE2_CONTRACTS.greenTreasury,
      GREEN_TREASURY_ABI,
      'requestDisbursement',
      [
        id,
        projectId,
        milestoneIds[milestoneId],
        options?.vendor ?? actor('vendor-a').address,
        options?.amount ?? BigInt(milestone.maxAmountSubunits),
        evidenceHash
      ],
      {
        code: options?.failureCode ?? (signer.role === 'ISSUER' ? 'DISBURSEMENT_REJECTED' : 'ISSUER_ONLY'),
        message: options?.failureMessage ?? 'The treasury rejected this payment request.'
      }
    );
  }

  approveAndRelease(signer: DemoActor, milestoneId: MilestoneId = 'M1') {
    return this.send(signer, PHASE2_CONTRACTS.greenTreasury, GREEN_TREASURY_ABI, 'approveAndRelease', [requestIds[milestoneId]], {
      code: signer.role === 'VERIFIER' ? 'REQUEST_NOT_PENDING' : 'VERIFIER_ONLY',
      message: signer.role === 'VERIFIER' ? `No pending ${milestoneId} request can be released.` : 'Only the independent verifier may approve and release.'
    });
  }

  rejectRequest(signer: DemoActor, milestoneId: MilestoneId = 'M1') {
    return this.send(
      signer,
      PHASE2_CONTRACTS.greenTreasury,
      GREEN_TREASURY_ABI,
      'rejectRequest',
      [requestIds[milestoneId], keccak256(stringToHex('EVIDENCE_NOT_ACCEPTED'))],
      { code: signer.role === 'VERIFIER' ? 'REQUEST_NOT_PENDING' : 'VERIFIER_ONLY', message: 'The request cannot be rejected in its current state.' }
    );
  }

  setPaused(signer: DemoActor, paused: boolean) {
    return this.send(
      signer,
      PHASE2_CONTRACTS.greenTreasury,
      GREEN_TREASURY_ABI,
      paused ? 'pauseDisbursements' : 'unpauseDisbursements',
      [],
      { code: signer.role === 'ADMIN' ? 'PAUSE_STATE_REJECTED' : 'ADMIN_ONLY', message: 'Only the platform admin may change the emergency pause.' }
    );
  }

  async fundServicing(signer: DemoActor) {
    const outstanding = await this.publicClient.readContract({
      address: PHASE4_CONTRACTS.bondServicingVault,
      abi: parseAbi(BOND_SERVICING_VAULT_ABI),
      functionName: 'outstandingFunding'
    });
    if (signer.role === 'ISSUER' && outstanding > 0n) {
      await this.send(
        signer,
        PHASE4_CONTRACTS.mockUsd,
        MOCK_USD_ABI,
        'approve',
        [PHASE4_CONTRACTS.bondServicingVault, outstanding],
        { code: 'MOCK_USD_APPROVAL_FAILED', message: 'MockUSD servicing approval was rejected.' }
      );
    }
    return this.send(
      signer,
      PHASE4_CONTRACTS.bondServicingVault,
      BOND_SERVICING_VAULT_ABI,
      'fund',
      [outstanding === 0n ? 1n : outstanding],
      {
        code: signer.role === 'ISSUER' ? 'SERVICING_ALREADY_FUNDED' : 'ISSUER_ONLY',
        message: signer.role === 'ISSUER'
          ? 'The servicing requirement is already fully funded.'
          : 'Only the issuer may fund bond servicing.'
      }
    );
  }

  async advanceToMaturity(signer: DemoActor) {
    const maturity = await this.publicClient.readContract({
      address: PHASE4_CONTRACTS.bondServicingVault,
      abi: parseAbi(BOND_SERVICING_VAULT_ABI),
      functionName: 'maturityTimestamp'
    });
    const rpc = async (method: string, params: unknown[]) => {
      const response = await fetch(this.config.ANVIL_RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
      });
      const body = await response.json() as { error?: { message?: string } };
      if (!response.ok || body.error) throw new Error(body.error?.message ?? `${method} failed.`);
    };
    await rpc('evm_setNextBlockTimestamp', [`0x${maturity.toString(16)}`]);
    await rpc('evm_mine', []);
    return this.send(
      signer,
      PHASE4_CONTRACTS.bondServicingVault,
      BOND_SERVICING_VAULT_ABI,
      'finalizeMaturity',
      [],
      {
        code: signer.role === 'ADMIN' ? 'MATURITY_FINALIZATION_REJECTED' : 'ADMIN_ONLY',
        message: signer.role === 'ADMIN'
          ? 'Maturity could not be finalized.'
          : 'Only the local platform admin may simulate maturity.'
      }
    );
  }

  claimMaturityPayment(signer: DemoActor) {
    return this.send(
      signer,
      PHASE4_CONTRACTS.bondServicingVault,
      BOND_SERVICING_VAULT_ABI,
      'claimMaturityPayment',
      [],
      {
        code: 'MATURITY_CLAIM_REJECTED',
        message: 'The servicing vault rejected this claim. Check maturity, funding, holdings, eligibility, and prior claim status.'
      }
    );
  }

  async dashboard(activeActor: DemoActor, store: DemoStore): Promise<DashboardResponse> {
    const balances = await Promise.all(
      DEMO_ACTORS.map(async (item) => {
        const [mockUsd, bond] = await Promise.all([
          this.publicClient.readContract({ address: PHASE2_CONTRACTS.mockUsd, abi: parseAbi(MOCK_USD_ABI), functionName: 'balanceOf', args: [item.address] }),
          this.publicClient.readContract({ address: PHASE2_CONTRACTS.bondToken, abi: parseAbi(BOND_TOKEN_ABI), functionName: 'balanceOf', args: [item.address] })
        ]);
        return { actorId: item.id, address: item.address, mockUsdSubunits: mockUsd.toString(), bondUnits: bond.toString() };
      })
    );
    const [offeringState, unitsSold, totalRaised, treasuryBalance, totalReleased, paused, project, m1, m2, requestM1, requestM2] = await Promise.all([
      this.publicClient.readContract({ address: PHASE2_CONTRACTS.bondOffering, abi: parseAbi(BOND_OFFERING_ABI), functionName: 'state' }),
      this.publicClient.readContract({ address: PHASE2_CONTRACTS.bondOffering, abi: parseAbi(BOND_OFFERING_ABI), functionName: 'unitsSold' }),
      this.publicClient.readContract({ address: PHASE2_CONTRACTS.bondOffering, abi: parseAbi(BOND_OFFERING_ABI), functionName: 'totalRaised' }),
      this.publicClient.readContract({ address: PHASE2_CONTRACTS.mockUsd, abi: parseAbi(MOCK_USD_ABI), functionName: 'balanceOf', args: [PHASE2_CONTRACTS.greenTreasury] }),
      this.publicClient.readContract({ address: PHASE2_CONTRACTS.greenTreasury, abi: parseAbi(GREEN_TREASURY_ABI), functionName: 'totalReleased' }),
      this.publicClient.readContract({ address: PHASE2_CONTRACTS.greenTreasury, abi: parseAbi(GREEN_TREASURY_ABI), functionName: 'paused' }),
      this.publicClient.readContract({ address: PHASE2_CONTRACTS.greenTreasury, abi: parseAbi(GREEN_TREASURY_ABI), functionName: 'getProject', args: [projectId] }),
      this.publicClient.readContract({ address: PHASE2_CONTRACTS.greenTreasury, abi: parseAbi(GREEN_TREASURY_ABI), functionName: 'getMilestone', args: [projectId, milestone1Id] }),
      this.publicClient.readContract({ address: PHASE2_CONTRACTS.greenTreasury, abi: parseAbi(GREEN_TREASURY_ABI), functionName: 'getMilestone', args: [projectId, milestone2Id] }),
      this.publicClient.readContract({ address: PHASE2_CONTRACTS.greenTreasury, abi: parseAbi(GREEN_TREASURY_ABI), functionName: 'getRequest', args: [requestIds.M1] }),
      this.publicClient.readContract({ address: PHASE2_CONTRACTS.greenTreasury, abi: parseAbi(GREEN_TREASURY_ABI), functionName: 'getRequest', args: [requestIds.M2] })
    ]);
    const [servicingBalance, requiredFunding, totalFunded, outstandingFunding, principalPaid,
      couponPaid, unitsRedeemed, maturityTimestamp, recordDateFinalized, transfersFrozen,
      entitlement, hasClaimed, latestBlock] = await Promise.all([
      this.publicClient.readContract({ address: PHASE4_CONTRACTS.mockUsd, abi: parseAbi(MOCK_USD_ABI), functionName: 'balanceOf', args: [PHASE4_CONTRACTS.bondServicingVault] }),
      this.publicClient.readContract({ address: PHASE4_CONTRACTS.bondServicingVault, abi: parseAbi(BOND_SERVICING_VAULT_ABI), functionName: 'REQUIRED_FUNDING' }),
      this.publicClient.readContract({ address: PHASE4_CONTRACTS.bondServicingVault, abi: parseAbi(BOND_SERVICING_VAULT_ABI), functionName: 'totalFunded' }),
      this.publicClient.readContract({ address: PHASE4_CONTRACTS.bondServicingVault, abi: parseAbi(BOND_SERVICING_VAULT_ABI), functionName: 'outstandingFunding' }),
      this.publicClient.readContract({ address: PHASE4_CONTRACTS.bondServicingVault, abi: parseAbi(BOND_SERVICING_VAULT_ABI), functionName: 'totalPrincipalPaid' }),
      this.publicClient.readContract({ address: PHASE4_CONTRACTS.bondServicingVault, abi: parseAbi(BOND_SERVICING_VAULT_ABI), functionName: 'totalCouponPaid' }),
      this.publicClient.readContract({ address: PHASE4_CONTRACTS.bondServicingVault, abi: parseAbi(BOND_SERVICING_VAULT_ABI), functionName: 'totalUnitsRedeemed' }),
      this.publicClient.readContract({ address: PHASE4_CONTRACTS.bondServicingVault, abi: parseAbi(BOND_SERVICING_VAULT_ABI), functionName: 'maturityTimestamp' }),
      this.publicClient.readContract({ address: PHASE4_CONTRACTS.bondServicingVault, abi: parseAbi(BOND_SERVICING_VAULT_ABI), functionName: 'recordDateFinalized' }),
      this.publicClient.readContract({ address: PHASE4_CONTRACTS.bondToken, abi: parseAbi(BOND_TOKEN_ABI), functionName: 'transfersFrozen' }),
      this.publicClient.readContract({ address: PHASE4_CONTRACTS.bondServicingVault, abi: parseAbi(BOND_SERVICING_VAULT_ABI), functionName: 'entitlementOf', args: [activeActor.address] }),
      this.publicClient.readContract({ address: PHASE4_CONTRACTS.bondServicingVault, abi: parseAbi(BOND_SERVICING_VAULT_ABI), functionName: 'hasClaimed', args: [activeActor.address] }),
      this.publicClient.getBlock({ blockTag: 'latest' })
    ]);
    const p = project as { descriptionHash: Hex; budget: bigint; spent: bigint; vendor: HexAddress; status: number };
    const milestoneViews = [m1, m2] as Array<{ maxAmount: bigint; spent: bigint; exists: boolean; completed: boolean }>;
    type ChainRequest = { projectId: Hex; milestoneId: Hex; vendor: HexAddress; amount: bigint; evidenceHash: Hex; requester: HexAddress; verifier: HexAddress; status: number };
    const requestViews = ([
      { id: 'REQUEST-M1', milestoneId: 'M1', request: requestM1 as ChainRequest },
      { id: 'REQUEST-M2', milestoneId: 'M2', request: requestM2 as ChainRequest }
    ] as const).flatMap(({ id, milestoneId, request }) => {
      if (request.status === 0) return [];
      const evidence = store.evidence().find((item) => item.milestoneId === milestoneId && item.sha256.toLowerCase() === request.evidenceHash.toLowerCase());
      return [{
        id,
        projectId: 'PROJECT-001' as const,
        milestoneId,
        amountSubunits: request.amount.toString(),
        vendorAddress: request.vendor,
        evidenceHash: request.evidenceHash,
        state: (['REGISTERED', 'PENDING_VERIFICATION', 'REJECTED', 'PAID', 'REJECTED'][request.status] ?? 'REGISTERED') as 'REGISTERED' | 'PENDING_VERIFICATION' | 'REJECTED' | 'PAID',
        requestedBy: request.requester,
        ...(request.verifier === ZERO_ADDRESS ? {} : { verifiedBy: request.verifier }),
        ...(evidence ? { evidence } : {})
      }];
    });
    const investorEntitlement = entitlement as readonly [bigint, bigint, bigint, bigint];
    const events = await this.events();
    return {
      activeActor,
      offering: { id: 'GSGB-2026', symbol: 'GSGB', faceValueSubunits: DEMO_TERMS.faceValueSubunits, totalUnits: DEMO_TERMS.totalBondUnits, soldUnits: Number(unitsSold), raisedSubunits: totalRaised.toString(), state: stateName(Number(offeringState)) },
      treasury: { balanceSubunits: treasuryBalance.toString(), totalReleasedSubunits: totalReleased.toString(), paused },
      servicing: {
        vaultAddress: PHASE4_CONTRACTS.bondServicingVault,
        balanceSubunits: servicingBalance.toString(),
        requiredFundingSubunits: requiredFunding.toString(),
        totalFundedSubunits: totalFunded.toString(),
        outstandingFundingSubunits: outstandingFunding.toString(),
        totalPrincipalPaidSubunits: principalPaid.toString(),
        totalCouponPaidSubunits: couponPaid.toString(),
        totalUnitsRedeemed: unitsRedeemed.toString(),
        maturityTimestamp: maturityTimestamp.toString(),
        currentTimestamp: latestBlock.timestamp.toString(),
        matured: latestBlock.timestamp >= maturityTimestamp,
        recordDateFinalized,
        transfersFrozen,
        activeInvestor: {
          units: investorEntitlement[0].toString(),
          principalSubunits: investorEntitlement[1].toString(),
          couponSubunits: investorEntitlement[2].toString(),
          totalPaymentSubunits: investorEntitlement[3].toString(),
          claimed: hasClaimed
        }
      },
      project: {
        id: 'PROJECT-001', name: DEMO_TERMS.projectName,
        status: (['NOT_PROPOSED', 'PROPOSED', 'ACTIVE'][p.status] ?? 'NOT_PROPOSED') as DashboardResponse['project']['status'],
        budgetSubunits: p.budget.toString(), spentSubunits: p.spent.toString(), remainingSubunits: (p.budget - p.spent).toString(),
        vendorAddress: p.vendor === ZERO_ADDRESS ? actor('vendor-a').address : p.vendor,
        milestones: DEMO_TERMS.milestones.map((item, index) => ({ id: item.id, label: item.label, maxAmountSubunits: milestoneViews[index]?.maxAmount.toString() ?? '0', spentSubunits: milestoneViews[index]?.spent.toString() ?? '0', completed: milestoneViews[index]?.completed ?? false }))
      },
      request: requestViews.find(({ milestoneId }) => milestoneId === 'M1') ?? null,
      requests: requestViews,
      balances,
      evidence: store.evidence(),
      rejectedAttempts: store.attempts(),
      events
    };
  }

  async events(): Promise<DashboardResponse['events']> {
    const results = await Promise.all([
      this.publicClient.getContractEvents({ address: PHASE2_CONTRACTS.bondOffering, abi: parseAbi(BOND_OFFERING_ABI), fromBlock: 0n }),
      this.publicClient.getContractEvents({ address: PHASE2_CONTRACTS.greenTreasury, abi: parseAbi(GREEN_TREASURY_ABI), fromBlock: 0n }),
      this.publicClient.getContractEvents({ address: PHASE4_CONTRACTS.bondServicingVault, abi: parseAbi(BOND_SERVICING_VAULT_ABI), fromBlock: 0n })
    ]);
    return results.flat().filter((event) => event.transactionHash && event.blockNumber).map((event, index) => ({
      id: `${event.transactionHash}-${event.logIndex ?? index}`,
      type: event.eventName,
      label: event.eventName.replace(/([a-z])([A-Z])/g, '$1 $2'),
      txHash: event.transactionHash!,
      blockNumber: event.blockNumber!.toString()
    })).sort((a, b) => Number(b.blockNumber) - Number(a.blockNumber));
  }

  async transaction(hash: Hex): Promise<TransactionDetail | null> {
    try {
      const [receipt, transaction] = await Promise.all([
        this.publicClient.getTransactionReceipt({ hash }),
        this.publicClient.getTransaction({ hash })
      ]);
      const events = receipt.logs.flatMap((log) => {
        try {
          const decoded = decodeEventLog({ abi: allEventAbi, data: log.data, topics: log.topics });
          if (!decoded.eventName) return [];
          return [{ type: decoded.eventName, label: decoded.eventName.replace(/([a-z])([A-Z])/g, '$1 $2') }];
        } catch { return []; }
      });
      return { hash, status: receipt.status, blockNumber: receipt.blockNumber.toString(), from: transaction.from, to: transaction.to, gasUsed: receipt.gasUsed.toString(), events };
    } catch { return null; }
  }
}

export const canonicalIds = { projectId, milestone1Id, milestone2Id, requestId, zeroBytes: ZERO_BYTES };
