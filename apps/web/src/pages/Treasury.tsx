import { formatMockUsd, type MilestoneId } from '@greenflow/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileCheck2, Upload } from 'lucide-react';
import { useState } from 'react';
import { Action, DashboardGate, Metric, Page, Panel, Status, short } from '../components/WorkflowUi';
import { API_URL, api } from '../lib/api';

type SafeguardScenario = 'POLICY_NOT_APPROVED' | 'UNKNOWN_VENDOR' | 'OVER_LIMIT';

function SafeguardRow({ label, detail, status, tone }: { label: string; detail: string; status: string; tone: 'neutral' | 'good' | 'warn' }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-cream p-3">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="mt-1 text-xs text-ink/50">{detail}</p>
      </div>
      <Status tone={tone}>{status}</Status>
    </div>
  );
}

function MilestoneSelect({
  label,
  value,
  milestones,
  onChange
}: {
  label: string;
  value: MilestoneId;
  milestones: Array<{ id: MilestoneId; label: string; maxAmountSubunits: string; completed: boolean }>;
  onChange: (value: MilestoneId) => void;
}) {
  return (
    <label className="block text-xs font-semibold text-ink/60">
      {label}
      <select
        className="mt-2 min-h-11 w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm font-semibold text-ink outline-none transition focus:border-leaf focus:ring-2 focus:ring-leaf/15"
        onChange={(event) => onChange(event.target.value as MilestoneId)}
        value={value}
      >
        {milestones.map((milestone) => (
          <option key={milestone.id} value={milestone.id}>
            {milestone.id} · {milestone.label} · {formatMockUsd(milestone.maxAmountSubunits)}
            {milestone.completed ? ' · Paid' : ''}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Treasury() {
  const queryClient = useQueryClient();
  const [selectedMilestone, setSelectedMilestone] = useState<MilestoneId>('M1');
  const [safeguardScenario, setSafeguardScenario] = useState<SafeguardScenario>('POLICY_NOT_APPROVED');
  const [uploadMessage, setUploadMessage] = useState('');
  const upload = useMutation({
    mutationFn: ({ file, milestoneId }: { file: File; milestoneId: MilestoneId }) =>
      api.uploadEvidence(file, milestoneId),
    onSuccess: () => {
      setUploadMessage('Evidence bytes stored and SHA-256 calculated.');
      void queryClient.invalidateQueries();
    },
    onError: (error) => setUploadMessage(error instanceof Error ? error.message : 'Upload failed.')
  });
  const selectMilestone = (milestoneId: MilestoneId) => {
    setSelectedMilestone(milestoneId);
    setUploadMessage('');
  };

  return (
    <Page
      eyebrow="Issuer workspace"
      title="Green proceeds treasury"
      intro="Propose the project policy, attach milestone-specific evidence, and submit a payment request against an approved milestone. Financial authority remains in the contract."
    >
      <DashboardGate>
        {(data) => {
          const issuer = data.activeActor.role === 'ISSUER';
          const milestone = data.project.milestones.find(({ id }) => id === selectedMilestone)!;
          const evidence = [...data.evidence].reverse().find(({ milestoneId }) => milestoneId === selectedMilestone);
          const request = data.requests.find(({ milestoneId }) => milestoneId === selectedMilestone);
          const milestoneChoices = data.project.milestones.map(({ id, label, maxAmountSubunits, completed }) => ({ id, label, maxAmountSubunits, completed }));
          const remainingLimit = (BigInt(milestone.maxAmountSubunits) - BigInt(milestone.spentSubunits)).toString();
          const policyApproved = data.project.status === 'ACTIVE';
          const canRunSafeguard = issuer && (
            safeguardScenario === 'POLICY_NOT_APPROVED'
              ? data.project.status === 'PROPOSED'
              : data.project.status === 'ACTIVE' && !request && !milestone.completed
          );
          const safeguardDescription = safeguardScenario === 'POLICY_NOT_APPROVED'
            ? 'Attempts a payment before verifier policy approval.'
            : safeguardScenario === 'UNKNOWN_VENDOR'
              ? 'Attempts payment to a vendor outside the approved policy.'
              : `Attempts more than ${selectedMilestone}'s remaining ${formatMockUsd(remainingLimit)} limit.`;

          return (
            <div className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-3">
                <Metric label="Ring-fenced balance" value={formatMockUsd(data.treasury.balanceSubunits)} />
                <Metric label="Released to vendors" value={formatMockUsd(data.treasury.totalReleasedSubunits)} />
                <Metric label="Project status" value={data.project.status.replace('_', ' ')} />
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <Panel title="PROJECT-001 · policy">
                  <div className="flex items-center justify-between">
                    <Status tone={data.project.status === 'ACTIVE' ? 'good' : 'neutral'}>{data.project.status}</Status>
                    <span className="text-sm font-semibold">{formatMockUsd(data.project.budgetSubunits || '0')} budget</span>
                  </div>
                  <p className="mt-4 text-sm font-medium">{data.project.name}</p>
                  <p className="mt-1 text-xs text-ink/50">Approved vendor: SolarSupply · {short(data.project.vendorAddress)}</p>
                  <div className="mt-4 grid gap-2">
                    {data.project.milestones.map((item) => (
                      <div className="flex justify-between rounded-xl bg-cream p-3 text-sm" key={item.id}>
                        <span>{item.id} · {item.label}</span>
                        <span className="font-semibold">{formatMockUsd(item.maxAmountSubunits)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5">
                    <Action disabled={!issuer || data.offering.state !== 'FULL' || data.project.status !== 'NOT_PROPOSED'} label="Propose policy on chain" run={api.proposeProject} />
                  </div>
                </Panel>

                <Panel title="Milestone evidence">
                  <MilestoneSelect label="Evidence milestone" milestones={milestoneChoices} onChange={selectMilestone} value={selectedMilestone} />
                  <div className="mt-4 rounded-xl border border-dashed border-ink/20 bg-cream p-4">
                    <FileCheck2 className="text-leaf" size={22} />
                    <p className="mt-2 text-sm font-semibold">Evidence for {selectedMilestone} · {milestone.label}</p>
                    <p className="mt-1 text-xs text-ink/50">PDF, PNG, or JPEG · maximum 5 MB. SHA-256 is computed from exact uploaded bytes; only the selected milestone&apos;s original digest is recorded on chain.</p>
                    <div className="mt-4 flex flex-wrap items-start gap-3">
                      <Action key={`sample-${selectedMilestone}`} disabled={!issuer || Boolean(evidence) || milestone.completed} label="Use fictional sample" run={() => api.sampleEvidence(selectedMilestone)} variant="secondary" />
                      <label className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-ink/15 bg-white px-4 py-2 text-sm font-semibold ${!issuer || evidence || milestone.completed ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}>
                        <Upload size={16} />Upload file
                        <input
                          accept=".pdf,.png,.jpg,.jpeg"
                          className="sr-only"
                          disabled={!issuer || Boolean(evidence) || milestone.completed || upload.isPending}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) upload.mutate({ file, milestoneId: selectedMilestone });
                          }}
                          type="file"
                        />
                      </label>
                    </div>
                    {uploadMessage ? <p className="mt-3 text-xs text-ink/60">{uploadMessage}</p> : null}
                  </div>
                  {evidence ? (
                    <div className="mt-4 rounded-xl bg-mint/20 p-3 text-xs">
                      <p className="font-semibold">{evidence.milestoneId} · {evidence.fileName} · {evidence.size} bytes</p>
                      <p className="mt-1 break-all font-mono text-[11px] text-ink/60">{evidence.sha256}</p>
                      <a className="mt-2 inline-block font-semibold underline" href={`${API_URL}${evidence.fileUrl}`} rel="noreferrer" target="_blank">Open PDF in new tab</a>
                    </div>
                  ) : null}
                </Panel>
              </div>

              <Panel title="Payment safeguards">
                <p className="text-sm leading-6 text-ink/60">Live controls for {selectedMilestone} · {milestone.label}. These checks are enforced again by the contract before any proceeds can move.</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <SafeguardRow detail={policyApproved ? 'The verifier has activated the canonical spending policy.' : data.project.status === 'PROPOSED' ? 'Waiting for independent verifier approval.' : 'The issuer must propose the policy first.'} label="Policy approval" status={policyApproved ? 'Approved' : 'Waiting'} tone={policyApproved ? 'good' : 'warn'} />
                  <SafeguardRow detail={evidence ? `${evidence.fileName} is attached to ${selectedMilestone}.` : `Attach evidence specifically for ${selectedMilestone}.`} label="Milestone evidence" status={evidence ? 'Attached' : 'Needed'} tone={evidence ? 'good' : 'warn'} />
                  <SafeguardRow detail={`SolarSupply · ${short(data.project.vendorAddress)}`} label="Policy vendor" status="Configured" tone="good" />
                  <SafeguardRow detail={`${formatMockUsd(remainingLimit)} remains for ${selectedMilestone}.`} label="Milestone limit" status={milestone.completed ? 'Spent' : 'Available'} tone={milestone.completed ? 'neutral' : 'good'} />
                  <SafeguardRow detail="Only the independent verifier can approve and release a pending request." label="Release authority" status="Enforced" tone="good" />
                </div>
                <details className="mt-4 rounded-xl border border-ink/10 bg-white p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-leaf">Demonstrate a blocked request</summary>
                  <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                    <label className="text-xs font-semibold text-ink/60">
                      Safeguard scenario
                      <select className="mt-2 min-h-11 w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm font-semibold text-ink outline-none transition focus:border-leaf focus:ring-2 focus:ring-leaf/15" onChange={(event) => setSafeguardScenario(event.target.value as SafeguardScenario)} value={safeguardScenario}>
                        <option value="POLICY_NOT_APPROVED">Payment before policy approval</option>
                        <option value="UNKNOWN_VENDOR">Payment to an unapproved vendor</option>
                        <option value="OVER_LIMIT">Payment above the selected milestone limit</option>
                      </select>
                    </label>
                    <Action key={`${selectedMilestone}-${safeguardScenario}`} disabled={!canRunSafeguard} label="Run safeguard test" run={() => api.attemptInvalid(safeguardScenario, selectedMilestone, evidence?.id)} variant="danger" />
                  </div>
                  <p className="mt-3 text-xs leading-5 text-ink/50">{safeguardDescription} The real local transaction is expected to revert without moving funds.</p>
                </details>
              </Panel>

              <Panel title="Submit payment request">
                <MilestoneSelect label="Payment request milestone" milestones={milestoneChoices} onChange={selectMilestone} value={selectedMilestone} />
                <p className="mt-4 text-sm text-ink/60">Request {formatMockUsd(milestone.maxAmountSubunits)} for {selectedMilestone} · {milestone.label}, payable to SolarSupply. Submission records the evidence digest but does not move funds; verifier approval and payment happen atomically later.</p>
                <div className="mt-5">
                  <Action key={`request-${selectedMilestone}`} disabled={!issuer || data.project.status !== 'ACTIVE' || !evidence || Boolean(request) || milestone.completed} label={`Request ${formatMockUsd(milestone.maxAmountSubunits)} for ${selectedMilestone}`} run={() => api.requestDisbursement(evidence!.id, selectedMilestone)} />
                </div>
                {request ? <p className="mt-3 text-xs">{selectedMilestone} request: <Status tone={request.state === 'PAID' ? 'good' : 'warn'}>{request.state}</Status></p> : null}
              </Panel>
            </div>
          );
        }}
      </DashboardGate>
    </Page>
  );
}
