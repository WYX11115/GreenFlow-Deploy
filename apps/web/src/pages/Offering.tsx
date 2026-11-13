import { DEMO_TERMS, formatMockUsd } from '@greenflow/shared';
import { Action, DashboardGate, Metric, Page, Panel, Status } from '../components/WorkflowUi';
import { api } from '../lib/api';

export function Offering() {
  return (
    <Page
      eyebrow="Issuer workspace"
      title="Bond offering"
      intro="Issue ten whole demo bond units, then fund repayment from a separate issuer account. Green proceeds never fund debt service."
    >
      <DashboardGate>
        {(data) => {
          const issuer = data.activeActor.role === 'ISSUER';
          const holders = data.balances.filter(
            ({ actorId, bondUnits }) => (actorId === 'alice' || actorId === 'bob') && BigInt(bondUnits) > 0n
          );
          return (
            <div className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-3">
                <Metric label="Units sold" value={`${data.offering.soldUnits} / ${data.offering.totalUnits}`} />
                <Metric label="Proceeds raised" value={formatMockUsd(data.offering.raisedSubunits)} />
                <Metric label="Offering state" value={data.offering.state} />
              </div>
              <div className="grid gap-6 xl:grid-cols-2">
                <Panel title="GSGB-2026 · primary offering">
                  <div className="flex items-center justify-between"><Status tone={data.offering.state === 'FULL' ? 'good' : 'neutral'}>{data.offering.state}</Status><span className="text-sm font-semibold">{formatMockUsd(data.offering.faceValueSubunits)} / unit</span></div>
                  <dl className="mt-5 grid gap-3 text-sm"><div><dt className="text-ink/45">Issuer</dt><dd>{DEMO_TERMS.issuer}</dd></div><div><dt className="text-ink/45">Coupon</dt><dd>5.00% · one simulated period</dd></div><div><dt className="text-ink/45">Supply</dt><dd>10 whole units · no fractional units</dd></div></dl>
                  <div className="mt-5"><Action disabled={!issuer || data.offering.state !== 'DRAFT'} label="Open offering on chain" run={api.openOffering} /></div>
                </Panel>
                <Panel title="Issuer-funded servicing vault">
                  <div className="grid gap-3 sm:grid-cols-2"><Metric label="Required at maturity" value={formatMockUsd(data.servicing.requiredFundingSubunits)} /><Metric label="Vault balance" value={formatMockUsd(data.servicing.balanceSubunits)} /></div>
                  <p className="mt-4 text-sm leading-6 text-ink/60">The issuer contributes {formatMockUsd(DEMO_TERMS.servicingFundingSubunits)} independently: {formatMockUsd(DEMO_TERMS.servicingPrincipalSubunits)} principal plus {formatMockUsd(DEMO_TERMS.servicingCouponSubunits)} coupon. The ring-fenced treasury remains separate.</p>
                  <div className="mt-5"><Action disabled={!issuer || data.offering.state !== 'FULL' || data.servicing.outstandingFundingSubunits === '0'} label="Fund servicing vault" run={api.fundServicing} /></div>
                  {data.servicing.outstandingFundingSubunits === '0' ? <p className="mt-3 text-xs font-semibold text-leaf">Fully funded for maturity.</p> : <p className="mt-3 text-xs text-ink/50">Outstanding: {formatMockUsd(data.servicing.outstandingFundingSubunits)}</p>}
                </Panel>
              </div>
              <Panel title="Holder register">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead className="border-b border-ink/10 text-xs uppercase tracking-wider text-ink/45"><tr><th className="pb-3">Holder</th><th className="pb-3">Bond units</th><th className="pb-3">Subscribed bond value</th></tr></thead>
                    <tbody>
                      {holders.length ? holders.map((balance) => (
                        <tr className="border-b border-ink/5" key={balance.actorId}>
                          <td className="py-3 font-medium capitalize">{balance.actorId}</td>
                          <td className="py-3">{balance.bondUnits}</td>
                          <td className="py-3">{formatMockUsd((BigInt(balance.bondUnits) * BigInt(data.offering.faceValueSubunits)).toString())}</td>
                        </tr>
                      )) : <tr><td className="py-5 text-ink/50" colSpan={3}>No bondholders yet. Investor identities appear only after a successful subscription.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </div>
          );
        }}
      </DashboardGate>
    </Page>
  );
}
