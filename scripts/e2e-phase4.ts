import type { DashboardResponse, EvidenceView } from '@greenflow/shared';
import { createHash } from 'node:crypto';

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
const balance = (state: DashboardResponse, id: string) => state.balances.find((item) => item.actorId === id)!;

console.log('Phase 5 E2E · clean reset, issuance, and green-proceeds release');
await select('admin');
await post('/api/demo/reset');
let state = await call<DashboardResponse>('/api/dashboard');
assert(state.servicing.totalFundedSubunits === '0' && state.servicing.balanceSubunits === '0', 'Reset must restore an unfunded servicing vault.');
await select('issuer'); await post('/api/offering/open');
await select('alice'); await post('/api/subscriptions', { units: 6 });
await select('charlie');
const blockedInvestor = await call<{ code: string; txHash: string }>('/api/subscriptions', { units: 1 }, 409);
assert(blockedInvestor.code === 'INVESTOR_NOT_ELIGIBLE' && blockedInvestor.txHash, 'Charlie must have a reverted on-chain receipt.');
await select('bob'); await post('/api/subscriptions', { units: 4 });
await select('issuer'); await post('/api/projects/propose');
await call('/api/disbursements/attempt-invalid', { kind: 'POLICY_NOT_APPROVED' }, 409);
await select('verifier'); await post('/api/projects/approve');
await select('issuer');
const evidence = await post<EvidenceView>('/api/evidence/sample');
await call('/api/disbursements/attempt-invalid', { kind: 'UNKNOWN_VENDOR', evidenceId: evidence.id }, 409);
await call('/api/disbursements/attempt-invalid', { kind: 'OVER_LIMIT', evidenceId: evidence.id }, 409);
await post('/api/disbursements', { evidenceId: evidence.id });
await select('verifier'); await post('/api/disbursements/REQUEST-M1/approve');

console.log('Phase 5 E2E · evidence integrity and blocked control paths');
await select('issuer');
const downloadedEvidence = Buffer.from(await (await fetch(`${apiUrl}${evidence.fileUrl}`)).arrayBuffer());
assert(`0x${createHash('sha256').update(downloadedEvidence).digest('hex')}` === evidence.sha256, 'Downloaded evidence bytes must match the recorded SHA-256 digest.');
const modifiedEvidence = await post<EvidenceView>('/api/evidence', { fileName: 'M1-modified-demo.pdf', mimeType: 'application/pdf', base64: Buffer.from(`${downloadedEvidence.toString()}\nmodified`).toString('base64') });
assert(modifiedEvidence.sha256 !== evidence.sha256, 'Modified evidence bytes must produce a different SHA-256 digest.');
await select('alice');
state = await call<DashboardResponse>('/api/dashboard');
const aliceBeforeEarly = balance(state, 'alice');
await call('/api/servicing/claim', {}, 409);
let unchanged = await call<DashboardResponse>('/api/dashboard');
assert(balance(unchanged, 'alice').mockUsdSubunits === aliceBeforeEarly.mockUsdSubunits && balance(unchanged, 'alice').bondUnits === '6', 'Early claim must leave Alice unchanged.');
await call('/api/servicing/fund', {}, 409);
unchanged = await call<DashboardResponse>('/api/dashboard');
assert(unchanged.servicing.balanceSubunits === '0' && unchanged.treasury.balanceSubunits === '700000000', 'Unauthorized funding must leave both ledgers unchanged.');

console.log('Phase 5 E2E · issuer funding, maturity, and exact claims');
await select('issuer'); await post('/api/servicing/fund');
state = await call<DashboardResponse>('/api/dashboard');
assert(state.servicing.balanceSubunits === '1050000000' && state.servicing.outstandingFundingSubunits === '0', 'Issuer must fund exactly 1,050 MockUSD.');
assert(state.treasury.balanceSubunits === '700000000' && balance(state, 'issuer').mockUsdSubunits === '0', 'Servicing funding must be independent of the 700 MockUSD treasury.');
await select('admin'); await post('/api/demo/advance-to-maturity');

await select('alice'); await post('/api/servicing/claim');
state = await call<DashboardResponse>('/api/dashboard');
assert(balance(state, 'alice').mockUsdSubunits === '1030000000' && balance(state, 'alice').bondUnits === '0', 'Alice must receive 630 and retire 6 units.');
assert(state.servicing.totalPrincipalPaidSubunits === '600000000' && state.servicing.totalCouponPaidSubunits === '30000000' && state.servicing.balanceSubunits === '420000000', 'Alice servicing accounting must reconcile.');
const aliceAfter = balance(state, 'alice').mockUsdSubunits;
await call('/api/servicing/claim', {}, 409);
state = await call<DashboardResponse>('/api/dashboard');
assert(balance(state, 'alice').mockUsdSubunits === aliceAfter && state.servicing.balanceSubunits === '420000000', 'Double claim must not overpay Alice.');

await select('bob'); await post('/api/servicing/claim');
state = await call<DashboardResponse>('/api/dashboard');
assert(balance(state, 'bob').mockUsdSubunits === '1020000000' && balance(state, 'bob').bondUnits === '0', 'Bob must receive 420 and retire 4 units.');
assert(state.servicing.balanceSubunits === '0' && state.servicing.totalPrincipalPaidSubunits === '1000000000' && state.servicing.totalCouponPaidSubunits === '50000000' && state.servicing.totalUnitsRedeemed === '10', 'Final vault accounting must reconcile exactly.');
assert(state.servicing.activeInvestor.claimed && state.servicing.activeInvestor.units === '4' && state.servicing.activeInvestor.totalPaymentSubunits === '420000000', 'Bob claim history must remain visible after burn.');
assert(state.treasury.balanceSubunits === '700000000' && balance(state, 'vendor-a').mockUsdSubunits === '300000000', 'Green proceeds must remain 700 and vendor payment 300.');
assert(state.rejectedAttempts.length === 4, 'The four Phase 3 rejected attempts must remain separate from successful events.');
console.log('Phase 5 API Gate passed: exact evidence hash verified, modified bytes detected, rejected paths unchanged, Alice paid 630, Bob paid 420, vault 0, and green treasury remains 700.');
