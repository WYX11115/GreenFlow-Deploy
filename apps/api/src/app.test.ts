import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { buildApp } from './app.js';
import type { ApiConfig } from './config.js';

const config: ApiConfig = {
  ANVIL_RPC_URL: 'http://127.0.0.1:8545',
  ANVIL_CHAIN_ID: 31_337,
  API_HOST: '127.0.0.1',
  API_PORT: 3001,
  WEB_ORIGIN: 'http://127.0.0.1:5173'
};

const openApps: Array<Awaited<ReturnType<typeof buildApp>>> = [];

afterEach(async () => {
  await Promise.all(openApps.splice(0).map((app) => app.close()));
});

describe('Phase 5 API', () => {
  it('starts with the issuer selected as the presenter actor', async () => {
    const app = await buildApp({
      config,
      chainProbe: async () => ({ connected: true, contractsReady: true, chainId: 31_337, latestBlock: '0' })
    });
    openApps.push(app);

    const response = await app.inject({ method: 'GET', url: '/api/demo/actors' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ activeActorId: 'issuer' });
  });

  it('reports chain and contract deployment readiness', async () => {
    const app = await buildApp({
      config,
      chainProbe: async () => ({
        connected: true,
        contractsReady: true,
        chainId: 31_337,
        latestBlock: '7'
      })
    });
    openApps.push(app);

    const response = await app.inject({ method: 'GET', url: '/api/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'ok',
      phase: 5,
      chain: { connected: true, contractsReady: true, chainId: 31_337, latestBlock: '7' },
      contracts: {
        mockUsd: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
        greenTreasury: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
        bondOffering: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
        bondServicingVault: '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707'
      }
    });
  });

  it('switches only to a registered fictional actor', async () => {
    const app = await buildApp({
      config,
      chainProbe: async () => ({
        connected: true,
        contractsReady: true,
        chainId: 31_337,
        latestBlock: '0'
      })
    });
    openApps.push(app);

    const switched = await app.inject({
      method: 'POST',
      url: '/api/demo/actor',
      payload: { actorId: 'alice' }
    });
    expect(switched.statusCode).toBe(200);
    expect(switched.json()).toMatchObject({
      activeActorId: 'alice',
      activeActor: { role: 'INVESTOR', eligibleInvestor: true }
    });

    const missing = await app.inject({
      method: 'POST',
      url: '/api/demo/actor',
      payload: { actorId: 'not-real' }
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toMatchObject({ code: 'ACTOR_NOT_FOUND' });
  });

  it('tags evidence to its selected milestone and rejects cross-milestone use', async () => {
    const app = await buildApp({
      config,
      chainProbe: async () => ({ connected: true, contractsReady: true, chainId: 31_337, latestBlock: '0' })
    });
    openApps.push(app);

    const sample = await app.inject({ method: 'POST', url: '/api/evidence/sample', payload: { milestoneId: 'M2' } });
    expect(sample.statusCode).toBe(200);
    expect(sample.json()).toMatchObject({ milestoneId: 'M2', fileName: 'M2-installation-completion-demo.pdf' });

    const mismatched = await app.inject({
      method: 'POST',
      url: '/api/disbursements',
      payload: { milestoneId: 'M1', evidenceId: sample.json().id }
    });
    expect(mismatched.statusCode).toBe(400);
    expect(mismatched.json()).toMatchObject({ code: 'EVIDENCE_MILESTONE_MISMATCH' });
  });

  it('serves the packaged M1 evidence PDF inline with the committed digest', async () => {
    const app = await buildApp({
      config,
      chainProbe: async () => ({ connected: true, contractsReady: true, chainId: 31_337, latestBlock: '0' })
    });
    openApps.push(app);

    const sample = await app.inject({ method: 'POST', url: '/api/evidence/sample', payload: { milestoneId: 'M1' } });
    const evidence = sample.json();
    const file = await app.inject({ method: 'GET', url: evidence.fileUrl });

    expect(file.statusCode).toBe(200);
    expect(file.headers['content-type']).toContain('application/pdf');
    expect(file.headers['content-disposition']).toContain('inline');
    expect(`0x${createHash('sha256').update(file.rawPayload).digest('hex')}`).toBe(evidence.sha256);
  });

  it('resets the selected actor through the browser-facing reset route', async () => {
    let resets = 0;
    const app = await buildApp({ config, chainProbe: async () => ({ connected: true, contractsReady: true, chainId: 31_337, latestBlock: '0' }), resetChain: async () => { resets += 1; } });
    openApps.push(app);
    await app.inject({ method: 'POST', url: '/api/demo/actor', payload: { actorId: 'alice' } });
    const denied = await app.inject({ method: 'POST', url: '/api/demo/reset' });
    expect(denied.statusCode).toBe(403);
    expect(denied.json()).toMatchObject({ code: 'ADMIN_ONLY' });
    await app.inject({ method: 'POST', url: '/api/demo/actor', payload: { actorId: 'admin' } });
    const response = await app.inject({ method: 'POST', url: '/api/demo/reset' });
    expect(response.statusCode).toBe(200);
    expect(resets).toBe(1);
    expect(response.json()).toMatchObject({ activeActorId: 'issuer' });
    expect((await app.inject({ method: 'GET', url: '/api/demo/actors' })).json()).toMatchObject({ activeActorId: 'issuer' });
  });

  it('restricts local time advancement to the selected admin actor', async () => {
    const app = await buildApp({ config, chainProbe: async () => ({ connected: true, contractsReady: true, chainId: 31_337, latestBlock: '0' }) });
    openApps.push(app);
    await app.inject({ method: 'POST', url: '/api/demo/actor', payload: { actorId: 'alice' } });
    const denied = await app.inject({ method: 'POST', url: '/api/demo/advance-to-maturity' });
    expect(denied.statusCode).toBe(403);
    expect(denied.json()).toMatchObject({ code: 'ADMIN_ONLY' });
  });
});

