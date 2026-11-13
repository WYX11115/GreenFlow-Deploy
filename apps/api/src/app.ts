import cors from '@fastify/cors';
import { DEMO_ACTORS, DEMO_TERMS, PHASE4_CONTRACTS, type ActorListResponse, type ActorSelectionResponse, type HealthResponse } from '@greenflow/shared';
import Fastify, { type FastifyReply } from 'fastify';
import { isHash } from 'viem';
import { z } from 'zod';
import type { ApiConfig } from './config.js';
import { ActorStore } from './services/actor-store.js';
import { ChainService, ChainTransactionError } from './services/chain-service.js';
import { createChainProbe, type ChainProbe } from './services/chain-client.js';
import { DemoStore } from './services/demo-store.js';
import { resetLocalChain } from './services/reset-demo.js';

interface AppDependencies { config: ApiConfig; chainProbe?: ChainProbe; resetChain?: () => Promise<void>; }

function sendError(reply: FastifyReply, error: unknown) {
  if (error instanceof ChainTransactionError) {
    return reply.code(409).send({ success: false, code: error.code, message: error.message, txHash: error.txHash, blockNumber: error.blockNumber });
  }
  return reply.code(500).send({ success: false, code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Unexpected request failure.' });
}

export async function buildApp({ config, chainProbe, resetChain }: AppDependencies) {
  const app = Fastify({ logger: false, bodyLimit: 7 * 1024 * 1024 });
  const actors = new ActorStore();
  const store = new DemoStore();
  const chain = new ChainService(config);
  const probe = chainProbe ?? createChainProbe(config);
  await app.register(cors, { origin: config.WEB_ORIGIN, methods: ['GET', 'POST'] });

  app.get('/api/health', async (_request, reply) => {
    const state = await probe();
    const healthy = state.connected && state.chainId === config.ANVIL_CHAIN_ID && state.contractsReady;
    const response: HealthResponse = {
      status: healthy ? 'ok' : 'degraded', service: 'greenflow-api', phase: 5,
      chain: { ...state, expectedChainId: config.ANVIL_CHAIN_ID, rpcUrl: config.ANVIL_RPC_URL }, contracts: PHASE4_CONTRACTS,
      message: healthy ? 'Final MVP issuance, green treasury, and separate servicing lifecycle are connected to the local chain.' : 'Local chain unavailable, wrong chain ID, or contracts missing. Start/reset the demo stack.',
      timestamp: new Date().toISOString()
    };
    return reply.code(healthy ? 200 : 503).send(response);
  });

  app.get('/api/demo/actors', async (): Promise<ActorListResponse> => ({ actors: [...DEMO_ACTORS], activeActorId: actors.active().id }));
  app.post('/api/demo/actor', async (request, reply) => {
    const parsed = z.object({ actorId: z.string().min(1) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, code: 'INVALID_ACTOR_REQUEST', message: 'actorId is required.' });
    const selected = actors.select(parsed.data.actorId);
    if (!selected) return reply.code(404).send({ success: false, code: 'ACTOR_NOT_FOUND', message: 'That fictional demo actor is not registered.' });
    const response: ActorSelectionResponse = { actors: [...actors.list()], activeActorId: selected.id, activeActor: selected };
    return response;
  });

  app.get('/api/dashboard', async (_request, reply) => { try { return await chain.dashboard(actors.active(), store); } catch (error) { return sendError(reply, error); } });
  app.post('/api/offering/open', async (_request, reply) => { try { return await chain.openOffering(actors.active()); } catch (error) { return sendError(reply, error); } });
  app.post('/api/subscriptions', async (request, reply) => {
    const parsed = z.object({ units: z.number().int().positive().max(10) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, code: 'INVALID_UNITS', message: 'Choose between 1 and 10 whole bond units.' });
    try { return await chain.subscribe(actors.active(), parsed.data.units); }
    catch (error) {
      if (error instanceof ChainTransactionError && error.txHash && error.blockNumber) store.addAttempt({ kind: 'INELIGIBLE_INVESTOR', code: error.code, message: error.message, actorAddress: actors.active().address, txHash: error.txHash, blockNumber: error.blockNumber });
      return sendError(reply, error);
    }
  });
  app.post('/api/projects/propose', async (_request, reply) => { try { return await chain.proposeProject(actors.active()); } catch (error) { return sendError(reply, error); } });
  app.post('/api/projects/approve', async (_request, reply) => { try { return await chain.approveProject(actors.active()); } catch (error) { return sendError(reply, error); } });

  app.post('/api/evidence/sample', async (request, reply) => {
    if (actors.active().role !== 'ISSUER') return reply.code(403).send({ success: false, code: 'ISSUER_ONLY', message: 'Only the issuer may add disbursement evidence.' });
    const parsed = z.object({ milestoneId: z.enum(['M1', 'M2']).default('M1') }).safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ success: false, code: 'INVALID_MILESTONE', message: 'Choose M1 or M2 for this evidence.' });
    return store.addSample(parsed.data.milestoneId);
  });
  app.post('/api/evidence', async (request, reply) => {
    if (actors.active().role !== 'ISSUER') return reply.code(403).send({ success: false, code: 'ISSUER_ONLY', message: 'Only the issuer may add disbursement evidence.' });
    const parsed = z.object({ milestoneId: z.enum(['M1', 'M2']).default('M1'), fileName: z.string().min(1), mimeType: z.enum(['application/pdf', 'image/png', 'image/jpeg']), base64: z.string().min(1) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, code: 'INVALID_EVIDENCE', message: 'Provide one PDF, PNG, or JPEG evidence file up to 5 MB.' });
    try { return store.addEvidence(parsed.data.milestoneId, parsed.data.fileName, parsed.data.mimeType, Buffer.from(parsed.data.base64, 'base64')); }
    catch (error) { return reply.code(400).send({ success: false, code: error instanceof Error ? error.message : 'INVALID_EVIDENCE', message: 'Evidence must be a non-empty PDF, PNG, or JPEG no larger than 5 MB.' }); }
  });
  app.get('/api/evidence/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params); const item = store.getEvidence(id);
    return item ?? reply.code(404).send({ success: false, code: 'EVIDENCE_NOT_FOUND', message: 'Evidence was not found.' });
  });
  app.get('/api/evidence/:id/file', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params); const value = store.getEvidenceBytes(id);
    if (!value) return reply.code(404).send({ success: false, code: 'EVIDENCE_NOT_FOUND', message: 'Evidence was not found.' });
    return reply.type(value.item.mimeType).header('Content-Disposition', `inline; filename="${value.item.fileName.replaceAll('"', '')}"`).send(value.bytes);
  });

  app.post('/api/disbursements', async (request, reply) => {
    const parsed = z.object({ evidenceId: z.string().min(1), milestoneId: z.enum(['M1', 'M2']).default('M1') }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, code: 'INVALID_DISBURSEMENT', message: 'Choose a milestone and its uploaded evidence.' });
    const evidence = store.getEvidence(parsed.data.evidenceId);
    if (!evidence) return reply.code(400).send({ success: false, code: 'EVIDENCE_REQUIRED', message: 'Select uploaded evidence before requesting payment.' });
    if (evidence.milestoneId !== parsed.data.milestoneId) return reply.code(400).send({ success: false, code: 'EVIDENCE_MILESTONE_MISMATCH', message: 'The selected evidence belongs to a different milestone.' });
    try { return await chain.requestDisbursement(actors.active(), evidence.sha256, parsed.data.milestoneId); } catch (error) { return sendError(reply, error); }
  });
  app.post('/api/disbursements/attempt-invalid', async (request, reply) => {
    const parsed = z.object({ kind: z.enum(['POLICY_NOT_APPROVED', 'UNKNOWN_VENDOR', 'OVER_LIMIT']), evidenceId: z.string().optional(), milestoneId: z.enum(['M1', 'M2']).default('M1') }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, code: 'INVALID_ATTEMPT', message: 'Choose a supported blocked-payment scenario.' });
    const evidence = parsed.data.evidenceId ? store.getEvidence(parsed.data.evidenceId) : store.evidence()[0];
    const hash = evidence?.sha256 ?? (`0x${'11'.repeat(32)}` as `0x${string}`);
    const milestone = DEMO_TERMS.milestones.find(({ id }) => id === parsed.data.milestoneId)!;
    const options = parsed.data.kind === 'UNKNOWN_VENDOR'
      ? { vendor: DEMO_ACTORS.find(({ id }) => id === 'vendor-b')!.address, requestLabel: 'REQUEST-INVALID-VENDOR', failureCode: 'VENDOR_NOT_APPROVED', failureMessage: 'The treasury blocked an unapproved vendor; balances are unchanged.' }
      : parsed.data.kind === 'OVER_LIMIT'
        ? { amount: BigInt(milestone.maxAmountSubunits) + 1_000_000n, requestLabel: `REQUEST-${parsed.data.milestoneId}-OVER-LIMIT`, failureCode: 'MILESTONE_LIMIT_EXCEEDED', failureMessage: `The treasury blocked an amount above the ${parsed.data.milestoneId} limit; balances are unchanged.` }
        : { requestLabel: 'REQUEST-BEFORE-POLICY', failureCode: 'POLICY_NOT_APPROVED', failureMessage: 'The treasury blocked payment before verifier policy approval; balances are unchanged.' };
    try { return await chain.requestDisbursement(actors.active(), hash, parsed.data.milestoneId, options); }
    catch (error) {
      if (error instanceof ChainTransactionError && error.txHash && error.blockNumber) store.addAttempt({ kind: parsed.data.kind, code: error.code, message: error.message, actorAddress: actors.active().address, txHash: error.txHash, blockNumber: error.blockNumber });
      return sendError(reply, error);
    }
  });
  app.post('/api/disbursements/:id/approve', async (request, reply) => {
    const parsed = z.object({ id: z.enum(['REQUEST-M1', 'REQUEST-M2']) }).safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ success: false, code: 'INVALID_REQUEST', message: 'Choose a recognized milestone request.' });
    try { return await chain.approveAndRelease(actors.active(), parsed.data.id === 'REQUEST-M1' ? 'M1' : 'M2'); } catch (error) { return sendError(reply, error); }
  });
  app.post('/api/disbursements/:id/reject', async (request, reply) => {
    const parsed = z.object({ id: z.enum(['REQUEST-M1', 'REQUEST-M2']) }).safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ success: false, code: 'INVALID_REQUEST', message: 'Choose a recognized milestone request.' });
    try { return await chain.rejectRequest(actors.active(), parsed.data.id === 'REQUEST-M1' ? 'M1' : 'M2'); } catch (error) { return sendError(reply, error); }
  });
  app.post('/api/admin/treasury/:action', async (request, reply) => {
    const { action } = z.object({ action: z.enum(['pause', 'unpause']) }).parse(request.params);
    try { return await chain.setPaused(actors.active(), action === 'pause'); } catch (error) { return sendError(reply, error); }
  });
  app.post('/api/servicing/fund', async (_request, reply) => {
    try { return await chain.fundServicing(actors.active()); } catch (error) { return sendError(reply, error); }
  });
  app.post('/api/demo/advance-to-maturity', async (_request, reply) => {
    if (actors.active().role !== 'ADMIN') return reply.code(403).send({ success: false, code: 'ADMIN_ONLY', message: 'Only the platform admin may advance simulated local-chain time.' });
    try { return await chain.advanceToMaturity(actors.active()); } catch (error) { return sendError(reply, error); }
  });
  app.post('/api/servicing/claim', async (_request, reply) => {
    try { return await chain.claimMaturityPayment(actors.active()); } catch (error) { return sendError(reply, error); }
  });
  app.get('/api/events', async () => chain.events());
  app.get('/api/transactions/:hash', async (request, reply) => {
    const { hash } = z.object({ hash: z.string() }).parse(request.params);
    if (!isHash(hash)) return reply.code(400).send({ success: false, code: 'INVALID_HASH', message: 'A 32-byte transaction hash is required.' });
    const detail = await chain.transaction(hash); return detail ?? reply.code(404).send({ success: false, code: 'TRANSACTION_NOT_FOUND', message: 'Transaction not found on the local chain.' });
  });
  app.post('/api/demo/reset', async (_request, reply) => {
    if (actors.active().role !== 'ADMIN') return reply.code(403).send({ success: false, code: 'ADMIN_ONLY', message: 'Only the platform admin may reset the local demo.' });
    try { await (resetChain ? resetChain() : resetLocalChain(config)); store.reset(); actors.reset(); return { success: true, message: 'Clean GreenFlow demo state restored.', activeActorId: 'issuer' }; }
    catch (error) { return sendError(reply, error); }
  });
  app.get('/api', async () => ({ name: 'GreenFlow API', phase: 5, documentation: '/api/health' }));
  return app;
}
