import type { ActorListResponse, HealthResponse } from '@greenflow/shared';

const apiUrl = `http://127.0.0.1:${process.env.API_PORT ?? '3001'}`;
const webUrl = `http://127.0.0.1:${process.env.WEB_PORT ?? '5173'}`;
const rpcUrl = process.env.ANVIL_RPC_URL ?? 'http://127.0.0.1:8545';

async function expectOk(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}.`);
  return response;
}

const health = (await (await expectOk(`${apiUrl}/api/health`)).json()) as HealthResponse;
if (!health.chain.connected || !health.chain.contractsReady || health.chain.chainId !== 31_337) {
  throw new Error(`Expected connected chain 31337, received ${JSON.stringify(health.chain)}.`);
}

const actors = (await (await expectOk(`${apiUrl}/api/demo/actors`)).json()) as ActorListResponse;
if (actors.actors.length !== 8) {
  throw new Error(`Expected 8 deterministic actors, received ${actors.actors.length}.`);
}

const rpcResponse = await expectOk(rpcUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_accounts', params: [] })
});
const rpcAccounts = (await rpcResponse.json()) as { result?: string[] };
const expectedActors = actors.actors.map(({ address }) => address.toLowerCase());
const actualActors = rpcAccounts.result?.slice(0, expectedActors.length).map((address) => address.toLowerCase());
if (JSON.stringify(actualActors) !== JSON.stringify(expectedActors)) {
  throw new Error('Shared actor addresses do not match the deterministic Anvil account order.');
}

const switched = await expectOk(`${apiUrl}/api/demo/actor`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ actorId: 'bob' })
});
const selection = (await switched.json()) as { activeActorId?: string };
if (selection.activeActorId !== 'bob') {
  throw new Error('Actor switch did not persist in the API process.');
}

const web = await expectOk(webUrl);
const html = await web.text();
if (!html.includes('GreenFlow Bond')) {
  throw new Error('The web shell did not return the expected GreenFlow document.');
}

console.log('Phase 2 smoke gate passed:');
console.log(`  chain: ${health.chain.chainId}, block ${health.chain.latestBlock}, Phase 2 contracts ready`);
console.log(`  actors: ${actors.actors.length}, all RPC-matched, switch round-trip: Bob`);
console.log(`  web: ${webUrl} returned GreenFlow shell`);

