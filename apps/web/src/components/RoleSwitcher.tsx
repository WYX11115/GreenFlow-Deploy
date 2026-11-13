import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ShieldCheck, UserRoundCog } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { ROLE_WORKSPACES } from '../lib/roleAccess';

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function RoleSwitcher() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const actors = useQuery({ queryKey: ['actors'], queryFn: api.actors });
  const [error, setError] = useState<string | null>(null);
  const selection = useMutation({
    mutationFn: api.selectActor,
    onSuccess: (data) => {
      setError(null);
      queryClient.setQueryData(['actors'], data);
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      navigate(ROLE_WORKSPACES[data.activeActor.role].to, { replace: true });
    },
    onError: (reason) =>
      setError(reason instanceof Error ? reason.message : 'Unable to switch actor.')
  });

  if (!actors.data) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
        {actors.isError ? 'Actor service unavailable.' : 'Loading fictional actors…'}
      </div>
    );
  }

  const active = actors.data.actors.find(
    ({ id }) => id === actors.data.activeActorId
  );

  return (
    <section aria-labelledby="actor-heading" className="space-y-3">
      <div className="flex items-center gap-2 text-white/70">
        <UserRoundCog size={16} aria-hidden="true" />
        <h2 id="actor-heading" className="text-xs font-semibold uppercase tracking-[0.14em]">
          Presenter actor
        </h2>
      </div>
      <div className="relative">
        <select
          aria-label="Select fictional demo actor"
          className="w-full appearance-none rounded-xl border border-white/15 bg-white/10 px-3 py-3 pr-9 text-sm font-medium text-white outline-none transition focus:border-mint focus:ring-2 focus:ring-mint/25"
          data-testid="actor-select"
          disabled={selection.isPending}
          onChange={(event) => selection.mutate(event.target.value)}
          value={actors.data.activeActorId}
        >
          {actors.data.actors.map((actor) => (
            <option className="bg-ink text-white" key={actor.id} value={actor.id}>
              {actor.displayName} · {actor.role}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-3.5 text-white/60"
          size={16}
        />
      </div>
      {active ? (
        <div className="rounded-xl border border-mint/15 bg-mint/[0.07] p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-white">{active.displayName}</span>
            <span className="rounded-full bg-mint/15 px-2 py-0.5 text-[10px] font-bold tracking-wider text-mint">
              {active.role}
            </span>
          </div>
          <p className="mt-1 text-xs text-white/55">{active.organization}</p>
          <p className="mt-2 font-mono text-[11px] text-white/45">
            {shortAddress(active.address)}
          </p>
          <div className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-white/55">
            <ShieldCheck className="mt-0.5 shrink-0 text-mint" size={13} aria-hidden="true" />
            The API selects this local test signer. No private key is sent to the browser.
          </div>
        </div>
      ) : null}
      {error ? <p className="text-xs text-red-200">{error}</p> : null}
    </section>
  );
}

