import { DEMO_TERMS, formatMockUsd, type DashboardResponse } from '@greenflow/shared';
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Blocks,
  CheckCircle2,
  Circle,
  CircleDollarSign,
  LockKeyhole,
  ScanSearch,
  ShieldCheck
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { DashboardGate } from '../components/WorkflowUi';

const story = [
  ['01', 'Eligibility', 'Alice and Bob qualify; Charlie demonstrates a blocked subscription.'],
  ['02', 'Issuance', 'Ten whole bond units route 1,000 mock USD into ring-fenced proceeds.'],
  ['03', 'Control', 'A verifier authorizes project, vendor, milestone, and budget policy.'],
  ['04', 'Release', 'Verified evidence triggers an atomic 300 mock USD vendor payment.'],
  ['05', 'Oversight', 'Investors inspect confirmed receipts, hashes, and remaining proceeds.'],
  ['06', 'Servicing', 'A separate issuer-funded vault pays coupon and principal.']
] as const;

function nextPresenterMove(data: DashboardResponse) {
  const blockedInvestor = data.rejectedAttempts.some(({ kind }) => kind === 'INELIGIBLE_INVESTOR');
  const blockedBeforePolicy = data.rejectedAttempts.some(({ kind }) => kind === 'POLICY_NOT_APPROVED');
  const blockedVendor = data.rejectedAttempts.some(({ kind }) => kind === 'UNKNOWN_VENDOR');
  const aliceClaimed = data.balances.find(({ actorId }) => actorId === 'alice')?.bondUnits === '0' && data.servicing.totalUnitsRedeemed !== '0';
  if (data.offering.state === 'DRAFT') return { role: 'Issuer', action: 'Open the offering', to: '/issuer/offerings' };
  if (data.offering.soldUnits === 0) return { role: 'Alice', action: 'Subscribe for 6 units', to: '/investor' };
  if (data.offering.soldUnits === 6 && !blockedInvestor) return { role: 'Charlie', action: 'Attempt the blocked subscription', to: '/investor' };
  if (data.offering.soldUnits < 10) return { role: 'Bob', action: 'Subscribe for the remaining 4 units', to: '/investor' };
  if (data.project.status === 'NOT_PROPOSED') return { role: 'Issuer', action: 'Propose PROJECT-001 policy', to: '/issuer/treasury' };
  if (data.project.status === 'PROPOSED' && !blockedBeforePolicy) return { role: 'Issuer', action: 'Demonstrate payment before approval being blocked', to: '/issuer/treasury' };
  if (data.project.status === 'PROPOSED') return { role: 'Verifier', action: 'Independently approve the project policy', to: '/verifier' };
  if (!data.evidence.some(({ milestoneId }) => milestoneId === 'M1')) return { role: 'Issuer', action: 'Attach the fictional M1 evidence', to: '/issuer/treasury' };
  if (!blockedVendor && !data.request) return { role: 'Issuer', action: 'Demonstrate a blocked payment', to: '/issuer/treasury' };
  if (!data.request) return { role: 'Issuer', action: 'Submit the valid 300 MockUSD M1 request', to: '/issuer/treasury' };
  if (data.request.state === 'PENDING_VERIFICATION') return { role: 'Verifier', action: 'Review evidence and approve & release atomically', to: '/verifier' };
  if (data.servicing.outstandingFundingSubunits !== '0') return { role: 'Issuer', action: 'Fund the separate servicing vault', to: '/issuer/offerings' };
  if (!data.servicing.recordDateFinalized) return { role: 'Admin', action: 'Advance local time and finalize maturity', to: '/admin' };
  if (!aliceClaimed) return { role: 'Alice', action: 'Claim 630 MockUSD and retire 6 units', to: '/investor' };
  if (data.servicing.totalUnitsRedeemed !== '10') return { role: 'Bob', action: 'Claim 420 MockUSD and retire 4 units', to: '/investor' };
  return { role: 'Any investor', action: 'Review the two reconciled ledgers', to: '/impact' };
}

export function Demo() {
  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[28px] bg-moss px-6 py-8 text-white shadow-panel md:px-10 md:py-10">
        <div className="absolute -right-20 -top-28 h-72 w-72 rounded-full border-[48px] border-mint/[0.08]" />
        <div className="absolute -bottom-32 right-40 h-64 w-64 rounded-full bg-mint/[0.06]" />
        <div className="relative grid gap-8 xl:grid-cols-[1.35fr_0.65fr] xl:items-end">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-mint/30 bg-mint/10 px-3 py-1 text-xs font-semibold text-mint">
              <ShieldCheck size={14} aria-hidden="true" />
              Programmable use-of-proceeds controls
            </div>
            <h1 className="max-w-3xl text-4xl font-semibold leading-[1.05] tracking-[-0.045em] md:text-6xl">
              Green capital, with guardrails before money moves.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-white/65 md:text-base">
              GreenFlow&apos;s working MVP links bond issuance to an independently verified treasury and issuer-funded repayment.
              Use the role switcher and navigation to complete every step in the browser with
              receipt-confirmed local transactions.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur">
              <p className="text-xs text-white/50">Issue size</p>
              <p className="mt-2 text-2xl font-semibold">{formatMockUsd(DEMO_TERMS.totalProceedsSubunits)}</p>
              <p className="mt-1 text-[11px] text-mint/65">mock USD · 10 units</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur">
              <p className="text-xs text-white/50">Annual coupon</p>
              <p className="mt-2 text-2xl font-semibold">5.00%</p>
              <p className="mt-1 text-[11px] text-mint/65">one simulated period</p>
            </div>
          </div>
        </div>
      </section>

      <DashboardGate>{(data) => {
        const next = nextPresenterMove(data);
        const checkpoints = [
          ['10 / 10 units issued', data.offering.state === 'FULL'],
          ['Policy independently approved', data.project.status === 'ACTIVE'],
          ['Servicing funded separately', data.servicing.outstandingFundingSubunits === '0'],
          ['10 / 10 units redeemed', data.servicing.totalUnitsRedeemed === '10']
        ] as const;
        return <section className="grid gap-4 rounded-[24px] border border-leaf/20 bg-white p-5 shadow-panel lg:grid-cols-[1fr_auto] lg:items-center md:p-6" data-testid="presenter-guide"><div><div className="flex items-center gap-2"><span className="rounded-full bg-mint/35 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-moss">Next presenter move</span><span className="text-xs font-semibold text-leaf">Select {next.role}</span></div><h2 className="mt-3 text-xl font-semibold tracking-tight">{next.action}</h2><div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">{checkpoints.map(([label, done]) => <span className={`inline-flex items-center gap-1.5 text-xs ${done ? 'font-semibold text-leaf' : 'text-ink/40'}`} key={label}>{done ? <CheckCircle2 size={14} aria-hidden="true" /> : <Circle size={14} aria-hidden="true" />}{label}</span>)}</div></div><Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-moss px-5 py-2 text-sm font-semibold text-white transition hover:bg-leaf" to={next.to}>Go to action <ArrowRight size={16} aria-hidden="true" /></Link></section>;
      }}</DashboardGate>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-ink/10 bg-white p-5 shadow-panel">
          <div className="flex items-center justify-between">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-mint/35 text-moss">
              <Blocks size={19} aria-hidden="true" />
            </span>
            <span className="rounded-full bg-mint/25 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-moss">
              Live now
            </span>
          </div>
          <h2 className="mt-5 font-semibold">Local chain foundation</h2>
          <p className="mt-2 text-sm leading-6 text-ink/55">
            Anvil connectivity and deterministic actors are real and health-checked.
          </p>
        </article>
        <article className="rounded-2xl border border-ink/10 bg-white p-5 shadow-panel">
          <div className="flex items-center justify-between">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-sun/35 text-ink">
              <LockKeyhole size={19} aria-hidden="true" />
            </span>
            <span className="rounded-full bg-ink/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-ink/50">
              Live now
            </span>
          </div>
          <h2 className="mt-5 font-semibold">Eligibility enforcement</h2>
          <p className="mt-2 text-sm leading-6 text-ink/55">
            Alice and Bob are eligible on-chain; Charlie cannot receive the restricted token.
          </p>
        </article>
        <article className="rounded-2xl border border-ink/10 bg-white p-5 shadow-panel">
          <div className="flex items-center justify-between">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#dfe8ff] text-[#3658a3]">
              <ScanSearch size={19} aria-hidden="true" />
            </span>
            <span className="rounded-full bg-ink/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-ink/50">
              Live now
            </span>
          </div>
          <h2 className="mt-5 font-semibold">Investor transparency</h2>
          <p className="mt-2 text-sm leading-6 text-ink/55">
            Confirmed receipts, evidence hashes, holdings, and proceeds now come from chain state.
          </p>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="rounded-[24px] border border-ink/10 bg-white p-6 shadow-panel md:p-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-leaf">Canonical story</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">One coherent funding journey</h2>
            </div>
            <span className="text-xs text-ink/45">Planned 5–7 minute walkthrough</span>
          </div>
          <ol className="mt-6 grid gap-x-6 md:grid-cols-2">
            {story.map(([number, title, description]) => (
              <li className="group flex gap-4 border-t border-ink/10 py-5" key={number}>
                <span className="font-mono text-xs font-bold text-leaf">{number}</span>
                <div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-1 text-sm leading-6 text-ink/55">{description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <aside className="rounded-[24px] bg-ink p-6 text-white shadow-panel">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-mint">Final MVP truth panel</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">Enforced on-chain, not simulated in UI.</h2>
          <div className="mt-6 space-y-4 text-sm text-white/65">
            <div className="flex gap-3">
              <BadgeCheck className="mt-0.5 shrink-0 text-mint" size={18} aria-hidden="true" />
              <p>Role switching uses the selected deterministic local actor.</p>
            </div>
            <div className="flex gap-3">
              <Banknote className="mt-0.5 shrink-0 text-white/35" size={18} aria-hidden="true" />
              <p>Offering, treasury, and maturity repayment rules are real local contracts; startup keeps a clean state.</p>
            </div>
            <div className="flex gap-3">
              <CircleDollarSign className="mt-0.5 shrink-0 text-white/35" size={18} aria-hidden="true" />
              <p>Claims retire bond units and pay principal plus coupon atomically; no success state is fabricated.</p>
            </div>
          </div>
          <Link
            className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-mint transition hover:text-white"
            to="/issuer/offerings"
          >
            Start the live offering <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </aside>
      </section>

      <section className="rounded-2xl border border-amber-500/25 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-950">
        <strong>Compliance status:</strong> demo eligibility simulation active. The official
        T-REX/ONCHAINID suite was assessed but is not integrated into this MVP. This restricted token
        is not described as ERC-3643 compliant and does not perform genuine KYC.
      </section>
    </div>
  );
}

