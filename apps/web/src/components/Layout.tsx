import {
  BadgeDollarSign,
  Building2,
  CircleUserRound,
  Gauge,
  Leaf,
  Menu,
  Route,
  ShieldCheck,
  Trees,
  X
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { api } from '../lib/api';
import { canAccessRoute } from '../lib/roleAccess';
import { ChainHealthIndicator } from './ChainHealthIndicator';
import { DemoBanner } from './DemoBanner';
import { RoleSwitcher } from './RoleSwitcher';

const navigation = [
  { to: '/demo', label: 'Home', icon: Gauge },
  { to: '/issuer/offerings', label: 'Offering', icon: BadgeDollarSign },
  { to: '/issuer/treasury', label: 'Treasury', icon: Building2 },
  { to: '/verifier', label: 'Verifier desk', icon: ShieldCheck },
  { to: '/investor', label: 'Investor view', icon: CircleUserRound },
  { to: '/impact', label: 'Use of proceeds', icon: Trees },
  { to: '/admin', label: 'Administration', icon: Route }
] as const;

export function Layout() {
  const [open, setOpen] = useState(false);
  const actors = useQuery({ queryKey: ['actors'], queryFn: api.actors });
  const activeRole = actors.data?.actors.find(({ id }) => id === actors.data.activeActorId)?.role;
  const visibleNavigation = navigation.filter(({ to }) => canAccessRoute(to, activeRole));

  return (
    <div className="min-h-screen bg-cream text-ink">
      <DemoBanner />
      <div className="min-h-[calc(100vh-32px)] lg:grid lg:grid-cols-[280px_1fr]">
        <aside
          className={`${open ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-40 flex w-[280px] flex-col bg-ink px-5 py-6 text-white transition-transform lg:static lg:translate-x-0`}
        >
          <div className="flex items-center justify-between">
            <NavLink className="flex items-center gap-3" onClick={() => setOpen(false)} to="/demo">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-mint text-ink shadow-lg shadow-black/20">
                <Leaf size={21} strokeWidth={2.4} aria-hidden="true" />
              </span>
              <span>
                <span className="block text-lg font-semibold tracking-tight">GreenFlow</span>
                <span className="block text-[10px] uppercase tracking-[0.2em] text-mint/70">
                  Bond protocol
                </span>
              </span>
            </NavLink>
            <button
              aria-label="Close navigation"
              className="rounded-lg p-2 text-white/60 hover:bg-white/10 lg:hidden"
              onClick={() => setOpen(false)}
              type="button"
            >
              <X size={20} />
            </button>
          </div>

          <nav aria-label="Primary" className="mt-9 space-y-1">
            {visibleNavigation.map(({ to, label, icon: Icon }) => (
              <NavLink
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                    isActive
                      ? 'bg-white text-ink shadow-md'
                      : 'text-white/60 hover:bg-white/[0.07] hover:text-white'
                  }`
                }
                key={to}
                onClick={() => setOpen(false)}
                to={to}
              >
                <Icon size={17} aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto pt-8">
            <RoleSwitcher />
          </div>
        </aside>

        {open ? (
          <button
            aria-label="Close navigation overlay"
            className="fixed inset-0 z-30 bg-ink/50 backdrop-blur-sm lg:hidden"
            onClick={() => setOpen(false)}
            type="button"
          />
        ) : null}

        <div className="min-w-0">
          <header className="flex h-20 items-center justify-between border-b border-ink/10 bg-cream/90 px-5 backdrop-blur md:px-8">
            <div className="flex items-center gap-3">
              <button
                aria-label="Open navigation"
                className="rounded-xl border border-ink/10 bg-white p-2.5 shadow-sm lg:hidden"
                onClick={() => setOpen(true)}
                type="button"
              >
                <Menu size={20} />
              </button>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-leaf">
                  GreenSun Solar Green Bond 2026
                </p>
                <p className="mt-0.5 text-xs text-ink/50">Fictional product · presentation-ready local MVP</p>
              </div>
            </div>
            <div className="hidden sm:block">
              <ChainHealthIndicator />
            </div>
          </header>
          <main className="mx-auto max-w-[1440px] p-5 md:p-8 lg:p-10">
            <div className="mb-5 sm:hidden">
              <ChainHealthIndicator />
            </div>
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

