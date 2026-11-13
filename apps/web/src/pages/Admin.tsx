import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Action, DashboardGate, Page, Panel, Status } from '../components/WorkflowUi';

export function Admin() {
  const navigate = useNavigate();

  return (
    <Page
      eyebrow="Platform controls"
      title="Administration"
      intro="Operate deterministic local-demo controls. Time travel and reset are explicit admin actions, never production capabilities."
    >
      <DashboardGate>
        {(data) => {
          const admin = data.activeActor.role === 'ADMIN';

          return (
            <div className="space-y-6">
              <div className="grid gap-6 xl:grid-cols-2">
                <Panel title="Local maturity control">
                  <div className="flex items-center justify-between">
                    <Status tone={data.servicing.recordDateFinalized ? 'good' : 'neutral'}>
                      {data.servicing.recordDateFinalized ? 'FINALIZED' : data.servicing.matured ? 'MATURED' : 'BEFORE MATURITY'}
                    </Status>
                    <span className="text-xs text-ink/45">Unix {data.servicing.maturityTimestamp}</span>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-ink/60">Advances Anvil to the configured maturity and finalizes the record date. Bond transfers then freeze permanently while vault-authorized redemption burns remain possible.</p>
                  <div className="mt-5">
                    <Action disabled={!admin || data.offering.state !== 'FULL' || data.servicing.outstandingFundingSubunits !== '0' || data.servicing.recordDateFinalized} label="Advance to maturity & finalize" run={api.advanceToMaturity} />
                  </div>
                </Panel>
                <Panel title="Emergency treasury control">
                  <p className="mb-4 text-sm text-ink/60">Pause or resume new green-proceeds operations. This does not move funds or affect the separate servicing vault.</p>
                  <div className="flex flex-wrap gap-4">
                    <Action disabled={!admin || data.treasury.paused} label="Pause treasury" run={() => api.setPaused(true)} variant="danger" />
                    <Action disabled={!admin || !data.treasury.paused} label="Unpause treasury" run={() => api.setPaused(false)} variant="secondary" />
                  </div>
                </Panel>
              </div>
              <div className="flex justify-end">
                <Action disabled={!admin} label="Reset six-contract demo" onDone={() => navigate('/demo', { replace: true })} run={api.reset} variant="danger" />
              </div>
            </div>
          );
        }}
      </DashboardGate>
    </Page>
  );
}
