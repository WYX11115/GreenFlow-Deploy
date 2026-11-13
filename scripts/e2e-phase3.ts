import type { DashboardResponse, EvidenceView } from '@greenflow/shared';

const apiUrl = `http://127.0.0.1:${process.env.API_PORT ?? '3001'}`;

async function call<T>(path: string, body?: unknown, expected = 200): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const payload = await response.json() as T;
  if (response.status !== expected) throw new Error(`${path}: expected ${expected}, got ${response.status}: ${JSON.stringify(payload)}`);
  return payload;
}

const select = (actorId: string) => call('/api/demo/actor', { actorId });
const post = (path: string, body: unknown = {}) => call(path, body);
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

console.log('Phase 3 E2E · reset and offering');
await select('admin');
await post('/api/demo/reset');
await select('issuer'); await post('/api/offering/open');
await select('alice'); await post('/api/subscriptions', { units: 6 });
await select('charlie');
const blockedInvestor = await call<{ code: string; txHash: string }>('/api/subscriptions', { units: 1 }, 409);
assert(blockedInvestor.code === 'INVESTOR_NOT_ELIGIBLE' && blockedInvestor.txHash, 'Charlie must have a reverted on-chain receipt.');
await select('bob'); await post('/api/subscriptions', { units: 4 });

console.log('Phase 3 E2E · policy and negative payment paths');
await select('issuer'); await post('/api/projects/propose');
await call('/api/disbursements/attempt-invalid', { kind: 'POLICY_NOT_APPROVED' }, 409);
await select('verifier'); await post('/api/projects/approve');
await select('issuer');
const evidence = await post<EvidenceView>('/api/evidence/sample');
await call('/api/disbursements/attempt-invalid', { kind: 'UNKNOWN_VENDOR', evidenceId: evidence.id }, 409);
await call('/api/disbursements/attempt-invalid', { kind: 'OVER_LIMIT', evidenceId: evidence.id }, 409);
await post('/api/disbursements', { evidenceId: evidence.id });

console.log('Phase 3 E2E · verifier atomic release and reconciliation');
await select('verifier'); await post('/api/disbursements/REQUEST-M1/approve');
const state = await call<DashboardResponse>('/api/dashboard');
const balance = (id: string) => state.balances.find((item) => item.actorId === id)!;
assert(state.offering.state === 'FULL' && state.offering.soldUnits === 10, 'Offering must be full at 10 units.');
assert(balance('alice').bondUnits === '6' && balance('bob').bondUnits === '4' && balance('charlie').bondUnits === '0', 'Only Alice and Bob may hold 6/4 units.');
assert(state.treasury.balanceSubunits === '700000000', 'Treasury must retain 700 MockUSD.');
assert(balance('vendor-a').mockUsdSubunits === '300000000', 'SolarSupply must receive 300 MockUSD.');
assert(state.project.spentSubunits === '300000000' && state.request?.state === 'PAID', 'M1 must be paid and project spend updated.');
assert(state.rejectedAttempts.length === 4, 'Four rejected attempts must remain separate from successful events.');
console.log('Phase 3 Gate passed: 6/4 issuance, Charlie blocked, three payment controls blocked, M1 atomically released, treasury 700, vendor 300.');
