import {
  DEMO_ACTORS,
  PHASE2_CONTRACTS,
  type HexAddress
} from '@greenflow/shared';
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  http,
  keccak256,
  parseAbi,
  sha256,
  toBytes,
  type Hex
} from 'viem';
import { foundry } from 'viem/chains';

const rpcUrl = process.env.ANVIL_RPC_URL ?? 'http://127.0.0.1:8545';
const publicClient = createPublicClient({ chain: foundry, transport: http(rpcUrl) });
const walletClient = createWalletClient({ chain: foundry, transport: http(rpcUrl) });

const erc20Abi = parseAbi([
  'function approve(address spender,uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)'
]);
const bondAbi = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
  'function totalSupply() view returns (uint256)'
]);
const offeringAbi = parseAbi([
  'function openOffering()',
  'function subscribe(uint256 units)',
  'function state() view returns (uint8)',
  'function unitsSold() view returns (uint256)',
  'function totalRaised() view returns (uint256)'
]);
const treasuryAbi = parseAbi([
  'function proposeProjectPolicy(bytes32 projectId,bytes32 descriptionHash,uint256 budget,address vendor,bytes32[] milestoneIds,uint256[] milestoneLimits)',
  'function approveProjectPolicy(bytes32 projectId)',
  'function requestDisbursement(bytes32 requestId,bytes32 projectId,bytes32 milestoneId,address vendor,uint256 amount,bytes32 evidenceHash)',
  'function approveAndRelease(bytes32 requestId)',
  'function totalReleased() view returns (uint256)',
  'function remainingProjectBudget(bytes32 projectId) view returns (uint256)'
]);

const USD = 1_000_000n;
const PROJECT = keccak256(toBytes('PROJECT-001'));
const M1 = keccak256(toBytes('M1'));
const M2 = keccak256(toBytes('M2'));
const INVALID_REQUEST = keccak256(toBytes('REQUEST-INVALID-VENDOR'));
const M1_REQUEST = keccak256(toBytes('REQUEST-M1'));
const DESCRIPTION_HASH = sha256(toBytes('Solar Panels for Community Facilities'));
const EVIDENCE_HASH = sha256(toBytes('fictional equipment delivery certificate v1'));

function actor(id: string): HexAddress {
  const match = DEMO_ACTORS.find((candidate) => candidate.id === id);
  if (!match) throw new Error(`Missing actor ${id}.`);
  return match.address;
}

function assertEqual<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}.`);
  }
}

const successes: Array<{ label: string; hash: Hex; block: bigint }> = [];
const rejections: Array<{ label: string; hash: Hex; block: bigint }> = [];

async function send(
  label: string,
  from: HexAddress,
  to: HexAddress,
  data: Hex,
  expectedStatus: 'success' | 'reverted' = 'success'
) {
  const hash = await walletClient.sendTransaction({
    account: from,
    to,
    data,
    gas: 2_000_000n
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  assertEqual(receipt.status, expectedStatus, `${label} receipt status`);
  const record = { label, hash, block: receipt.blockNumber };
  if (expectedStatus === 'success') successes.push(record);
  else rejections.push(record);
  return receipt;
}

async function mockBalance(account: HexAddress) {
  return publicClient.readContract({
    address: PHASE2_CONTRACTS.mockUsd,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [account]
  });
}

const [initialState, initialSupply, initialTreasury] = await Promise.all([
  publicClient.readContract({ address: PHASE2_CONTRACTS.bondOffering, abi: offeringAbi, functionName: 'state' }),
  publicClient.readContract({ address: PHASE2_CONTRACTS.bondToken, abi: bondAbi, functionName: 'totalSupply' }),
  mockBalance(PHASE2_CONTRACTS.greenTreasury)
]);
assertEqual(initialState, 0, 'scenario requires Draft offering');
assertEqual(initialSupply, 0n, 'scenario requires zero bond supply');
assertEqual(initialTreasury, 0n, 'scenario requires empty treasury');

await send(
  'issuer opens offering',
  actor('issuer'),
  PHASE2_CONTRACTS.bondOffering,
  encodeFunctionData({ abi: offeringAbi, functionName: 'openOffering' })
);
await send(
  'Alice approves 600 MockUSD',
  actor('alice'),
  PHASE2_CONTRACTS.mockUsd,
  encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [PHASE2_CONTRACTS.bondOffering, 600n * USD]
  })
);
await send(
  'Alice subscribes for 6',
  actor('alice'),
  PHASE2_CONTRACTS.bondOffering,
  encodeFunctionData({ abi: offeringAbi, functionName: 'subscribe', args: [6n] })
);
await send(
  'Bob approves 400 MockUSD',
  actor('bob'),
  PHASE2_CONTRACTS.mockUsd,
  encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [PHASE2_CONTRACTS.bondOffering, 400n * USD]
  })
);
await send(
  'Bob subscribes for 4',
  actor('bob'),
  PHASE2_CONTRACTS.bondOffering,
  encodeFunctionData({ abi: offeringAbi, functionName: 'subscribe', args: [4n] })
);

const [aliceBonds, bobBonds, supplyAfterSubscriptions, treasuryAfterSubscriptions] =
  await Promise.all([
    publicClient.readContract({ address: PHASE2_CONTRACTS.bondToken, abi: bondAbi, functionName: 'balanceOf', args: [actor('alice')] }),
    publicClient.readContract({ address: PHASE2_CONTRACTS.bondToken, abi: bondAbi, functionName: 'balanceOf', args: [actor('bob')] }),
    publicClient.readContract({ address: PHASE2_CONTRACTS.bondToken, abi: bondAbi, functionName: 'totalSupply' }),
    mockBalance(PHASE2_CONTRACTS.greenTreasury)
  ]);
assertEqual(aliceBonds, 6n, 'Alice bond balance');
assertEqual(bobBonds, 4n, 'Bob bond balance');
assertEqual(supplyAfterSubscriptions, 10n, 'bond supply');
assertEqual(treasuryAfterSubscriptions, 1_000n * USD, 'subscription proceeds');

await send(
  'issuer proposes PROJECT-001',
  actor('issuer'),
  PHASE2_CONTRACTS.greenTreasury,
  encodeFunctionData({
    abi: treasuryAbi,
    functionName: 'proposeProjectPolicy',
    args: [
      PROJECT,
      DESCRIPTION_HASH,
      800n * USD,
      actor('vendor-a'),
      [M1, M2],
      [300n * USD, 500n * USD]
    ]
  })
);
await send(
  'verifier approves PROJECT-001 policy',
  actor('verifier'),
  PHASE2_CONTRACTS.greenTreasury,
  encodeFunctionData({ abi: treasuryAbi, functionName: 'approveProjectPolicy', args: [PROJECT] })
);

await send(
  'UnknownVendor payment request rejected',
  actor('issuer'),
  PHASE2_CONTRACTS.greenTreasury,
  encodeFunctionData({
    abi: treasuryAbi,
    functionName: 'requestDisbursement',
    args: [INVALID_REQUEST, PROJECT, M1, actor('vendor-b'), 300n * USD, EVIDENCE_HASH]
  }),
  'reverted'
);
assertEqual(await mockBalance(PHASE2_CONTRACTS.greenTreasury), 1_000n * USD, 'invalid request treasury');
assertEqual(await mockBalance(actor('vendor-b')), 0n, 'UnknownVendor remains unpaid');

await send(
  'issuer submits M1 request',
  actor('issuer'),
  PHASE2_CONTRACTS.greenTreasury,
  encodeFunctionData({
    abi: treasuryAbi,
    functionName: 'requestDisbursement',
    args: [M1_REQUEST, PROJECT, M1, actor('vendor-a'), 300n * USD, EVIDENCE_HASH]
  })
);
await send(
  'issuer premature release rejected',
  actor('issuer'),
  PHASE2_CONTRACTS.greenTreasury,
  encodeFunctionData({ abi: treasuryAbi, functionName: 'approveAndRelease', args: [M1_REQUEST] }),
  'reverted'
);
assertEqual(await mockBalance(PHASE2_CONTRACTS.greenTreasury), 1_000n * USD, 'premature release treasury');
assertEqual(await mockBalance(actor('vendor-a')), 0n, 'SolarSupply before verification');

await send(
  'verifier approves and releases M1',
  actor('verifier'),
  PHASE2_CONTRACTS.greenTreasury,
  encodeFunctionData({ abi: treasuryAbi, functionName: 'approveAndRelease', args: [M1_REQUEST] })
);
await send(
  'duplicate M1 release rejected',
  actor('verifier'),
  PHASE2_CONTRACTS.greenTreasury,
  encodeFunctionData({ abi: treasuryAbi, functionName: 'approveAndRelease', args: [M1_REQUEST] }),
  'reverted'
);

const [finalTreasury, solarSupply, unknownVendor, totalReleased, remainingBudget, totalRaised] =
  await Promise.all([
    mockBalance(PHASE2_CONTRACTS.greenTreasury),
    mockBalance(actor('vendor-a')),
    mockBalance(actor('vendor-b')),
    publicClient.readContract({ address: PHASE2_CONTRACTS.greenTreasury, abi: treasuryAbi, functionName: 'totalReleased' }),
    publicClient.readContract({ address: PHASE2_CONTRACTS.greenTreasury, abi: treasuryAbi, functionName: 'remainingProjectBudget', args: [PROJECT] }),
    publicClient.readContract({ address: PHASE2_CONTRACTS.bondOffering, abi: offeringAbi, functionName: 'totalRaised' })
  ]);
assertEqual(finalTreasury, 700n * USD, 'final treasury');
assertEqual(solarSupply, 300n * USD, 'SolarSupply payment');
assertEqual(unknownVendor, 0n, 'UnknownVendor payment');
assertEqual(totalReleased, 300n * USD, 'cumulative disbursement');
assertEqual(remainingBudget, 500n * USD, 'remaining project budget');
assertEqual(totalRaised, finalTreasury + totalReleased, 'proceeds reconciliation');

console.log('Phase 2 on-chain scenario passed. Successful receipts:');
for (const record of successes) {
  console.log(`  ${record.label}: ${record.hash} (block ${record.block})`);
}
console.log('Rejected transactions with reverted receipts:');
for (const record of rejections) {
  console.log(`  ${record.label}: ${record.hash} (block ${record.block})`);
}
console.log('Verified final state:');
console.log('  bond supply 10: Alice 6, Bob 4');
console.log('  treasury 700 MockUSD; SolarSupply 300; UnknownVendor 0');
console.log('  PROJECT-001 released 300; approved budget remaining 500');
