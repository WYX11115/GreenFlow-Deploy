import {
  DEMO_ACTORS,
  PHASE1_CONTRACTS,
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
  'function mint(address investor,uint256 units)'
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

for (const [name, address] of Object.entries(PHASE1_CONTRACTS)) {
  const code = await client.getCode({ address });
  if (!code || code === '0x') throw new Error(`${name} has no deployed bytecode at ${address}.`);
}

const [usdDecimals, usdSupply, issuerUsd, aliceUsd, bobUsd, charlieUsd] = await Promise.all([
  client.readContract({ address: PHASE1_CONTRACTS.mockUsd, abi: mockUsdAbi, functionName: 'decimals' }),
  client.readContract({ address: PHASE1_CONTRACTS.mockUsd, abi: mockUsdAbi, functionName: 'totalSupply' }),
  client.readContract({ address: PHASE1_CONTRACTS.mockUsd, abi: mockUsdAbi, functionName: 'balanceOf', args: [actor('issuer')] }),
  client.readContract({ address: PHASE1_CONTRACTS.mockUsd, abi: mockUsdAbi, functionName: 'balanceOf', args: [actor('alice')] }),
  client.readContract({ address: PHASE1_CONTRACTS.mockUsd, abi: mockUsdAbi, functionName: 'balanceOf', args: [actor('bob')] }),
  client.readContract({ address: PHASE1_CONTRACTS.mockUsd, abi: mockUsdAbi, functionName: 'balanceOf', args: [actor('charlie')] })
]);
assertEqual(usdDecimals, 6, 'MockUSD decimals');
assertEqual(usdSupply, 4_050_000_000n, 'MockUSD supply');
assertEqual(issuerUsd, 1_050_000_000n, 'issuer MockUSD');
assertEqual(aliceUsd, 1_000_000_000n, 'Alice MockUSD');
assertEqual(bobUsd, 1_000_000_000n, 'Bob MockUSD');
assertEqual(charlieUsd, 1_000_000_000n, 'Charlie MockUSD');

const [aliceEligible, bobEligible, charlieEligible, bondDecimals, bondCap, bondSupply] =
  await Promise.all([
    client.readContract({ address: PHASE1_CONTRACTS.eligibilityRegistry, abi: registryAbi, functionName: 'isEligible', args: [actor('alice')] }),
    client.readContract({ address: PHASE1_CONTRACTS.eligibilityRegistry, abi: registryAbi, functionName: 'isEligible', args: [actor('bob')] }),
    client.readContract({ address: PHASE1_CONTRACTS.eligibilityRegistry, abi: registryAbi, functionName: 'isEligible', args: [actor('charlie')] }),
    client.readContract({ address: PHASE1_CONTRACTS.bondToken, abi: bondAbi, functionName: 'decimals' }),
    client.readContract({ address: PHASE1_CONTRACTS.bondToken, abi: bondAbi, functionName: 'maxSupply' }),
    client.readContract({ address: PHASE1_CONTRACTS.bondToken, abi: bondAbi, functionName: 'totalSupply' })
  ]);
assertEqual(aliceEligible, true, 'Alice eligibility');
assertEqual(bobEligible, true, 'Bob eligibility');
assertEqual(charlieEligible, false, 'Charlie eligibility');
assertEqual(bondDecimals, 0, 'bond decimals');
assertEqual(bondCap, 10n, 'bond cap');
assertEqual(bondSupply, 0n, 'pre-subscription bond supply');

const mintAlice = encodeFunctionData({
  abi: bondAbi,
  functionName: 'mint',
  args: [actor('alice'), 1n]
});
await client.call({ account: actor('admin'), to: PHASE1_CONTRACTS.bondToken, data: mintAlice });

let charlieBlocked = false;
try {
  await client.call({
    account: actor('admin'),
    to: PHASE1_CONTRACTS.bondToken,
    data: encodeFunctionData({
      abi: bondAbi,
      functionName: 'mint',
      args: [actor('charlie'), 1n]
    })
  });
} catch {
  charlieBlocked = true;
}
assertEqual(charlieBlocked, true, 'Charlie simulated mint rejection');

let unauthorizedMintBlocked = false;
try {
  await client.call({ account: actor('charlie'), to: PHASE1_CONTRACTS.bondToken, data: mintAlice });
} catch {
  unauthorizedMintBlocked = true;
}
assertEqual(unauthorizedMintBlocked, true, 'unauthorized simulated mint rejection');

console.log('Phase 1 live deployment verified:');
console.log(`  MockUSD ${PHASE1_CONTRACTS.mockUsd}: 6 decimals, 4,050 seeded`);
console.log(`  Registry ${PHASE1_CONTRACTS.eligibilityRegistry}: Alice/Bob eligible, Charlie ineligible`);
console.log(`  Bond ${PHASE1_CONTRACTS.bondToken}: 0 decimals, cap 10, pre-subscription supply 0`);
console.log('  eth_call checks: Alice mint allowed; Charlie receipt and unauthorized mint rejected');

