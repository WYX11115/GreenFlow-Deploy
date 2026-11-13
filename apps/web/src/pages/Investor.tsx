import { formatMockUsd } from '@greenflow/shared';
import { useState } from 'react';
import { Action, DashboardGate, Metric, Page, Panel, Status } from '../components/WorkflowUi';
import { api } from '../lib/api';

const DEMO_UNITS: Record<string, number> = { alice: 6, bob: 4, charlie: 1 };

function SubscriptionPanel({ actorId, canSubscribe }: { actorId: string; canSubscribe: boolean }) {
  const [units, setUnits] = useState(String(DEMO_UNITS[actorId] ?? 1));
  const parsedUnits = Number(units);
  const validUnits = Number.isInteger(parsedUnits) && parsedUnits >= 1 && parsedUnits <= 10;

  return (
    <Panel title="Primary subscription">
      <p className="text-sm leading-6 text-ink/60">Choose the number of whole bond units to purchase. Payment and issuance complete atomically on the local chain.</p>
      <div className="mt-5 grid grid-cols-[7rem_7rem_minmax(0,1fr)] items-end gap-x-3 gap-y-2">
        <label className="text-xs font-semibold text-ink/60">
          Units
          <input
            className="mt-2 block min-h-11 w-28 rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm font-semibold text-ink outline-none transition focus:border-leaf focus:ring-2 focus:ring-leaf/15"
            inputMode="numeric"
            max={10}
            min={1}
            onChange={(event) => setUnits(event.target.value)}
            step={1}
            type="number"
            value={units}
          />
        </label>
        <Action disabled={!canSubscribe || !validUnits} label="Subscribe" layout="form-grid" run={() => api.subscribe(parsedUnits)} />
      </div>
      {!validUnits ? <p className="mt-3 text-xs text-red-700">Enter between 1 and 10 whole units.</p> : null}
    </Panel>
  );
}

export function Investor() {
  return (
    <Page
      eyebrow="Investor workspace"
      title="Investor holdings & repayment"
      intro="Subscribe as a deterministic demo investor, inspect authoritative holdings, and claim principal plus coupon after the local maturity control is finalized."
    >
      <DashboardGate>
        {(data) => {
          const investor = data.activeActor.role === 'INVESTOR';
          const activeBalance = data.balances.find((balance) => balance.actorId === data.activeActor.id);
          const canSubscribe = investor && data.offering.state === 'OPEN';
          const entitlement = data.servicing.activeInvestor;
          return (
            <div className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Metric label="My bond units" value={activeBalance?.bondUnits ?? '0'} />
                <Metric label="Available bond units" value={String(Math.max(data.offering.totalUnits - data.offering.soldUnits, 0))} />
                <Metric label="My MockUSD" value={formatMockUsd(activeBalance?.mockUsdSubunits ?? '0')} />
                <Metric label="Eligibility" value={data.activeActor.eligibleInvestor === true ? 'Eligible' : 'Not eligible'} />
              </div>
              <div className="grid gap-6 xl:grid-cols-2">
                <SubscriptionPanel actorId={data.activeActor.id} canSubscribe={canSubscribe} key={data.activeActor.id} />
                <Panel title="Combined maturity claim">
                  <div className="flex items-center justify-between"><Status tone={entitlement.claimed ? 'good' : data.servicing.recordDateFinalized ? 'warn' : 'neutral'}>{entitlement.claimed ? 'CLAIMED' : data.servicing.recordDateFinalized ? 'CLAIMS OPEN' : 'NOT MATURED'}</Status><span className="text-xs text-ink/50">Transfers {data.servicing.transfersFrozen ? 'frozen' : 'active'}</span></div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2"><Metric label="Principal" value={formatMockUsd(entitlement.principalSubunits)} /><Metric label="Coupon" value={formatMockUsd(entitlement.couponSubunits)} /><Metric label="Total entitlement" value={formatMockUsd(entitlement.totalPaymentSubunits)} /><Metric label="Units at claim" value={entitlement.units} /></div>
                  <p className="mt-4 text-xs leading-5 text-ink/50">Claim is one atomic transaction: the vault retires the investor&apos;s bond units and pays principal plus coupon. A second claim is contract-blocked.</p>
                  <div className="mt-5"><Action disabled={!investor || entitlement.units === '0' || entitlement.claimed || data.offering.state !== 'FULL'} label={data.servicing.recordDateFinalized ? 'Claim maturity payment' : 'Attempt claim before maturity'} run={api.claimMaturityPayment} variant={data.servicing.recordDateFinalized ? 'primary' : 'danger'} /></div>
                </Panel>
              </div>
            </div>
          );
        }}
      </DashboardGate>
    </Page>
  );
}
