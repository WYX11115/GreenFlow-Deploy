import { describe, expect, it } from 'vitest';
import { canAccessRoute, ROLE_WORKSPACES } from './roleAccess';

describe('role-specific route access', () => {
  it('keeps shared presentation routes available to every role', () => {
    for (const role of ['ADMIN', 'ISSUER', 'VERIFIER', 'INVESTOR', 'VENDOR'] as const) {
      expect(canAccessRoute('/demo', role)).toBe(true);
      expect(canAccessRoute('/impact', role)).toBe(true);
      expect(canAccessRoute('/transactions/0x123', role)).toBe(true);
    }
  });

  it('allows only the owning role into each restricted workspace', () => {
    expect(canAccessRoute('/issuer/offerings', 'ISSUER')).toBe(true);
    expect(canAccessRoute('/issuer/treasury', 'ISSUER')).toBe(true);
    expect(canAccessRoute('/verifier', 'VERIFIER')).toBe(true);
    expect(canAccessRoute('/investor', 'INVESTOR')).toBe(true);
    expect(canAccessRoute('/admin', 'ADMIN')).toBe(true);

    expect(canAccessRoute('/admin', 'ISSUER')).toBe(false);
    expect(canAccessRoute('/issuer/treasury', 'VERIFIER')).toBe(false);
    expect(canAccessRoute('/verifier', 'INVESTOR')).toBe(false);
    expect(canAccessRoute('/investor', 'VENDOR')).toBe(false);
  });

  it('defines a default workspace for every presenter role', () => {
    expect(ROLE_WORKSPACES).toEqual({
      ADMIN: { label: 'Administration', to: '/admin' },
      ISSUER: { label: 'Offering', to: '/issuer/offerings' },
      VERIFIER: { label: 'Verifier desk', to: '/verifier' },
      INVESTOR: { label: 'Investor view', to: '/investor' },
      VENDOR: { label: 'Use of proceeds', to: '/impact' }
    });
  });
});
