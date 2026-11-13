import { DEMO_ACTORS, PHASE4_CONTRACTS, type HexAddress } from '@greenflow/shared';
import { createPublicClient, http, parseAbi } from 'viem';

const client = createPublicClient({ transport: http(process.env.ANVIL_RPC_URL ?? 'http://127.0.0.1:8545') });
const usdAbi = parseAbi(['function balanceOf(address) view returns (uint256)', 'function totalSupply() view returns (uint256)']);
const bondAbi = parseAbi([
  'function totalSupply() view returns (uint256)', 'function transfersFrozen() view returns (bool)',
  'function MINTER_ROLE() view returns (bytes32)', 'function BURNER_ROLE() view returns (bytes32)',
  'function LIFECYCLE_ROLE() view returns (bytes32)', 'function hasRole(bytes32,address) view returns (bool)'
]);
const offeringAbi = parseAbi(['function state() view returns (uint8)', 'function unitsSold() view returns (uint256)']);
const treasuryAbi = parseAbi(['function totalReleased() view returns (uint256)', 'function paused() view returns (bool)']);
const vaultAbi = parseAbi([
  'function paymentToken() view returns (address)', 'function bondToken() view returns (address)',
  'function maturityTimestamp() view returns (uint256)', 'function REQUIRED_FUNDING() view returns (uint256)',
  'function totalFunded() view returns (uint256)', 'function outstandingFunding() view returns (uint256)',
  'function totalPrincipalPaid() view returns (uint256)', 'function totalCouponPaid() view returns (uint256)',
  'function totalUnitsRedeemed() view returns (uint256)', 'function recordDateFinalized() view returns (bool)',
  'function ISSUER_ROLE() view returns (bytes32)', 'function ADMIN_ROLE() view returns (bytes32)',
  'function hasRole(bytes32,address) view returns (bool)'
]);

function actor(id: string): HexAddress {
  const value = DEMO_ACTORS.find((item) => item.id === id);
  if (!value) throw new Error(`Missing actor ${id}.`);
  return value.address;
}
function equal<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}.`);
}

for (const [name, address] of Object.entries(PHASE4_CONTRACTS)) {
  const code = await client.getCode({ address });
  if (!code || code === '0x') throw new Error(`${name} has no bytecode at ${address}.`);
}

const [issuerUsd, totalSupply, offeringState, unitsSold, treasuryUsd, totalReleased, paused] = await Promise.all([
  client.readContract({ address: PHASE4_CONTRACTS.mockUsd, abi: usdAbi, functionName: 'balanceOf', args: [actor('issuer')] }),
  client.readContract({ address: PHASE4_CONTRACTS.bondToken, abi: bondAbi, functionName: 'totalSupply' }),
  client.readContract({ address: PHASE4_CONTRACTS.bondOffering, abi: offeringAbi, functionName: 'state' }),
  client.readContract({ address: PHASE4_CONTRACTS.bondOffering, abi: offeringAbi, functionName: 'unitsSold' }),
  client.readContract({ address: PHASE4_CONTRACTS.mockUsd, abi: usdAbi, functionName: 'balanceOf', args: [PHASE4_CONTRACTS.greenTreasury] }),
  client.readContract({ address: PHASE4_CONTRACTS.greenTreasury, abi: treasuryAbi, functionName: 'totalReleased' }),
  client.readContract({ address: PHASE4_CONTRACTS.greenTreasury, abi: treasuryAbi, functionName: 'paused' })
]);
equal(issuerUsd, 1_050_000_000n, 'issuer servicing seed');
equal(totalSupply, 0n, 'clean bond supply'); equal(offeringState, 0, 'Draft offering'); equal(unitsSold, 0n, 'units sold');
equal(treasuryUsd, 0n, 'clean green treasury'); equal(totalReleased, 0n, 'released proceeds'); equal(paused, false, 'treasury pause');

const [paymentToken, bondToken, maturity, required, funded, outstanding, principalPaid, couponPaid, unitsRedeemed, finalized] = await Promise.all([
  client.readContract({ address: PHASE4_CONTRACTS.bondServicingVault, abi: vaultAbi, functionName: 'paymentToken' }),
  client.readContract({ address: PHASE4_CONTRACTS.bondServicingVault, abi: vaultAbi, functionName: 'bondToken' }),
  client.readContract({ address: PHASE4_CONTRACTS.bondServicingVault, abi: vaultAbi, functionName: 'maturityTimestamp' }),
  client.readContract({ address: PHASE4_CONTRACTS.bondServicingVault, abi: vaultAbi, functionName: 'REQUIRED_FUNDING' }),
  client.readContract({ address: PHASE4_CONTRACTS.bondServicingVault, abi: vaultAbi, functionName: 'totalFunded' }),
  client.readContract({ address: PHASE4_CONTRACTS.bondServicingVault, abi: vaultAbi, functionName: 'outstandingFunding' }),
  client.readContract({ address: PHASE4_CONTRACTS.bondServicingVault, abi: vaultAbi, functionName: 'totalPrincipalPaid' }),
  client.readContract({ address: PHASE4_CONTRACTS.bondServicingVault, abi: vaultAbi, functionName: 'totalCouponPaid' }),
  client.readContract({ address: PHASE4_CONTRACTS.bondServicingVault, abi: vaultAbi, functionName: 'totalUnitsRedeemed' }),
  client.readContract({ address: PHASE4_CONTRACTS.bondServicingVault, abi: vaultAbi, functionName: 'recordDateFinalized' })
]);
equal(paymentToken.toLowerCase(), PHASE4_CONTRACTS.mockUsd.toLowerCase(), 'vault payment token');
equal(bondToken.toLowerCase(), PHASE4_CONTRACTS.bondToken.toLowerCase(), 'vault bond token');
equal(required, 1_050_000_000n, 'required servicing'); equal(funded, 0n, 'clean funded'); equal(outstanding, required, 'clean outstanding');
equal(principalPaid, 0n, 'principal paid'); equal(couponPaid, 0n, 'coupon paid'); equal(unitsRedeemed, 0n, 'units redeemed'); equal(finalized, false, 'record date');
if (maturity <= BigInt(Math.floor(Date.now() / 1000))) throw new Error('Maturity must be in the future.');

const [minterRole, burnerRole, lifecycleRole, issuerRole, adminRole] = await Promise.all([
  client.readContract({ address: PHASE4_CONTRACTS.bondToken, abi: bondAbi, functionName: 'MINTER_ROLE' }),
  client.readContract({ address: PHASE4_CONTRACTS.bondToken, abi: bondAbi, functionName: 'BURNER_ROLE' }),
  client.readContract({ address: PHASE4_CONTRACTS.bondToken, abi: bondAbi, functionName: 'LIFECYCLE_ROLE' }),
  client.readContract({ address: PHASE4_CONTRACTS.bondServicingVault, abi: vaultAbi, functionName: 'ISSUER_ROLE' }),
  client.readContract({ address: PHASE4_CONTRACTS.bondServicingVault, abi: vaultAbi, functionName: 'ADMIN_ROLE' })
]);
const [offeringMinter, vaultBurner, vaultLifecycle, issuerAuthorized, adminAuthorized, frozen] = await Promise.all([
  client.readContract({ address: PHASE4_CONTRACTS.bondToken, abi: bondAbi, functionName: 'hasRole', args: [minterRole, PHASE4_CONTRACTS.bondOffering] }),
  client.readContract({ address: PHASE4_CONTRACTS.bondToken, abi: bondAbi, functionName: 'hasRole', args: [burnerRole, PHASE4_CONTRACTS.bondServicingVault] }),
  client.readContract({ address: PHASE4_CONTRACTS.bondToken, abi: bondAbi, functionName: 'hasRole', args: [lifecycleRole, PHASE4_CONTRACTS.bondServicingVault] }),
  client.readContract({ address: PHASE4_CONTRACTS.bondServicingVault, abi: vaultAbi, functionName: 'hasRole', args: [issuerRole, actor('issuer')] }),
  client.readContract({ address: PHASE4_CONTRACTS.bondServicingVault, abi: vaultAbi, functionName: 'hasRole', args: [adminRole, actor('admin')] }),
  client.readContract({ address: PHASE4_CONTRACTS.bondToken, abi: bondAbi, functionName: 'transfersFrozen' })
]);
equal(offeringMinter, true, 'offering minter'); equal(vaultBurner, true, 'vault burner'); equal(vaultLifecycle, true, 'vault lifecycle authority');
equal(issuerAuthorized, true, 'issuer servicing role'); equal(adminAuthorized, true, 'admin maturity role'); equal(frozen, false, 'clean transfer state');

console.log('Phase 4 clean deployment verified:');
console.log(`  six contracts have bytecode; servicing vault ${PHASE4_CONTRACTS.bondServicingVault}`);
console.log('  offering Draft, bond supply 0, green treasury 0, servicing vault 0');
console.log('  issuer has 1,050 MockUSD; vault requires 1,050 from issuer and matures in one simulated year');
console.log('  offering alone mints; servicing vault alone burns and finalizes transfer freeze');
