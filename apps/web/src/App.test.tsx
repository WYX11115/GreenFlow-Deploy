import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DemoActor } from '@greenflow/shared';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

const address = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const admin: DemoActor = { id: 'admin', displayName: 'Platform Admin', organization: 'GreenFlow Platform', role: 'ADMIN', address, eligibleInvestor: null, description: 'Administrator' };
const issuer: DemoActor = { id: 'issuer', displayName: 'GreenSun Issuer', organization: 'GreenSun', role: 'ISSUER', address, eligibleInvestor: null, description: 'Issuer' };
const verifier: DemoActor = { id: 'verifier', displayName: 'Independent Verifier', organization: 'Verifier', role: 'VERIFIER', address, eligibleInvestor: null, description: 'Verifier' };
const alice: DemoActor = { id: 'alice', displayName: 'Alice', organization: 'Individual investor', role: 'INVESTOR', address, eligibleInvestor: true, description: 'Investor' };
const bob: DemoActor = { id: 'bob', displayName: 'Bob', organization: 'Individual investor', role: 'INVESTOR', address, eligibleInvestor: true, description: 'Investor' };
const charlie: DemoActor = { id: 'charlie', displayName: 'Charlie', organization: 'Individual investor', role: 'INVESTOR', address, eligibleInvestor: false, description: 'Investor' };
const actors = [admin, issuer, verifier, alice, bob, charlie];
let activeActor: DemoActor = issuer;
let investorUnits = { alice: '0', bob: '0', charlie: '0' };
let offeringState: 'DRAFT' | 'OPEN' = 'DRAFT';

beforeEach(() => {
  activeActor = issuer;
  investorUnits = { alice: '0', bob: '0', charlie: '0' };
  offeringState = 'DRAFT';
});

afterEach(cleanup);

vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (url.endsWith('/api/demo/actor') && init?.method === 'POST') {
    const actorId = JSON.parse(String(init.body)) as { actorId: string };
    activeActor = actors.find(({ id }) => id === actorId.actorId) ?? activeActor;
    return Response.json({ actors, activeActorId: activeActor.id, activeActor });
  }
  if (url.endsWith('/api/health')) return Response.json({ status: 'ok', service: 'greenflow-api', phase: 5, chain: { connected: true, contractsReady: true, chainId: 31337, expectedChainId: 31337, latestBlock: '1', rpcUrl: 'http://127.0.0.1:8545' }, contracts: {}, message: 'ok', timestamp: new Date(0).toISOString() });
  if (url.endsWith('/api/subscriptions') && init?.method === 'POST') return Response.json({ success: true, message: 'Subscribe confirmed on local chain 31337.', txHash: '0x1234' });
  if (url.endsWith('/api/dashboard')) return Response.json({ activeActor, offering: { id: 'GSGB-2026', symbol: 'GSGB', faceValueSubunits: '100000000', totalUnits: 10, soldUnits: 0, raisedSubunits: '0', state: offeringState }, treasury: { balanceSubunits: '0', totalReleasedSubunits: '0', paused: false }, servicing: { vaultAddress: address, balanceSubunits: '0', requiredFundingSubunits: '1050000000', totalFundedSubunits: '0', outstandingFundingSubunits: '1050000000', totalPrincipalPaidSubunits: '0', totalCouponPaidSubunits: '0', totalUnitsRedeemed: '0', maturityTimestamp: '1', currentTimestamp: '0', matured: false, recordDateFinalized: false, transfersFrozen: false, activeInvestor: { units: '0', principalSubunits: '0', couponSubunits: '0', totalPaymentSubunits: '0', claimed: false } }, project: { id: 'PROJECT-001', name: 'Solar Panels for Community Facilities', status: 'NOT_PROPOSED', budgetSubunits: '0', spentSubunits: '0', remainingSubunits: '0', vendorAddress: address, milestones: [{ id: 'M1', label: 'Equipment delivery', maxAmountSubunits: '300000000', spentSubunits: '0', completed: false }, { id: 'M2', label: 'Installation completion', maxAmountSubunits: '500000000', spentSubunits: '0', completed: false }] }, request: null, requests: [], balances: [{ actorId: 'alice', address, mockUsdSubunits: '1000000000', bondUnits: investorUnits.alice }, { actorId: 'bob', address, mockUsdSubunits: '1000000000', bondUnits: investorUnits.bob }, { actorId: 'charlie', address, mockUsdSubunits: '1000000000', bondUnits: investorUnits.charlie }], evidence: [], rejectedAttempts: [], events: [] });
  return Response.json({ actors, activeActorId: activeActor.id });
}));

describe('GreenFlow final MVP', () => {
  it('renders an active issuer offering action from chain state', async () => {
    render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={['/issuer/offerings']}><App /></MemoryRouter></QueryClientProvider>);
    expect(await screen.findByRole('heading', { name: 'Bond offering' })).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Open offering on chain' })).toBeTruthy();
    expect(screen.getAllByText('$0').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Offering' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Treasury' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Use of proceeds' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Verifier desk' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Investor view' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Administration' })).toBeNull();
    const register = (await screen.findByRole('heading', { name: 'Holder register' })).closest('section')!;
    expect(within(register).getByText(/No bondholders yet/)).toBeTruthy();
    expect(within(register).queryByText(/alice/i)).toBeNull();
    expect(within(register).queryByText(/bob/i)).toBeNull();
    expect(within(register).queryByText(/charlie/i)).toBeNull();
    expect(within(register).queryByText('MockUSD')).toBeNull();
  });

  it('reveals only subscribed holders and their subscribed bond value', async () => {
    investorUnits = { alice: '6', bob: '4', charlie: '0' };
    render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={['/issuer/offerings']}><App /></MemoryRouter></QueryClientProvider>);

    const register = (await screen.findByRole('heading', { name: 'Holder register' })).closest('section')!;
    expect(within(register).getByText(/alice/i)).toBeTruthy();
    expect(within(register).getByText(/bob/i)).toBeTruthy();
    expect(within(register).queryByText(/charlie/i)).toBeNull();
    expect(within(register).getByText('$600')).toBeTruthy();
    expect(within(register).getByText('$400')).toBeTruthy();
    expect(within(register).getByText('Subscribed bond value')).toBeTruthy();
    expect(within(register).queryByText('MockUSD')).toBeNull();
  });

  it('opens Home with the issuer selected at the root route', async () => {
    render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={['/']}><App /></MemoryRouter></QueryClientProvider>);
    expect(await screen.findByText('Next presenter move')).toBeTruthy();
    expect(await screen.findByText('Open the offering')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Home' })).toBeTruthy();
    expect(screen.queryByText('Blocked payment demonstrated')).toBeNull();
    expect(screen.queryByText('M1 paid · treasury 700')).toBeNull();
  });

  it('opens the new role default workspace after switching actors', async () => {
    activeActor = verifier;
    render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={['/verifier']}><App /></MemoryRouter></QueryClientProvider>);
    expect(await screen.findByRole('heading', { name: 'Verifier desk' })).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Select fictional demo actor'), { target: { value: 'issuer' } });

    expect(await screen.findByRole('heading', { name: 'Bond offering' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: /This page is available only/ })).toBeNull();
  });

  it('keeps the evidence and payment-request milestone selectors synchronized', async () => {
    render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={['/issuer/treasury']}><App /></MemoryRouter></QueryClientProvider>);
    expect(await screen.findByRole('heading', { name: 'Green proceeds treasury' })).toBeTruthy();

    fireEvent.change(await screen.findByLabelText('Evidence milestone'), { target: { value: 'M2' } });

    expect((screen.getByLabelText('Payment request milestone') as HTMLSelectElement).value).toBe('M2');
    expect(screen.getByText('Evidence for M2 · Installation completion')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Request $500 for M2' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Payment safeguards' })).toBeTruthy();
    expect(screen.getByText('Demonstrate a blocked request')).toBeTruthy();
    expect((screen.getByLabelText('Safeguard scenario') as HTMLSelectElement).value).toBe('POLICY_NOT_APPROVED');
    expect(screen.getByRole('button', { name: 'Run safeguard test' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Contract-enforced payment tests' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Try before approval' })).toBeNull();

    const uploadButton = screen.getByText('Upload file').closest('label')!;
    expect(uploadButton.className).toContain('h-11');
    expect(uploadButton.parentElement?.className).toContain('items-start');
    fireEvent.click(screen.getByRole('button', { name: 'Use fictional sample' }));
    expect(await screen.findByRole('status')).toBeTruthy();
    expect(uploadButton.className).toContain('h-11');
  });

  it('shows Charlie a neutral Subscribe action with one unit prefilled and no holder register', async () => {
    activeActor = charlie;
    render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={['/investor']}><App /></MemoryRouter></QueryClientProvider>);

    expect((await screen.findByLabelText('Units') as HTMLInputElement).value).toBe('1');
    const availableUnits = (await screen.findByText('Available bond units')).parentElement!;
    expect(within(availableUnits).getByText('10')).toBeTruthy();
    const subscribe = screen.getByRole('button', { name: 'Subscribe' });
    expect(subscribe.className).toContain('bg-moss');
    expect(screen.queryByRole('heading', { name: 'Holder register' })).toBeNull();
  });

  it('keeps the subscription controls aligned and places the result below them', async () => {
    activeActor = alice;
    offeringState = 'OPEN';
    render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={['/investor']}><App /></MemoryRouter></QueryClientProvider>);

    const subscribe = await screen.findByRole('button', { name: 'Subscribe' });
    expect(subscribe.parentElement?.className).toBe('contents');
    expect(subscribe.className).toContain('w-full');
    expect(subscribe.parentElement?.parentElement?.className).toContain('grid-cols-[7rem_7rem_minmax(0,1fr)]');
    fireEvent.click(subscribe);

    const result = await screen.findByRole('status');
    expect(result.className).toContain('col-span-full');
    expect(result.className).toContain('w-fit');
    expect(result.textContent).toContain('Subscribe confirmed');
  });

  it('blocks a direct admin route for the active issuer', async () => {
    render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={['/admin']}><App /></MemoryRouter></QueryClientProvider>);
    expect(await screen.findByRole('heading', { name: 'This page is available only to the Platform Admin role.' })).toBeTruthy();
    expect(screen.getByText(/Current presenter actor:/)).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Administration' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Open Offering' })).toBeTruthy();
  });

  it('keeps the admin reset action without deployment-address diagnostics', async () => {
    activeActor = admin;
    render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={['/admin']}><App /></MemoryRouter></QueryClientProvider>);

    expect(await screen.findByRole('heading', { name: 'Administration' })).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Reset six-contract demo' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Deterministic deployment' })).toBeNull();
  });
});
