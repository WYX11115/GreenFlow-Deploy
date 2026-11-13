import { formatMockUsd, type MilestoneId } from '@greenflow/shared';
import { useState } from 'react';
import { Action, DashboardGate, Page, Panel, Status, short } from '../components/WorkflowUi';
import { API_URL, api } from '../lib/api';

export function Verifier() {
  const [selectedMilestone, setSelectedMilestone] = useState<MilestoneId>('M1');

  return (
    <Page
      eyebrow="Independent control"
      title="Verifier desk"
      intro="Activate policy, select a milestone request, and review its off-chain evidence digest. Approval and vendor payment are one atomic transaction."
    >
      <DashboardGate>
        {(data) => {
          const verifier = data.activeActor.role === 'VERIFIER';
          const request = data.requests.find(({ milestoneId }) => milestoneId === selectedMilestone);
          return (
            <div className="grid gap-6 xl:grid-cols-2">
              <Panel title="Policy review">
                <div className="flex justify-between">
                  <Status tone={data.project.status === 'ACTIVE' ? 'good' : 'warn'}>{data.project.status}</Status>
                  <span className="font-semibold">{formatMockUsd(data.project.budgetSubunits)}</span>
                </div>
                <dl className="mt-5 grid gap-3 text-sm">
                  <div><dt className="text-ink/45">Project</dt><dd>{data.project.id} · {data.project.name}</dd></div>
                  <div><dt className="text-ink/45">Vendor</dt><dd>SolarSupply · {short(data.project.vendorAddress)}</dd></div>
                  <div><dt className="text-ink/45">Milestones</dt><dd>{data.project.milestones.map((item) => `${item.id} ${formatMockUsd(item.maxAmountSubunits)}`).join(' · ')}</dd></div>
                </dl>
                <div className="mt-5"><Action disabled={!verifier || data.project.status !== 'PROPOSED'} label="Approve project policy" run={api.approveProject} /></div>
              </Panel>

              <Panel title="Milestone evidence & release">
                <label className="block text-xs font-semibold text-ink/60">
                  Request milestone
                  <select
                    className="mt-2 min-h-11 w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm font-semibold text-ink outline-none transition focus:border-leaf focus:ring-2 focus:ring-leaf/15"
                    onChange={(event) => setSelectedMilestone(event.target.value as MilestoneId)}
                    value={selectedMilestone}
                  >
                    {data.project.milestones.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.label}</option>)}
                  </select>
                </label>
                {request ? (
                  <div className="mt-4">
                    <div className="flex justify-between"><Status tone={request.state === 'PAID' ? 'good' : 'warn'}>{request.state}</Status><span className="font-semibold">{formatMockUsd(request.amountSubunits)}</span></div>
                    <p className="mt-4 text-xs font-semibold text-ink/60">{request.milestoneId} evidence digest</p>
                    <p className="mt-1 break-all font-mono text-[11px] text-ink/55">{request.evidenceHash}</p>
                    {request.evidence ? <a className="mt-3 inline-block text-sm font-semibold text-leaf underline" href={`${API_URL}${request.evidence.fileUrl}`} rel="noreferrer" target="_blank">Open {request.evidence.fileName} in new tab</a> : <p className="mt-3 text-xs text-amber-800">The digest is on-chain; local evidence metadata is unavailable.</p>}
                    <p className="mt-4 text-xs leading-5 text-ink/50">Environmental verification is an off-chain attestation. This digest is not autonomous proof of impact.</p>
                    <div className="mt-5 flex flex-wrap gap-4">
                      <Action key={`approve-${request.id}`} disabled={!verifier || request.state !== 'PENDING_VERIFICATION' || data.treasury.paused} label="Approve & release atomically" run={() => api.approveRelease(request.id)} />
                      <Action key={`reject-${request.id}`} disabled={!verifier || request.state !== 'PENDING_VERIFICATION'} label="Reject request" run={() => api.rejectRequest(request.id)} variant="danger" />
                    </div>
                  </div>
                ) : <p className="mt-4 text-sm text-ink/55">No {selectedMilestone} payment request has been submitted.</p>}
              </Panel>
            </div>
          );
        }}
      </DashboardGate>
    </Page>
  );
}
