import { useQuery } from '@tanstack/react-query';
import { LockKeyhole } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import {
  canAccessRoute,
  ROLE_LABELS,
  ROLE_RESTRICTED_ROUTES,
  ROLE_WORKSPACES,
  type RestrictedRoute
} from '../lib/roleAccess';

export function RoleRoute({ path, children }: { path: RestrictedRoute; children: ReactNode }) {
  const actors = useQuery({ queryKey: ['actors'], queryFn: api.actors });

  if (actors.isLoading) {
    return <div className="rounded-2xl bg-white p-8 text-sm text-ink/50">Checking presenter role…</div>;
  }

  if (!actors.data) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">The presenter actor service is unavailable. Start or reset the demo stack.</div>;
  }

  const activeActor = actors.data.actors.find(({ id }) => id === actors.data.activeActorId);
  if (activeActor && canAccessRoute(path, activeActor.role)) return children;

  const allowedRole = ROLE_RESTRICTED_ROUTES[path][0];
  const workspace = activeActor ? ROLE_WORKSPACES[activeActor.role] : ROLE_WORKSPACES.VENDOR;

  return (
    <section className="mx-auto max-w-2xl rounded-[24px] border border-amber-300/60 bg-white p-6 shadow-panel md:p-8" role="alert">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-amber-100 text-amber-900">
        <LockKeyhole aria-hidden="true" size={21} />
      </span>
      <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-amber-800">Role-specific workspace</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">This page is available only to the {ROLE_LABELS[allowedRole]} role.</h1>
      <p className="mt-3 text-sm leading-6 text-ink/60">
        Current presenter actor: <strong className="text-ink">{activeActor?.displayName ?? 'Unknown actor'} · {activeActor?.role ?? 'UNKNOWN'}</strong>.
        Switch actors from the presenter control, or continue in the current role&apos;s workspace.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link className="inline-flex min-h-11 items-center justify-center rounded-xl bg-moss px-4 py-2 text-sm font-semibold text-white transition hover:bg-leaf" to={workspace.to}>
          Open {workspace.label}
        </Link>
        <Link className="inline-flex min-h-11 items-center justify-center rounded-xl border border-ink/15 bg-white px-4 py-2 text-sm font-semibold transition hover:bg-cream" to="/demo">
          Return to Home
        </Link>
      </div>
    </section>
  );
}
