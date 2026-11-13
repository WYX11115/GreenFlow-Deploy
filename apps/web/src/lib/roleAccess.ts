import type { DemoRole } from '@greenflow/shared';

export const ROLE_RESTRICTED_ROUTES = {
  '/issuer/offerings': ['ISSUER'],
  '/issuer/treasury': ['ISSUER'],
  '/verifier': ['VERIFIER'],
  '/investor': ['INVESTOR'],
  '/admin': ['ADMIN']
} as const satisfies Record<string, readonly DemoRole[]>;

export type RestrictedRoute = keyof typeof ROLE_RESTRICTED_ROUTES;

export function canAccessRoute(path: string, role: DemoRole | undefined) {
  const allowedRoles = ROLE_RESTRICTED_ROUTES[path as RestrictedRoute];
  return !allowedRoles || (role !== undefined && (allowedRoles as readonly DemoRole[]).includes(role));
}

export const ROLE_WORKSPACES: Record<DemoRole, { label: string; to: string }> = {
  ADMIN: { label: 'Administration', to: '/admin' },
  ISSUER: { label: 'Offering', to: '/issuer/offerings' },
  VERIFIER: { label: 'Verifier desk', to: '/verifier' },
  INVESTOR: { label: 'Investor view', to: '/investor' },
  VENDOR: { label: 'Use of proceeds', to: '/impact' }
};

export const ROLE_LABELS: Record<DemoRole, string> = {
  ADMIN: 'Platform Admin',
  ISSUER: 'Issuer',
  VERIFIER: 'Verifier',
  INVESTOR: 'Investor',
  VENDOR: 'Vendor'
};
