import {
  DEMO_ACTORS,
  PHASE2_CONTRACTS,
  type HexAddress
} from '@greenflow/shared';
import { createPublicClient, encodeFunctionData, http, parseAbi } from 'viem';

const rpcUrl = process.env.ANVIL_RPC_URL ?? 'http://127.0.0.1:8545';
const client = createPublicClient({ transport: http(rpcUrl) });

const mockUsdAbi = parseAbi([
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)'
]);
const registryAbi = parseAbi(['function isEligible(address investor) view returns (bool)']);
const bondAbi = parseAbi([
  'function decimals() view returns (uint8)',
  'function maxSupply() view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function MINTER_ADMIN_ROLE() view returns (bytes32)',
  'function MINTER_ROLE() view returns (bytes32)',
  'function hasRole(bytes32 role,address account) view returns (bool)',
  'function grantRole(bytes32 role,address account)',
  'function mint(address investor,uint256 units)'
]);
const offeringAbi = parseAbi([
  'function FACE_VALUE() view returns (uint256)',
  'function TOTAL_UNITS() view returns (uint256)',
  'function paymentToken() view returns (address)',
  'function bondToken() view returns (address)',
  'function greenTreasury() view returns (address)',
  'function state() view returns (uint8)',
  'function unitsSold() view returns (uint256)',
  'function totalRaised() view returns (uint256)',
  'function openOffering()'
]);
const treasuryAbi = parseAbi([
  'function paymentToken() view returns (address)',
  'function totalReleased() view returns (uint256)',
  'function paused() view returns (bool)',
  'function ISSUER_ROLE() view returns (bytes32)',
  'function VERIFIER_ROLE() view returns (bytes32)',
  'function hasRole(bytes32 role,address account) view returns (bool)'
]);

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

for (const [name, address] of Object.entries(PHASE2_CONTRACTS)) {
  const code = await client.getCode({ address });
  if (!code || code === '0x') throw new Error(`${name} has no deployed bytecode at ${address}.`);
}

const [usdDecimals, usdSupply, issuerUsd, aliceUsd, bobUsd, charlieUsd, treasuryUsd] =
  await Promise.all([
    client.readContract({ address: PHASE2_CONTRACTS.mockUsd, abi: mockUsdAbi, functionName: 'decimals' }),
    client.readContract({ address: PHASE2_CONTRACTS.mockUsd, abi: mockUsdAbi, functionName: 'totalSupply' }),
    client.readContract({ address: PHASE2_CONTRACTS.mockUsd, abi: mockUsdAbi, functionName: 'balanceOf', args: [actor('issuer')] }),
    client.readContract({ address: PHASE2_CONTRACTS.mockUsd, abi: mockUsdAbi, functionName: 'balanceOf', args: [actor('alice')] }),
    client.readContract({ address: PHASE2_CONTRACTS.mockUsd, abi: mockUsdAbi, functionName: 'balanceOf', args: [actor('bob')] }),
    client.readContract({ address: PHASE2_CONTRACTS.mockUsd, abi: mockUsdAbi, functionName: 'balanceOf', args: [actor('charlie')] }),
    client.readContract({ address: PHASE2_CONTRACTS.mockUsd, abi: mockUsdAbi, functionName: 'balanceOf', args: [PHASE2_CONTRACTS.greenTreasury] })
  ]);
assertEqual(usdDecimals, 6, 'MockUSD decimals');
assertEqual(usdSupply, 4_050_000_000n, 'MockUSD supply');
assertEqual(issuerUsd, 1_050_000_000n, 'issuer MockUSD');
assertEqual(aliceUsd, 1_000_000_000n, 'Alice MockUSD');
assertEqual(bobUsd, 1_000_000_000n, 'Bob MockUSD');
assertEqual(charlieUsd, 1_000_000_000n, 'Charlie MockUSD');
assertEqual(treasuryUsd, 0n, 'clean treasury balance');

const [
  aliceEligible,
  bobEligible,
  charlieEligible,
  bondDecimals,
  bondCap,
  bondSupply,
  minterAdminRole,
  minterRole
] =
  await Promise.all([
    client.readContract({ address: PHASE2_CONTRACTS.eligibilityRegistry, abi: registryAbi, functionName: 'isEligible', args: [actor('alice')] }),
    client.readContract({ address: PHASE2_CONTRACTS.eligibilityRegistry, abi: registryAbi, functionName: 'isEligible', args: [actor('bob')] }),
    client.readContract({ address: PHASE2_CONTRACTS.eligibilityRegistry, abi: registryAbi, functionName: 'isEligible', args: [actor('charlie')] }),
    client.readContract({ address: PHASE2_CONTRACTS.bondToken, abi: bondAbi, functionName: 'decimals' }),
    client.readContract({ address: PHASE2_CONTRACTS.bondToken, abi: bondAbi, functionName: 'maxSupply' }),
    client.readContract({ address: PHASE2_CONTRACTS.bondToken, abi: bondAbi, functionName: 'totalSupply' }),
    client.readContract({ address: PHASE2_CONTRACTS.bondToken, abi: bondAbi, functionName: 'MINTER_ADMIN_ROLE' }),
    client.readContract({ address: PHASE2_CONTRACTS.bondToken, abi: bondAbi, functionName: 'MINTER_ROLE' })
  ]);
assertEqual(aliceEligible, true, 'Alice eligibility');
assertEqual(bobEligible, true, 'Bob eligibility');
assertEqual(charlieEligible, false, 'Charlie eligibility');
assertEqual(bondDecimals, 0, 'bond decimals');
assertEqual(bondCap, 10n, 'bond cap');
assertEqual(bondSupply, 0n, 'clean bond supply');

const [offeringCanMint, adminCanMint, adminCanAdministerMint, faceValue, totalUnits, offeringState, unitsSold, raised] =
  await Promise.all([
    client.readContract({ address: PHASE2_CONTRACTS.bondToken, abi: bondAbi, functionName: 'hasRole', args: [minterRole, PHASE2_CONTRACTS.bondOffering] }),
    client.readContract({ address: PHASE2_CONTRACTS.bondToken, abi: bondAbi, functionName: 'hasRole', args: [minterRole, actor('admin')] }),
    client.readContract({ address: PHASE2_CONTRACTS.bondToken, abi: bondAbi, functionName: 'hasRole', args: [minterAdminRole, actor('admin')] }),
    client.readContract({ address: PHASE2_CONTRACTS.bondOffering, abi: offeringAbi, functionName: 'FACE_VALUE' }),
    client.readContract({ address: PHASE2_CONTRACTS.bondOffering, abi: offeringAbi, functionName: 'TOTAL_UNITS' }),
    client.readContract({ address: PHASE2_CONTRACTS.bondOffering, abi: offeringAbi, functionName: 'state' }),
    client.readContract({ address: PHASE2_CONTRACTS.bondOffering, abi: offeringAbi, functionName: 'unitsSold' }),
    client.readContract({ address: PHASE2_CONTRACTS.bondOffering, abi: offeringAbi, functionName: 'totalRaised' })
  ]);
assertEqual(offeringCanMint, true, 'offering mint role');
assertEqual(adminCanMint, false, 'admin direct mint role removed');
assertEqual(adminCanAdministerMint, false, 'admin mint administration removed');
assertEqual(faceValue, 100_000_000n, 'face value');
assertEqual(totalUnits, 10n, 'offering unit cap');
assertEqual(offeringState, 0, 'clean offering state');
assertEqual(unitsSold, 0n, 'clean units sold');
assertEqual(raised, 0n, 'clean raised total');

const [offeringPayment, offeringBond, offeringTreasury, treasuryPayment, totalReleased, paused] =
  await Promise.all([
    client.readContract({ address: PHASE2_CONTRACTS.bondOffering, abi: offeringAbi, functionName: 'paymentToken' }),
    client.readContract({ address: PHASE2_CONTRACTS.bondOffering, abi: offeringAbi, functionName: 'bondToken' }),
    client.readContract({ address: PHASE2_CONTRACTS.bondOffering, abi: offeringAbi, functionName: 'greenTreasury' }),
    client.readContract({ address: PHASE2_CONTRACTS.greenTreasury, abi: treasuryAbi, functionName: 'paymentToken' }),
    client.readContract({ address: PHASE2_CONTRACTS.greenTreasury, abi: treasuryAbi, functionName: 'totalReleased' }),
    client.readContract({ address: PHASE2_CONTRACTS.greenTreasury, abi: treasuryAbi, functionName: 'paused' })
  ]);
assertEqual(offeringPayment.toLowerCase(), PHASE2_CONTRACTS.mockUsd.toLowerCase(), 'offering payment token');
assertEqual(offeringBond.toLowerCase(), PHASE2_CONTRACTS.bondToken.toLowerCase(), 'offering bond token');
assertEqual(offeringTreasury.toLowerCase(), PHASE2_CONTRACTS.greenTreasury.toLowerCase(), 'offering treasury');
assertEqual(treasuryPayment.toLowerCase(), PHASE2_CONTRACTS.mockUsd.toLowerCase(), 'treasury payment token');
assertEqual(totalReleased, 0n, 'clean total released');
assertEqual(paused, false, 'treasury unpaused');

const [issuerRole, verifierRole] = await Promise.all([
  client.readContract({ address: PHASE2_CONTRACTS.greenTreasury, abi: treasuryAbi, functionName: 'ISSUER_ROLE' }),
  client.readContract({ address: PHASE2_CONTRACTS.greenTreasury, abi: treasuryAbi, functionName: 'VERIFIER_ROLE' })
]);
const [issuerAuthorized, verifierAuthorized, issuerCannotVerify] = await Promise.all([
  client.readContract({ address: PHASE2_CONTRACTS.greenTreasury, abi: treasuryAbi, functionName: 'hasRole', args: [issuerRole, actor('issuer')] }),
  client.readContract({ address: PHASE2_CONTRACTS.greenTreasury, abi: treasuryAbi, functionName: 'hasRole', args: [verifierRole, actor('verifier')] }),
  client.readContract({ address: PHASE2_CONTRACTS.greenTreasury, abi: treasuryAbi, functionName: 'hasRole', args: [verifierRole, actor('issuer')] })
]);
assertEqual(issuerAuthorized, true, 'issuer role');
assertEqual(verifierAuthorized, true, 'verifier role');
assertEqual(issuerCannotVerify, false, 'issuer/verifier separation');

await client.call({
  account: actor('issuer'),
  to: PHASE2_CONTRACTS.bondOffering,
  data: encodeFunctionData({ abi: offeringAbi, functionName: 'openOffering' })
});

let directAdminMintBlocked = false;
try {
  await client.call({
    account: actor('admin'),
    to: PHASE2_CONTRACTS.bondToken,
    data: encodeFunctionData({ abi: bondAbi, functionName: 'mint', args: [actor('alice'), 1n] })
  });
} catch {
  directAdminMintBlocked = true;
}
assertEqual(directAdminMintBlocked, true, 'direct admin mint rejection');

let adminMintRoleReacquisitionBlocked = false;
try {
  await client.call({
    account: actor('admin'),
    to: PHASE2_CONTRACTS.bondToken,
    data: encodeFunctionData({
      abi: bondAbi,
      functionName: 'grantRole',
      args: [minterRole, actor('admin')]
    })
  });
} catch {
  adminMintRoleReacquisitionBlocked = true;
}
assertEqual(adminMintRoleReacquisitionBlocked, true, 'admin mint-role reacquisition rejection');

console.log('Phase 2 clean deployment verified:');
console.log(`  five contracts have bytecode; offering ${PHASE2_CONTRACTS.bondOffering}`);
console.log('  Alice/Bob eligible; Charlie ineligible; bond supply and treasury balance are zero');
console.log('  offering: Draft, 10 units × 100 MockUSD, sole deployed minter authority');
console.log('  treasury: issuer/verifier roles separated, unpaused, zero released');
console.log('  eth_call checks: issuer may open; admin mint and mint-role reacquisition are rejected');
