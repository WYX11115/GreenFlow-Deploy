import { spawnSync } from 'node:child_process';

const rpcUrl = process.env.ANVIL_RPC_URL ?? 'http://127.0.0.1:8545';
const apiUrl = `http://127.0.0.1:${process.env.API_PORT ?? '3001'}`;

async function rpc(method: string) {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: [] })
  });
  if (!response.ok) throw new Error(`RPC returned ${response.status}.`);
  const body = (await response.json()) as { error?: { message: string } };
  if (body.error) throw new Error(body.error.message);
}

try {
  await rpc('anvil_reset');
  const deployment = spawnSync('pnpm', ['contracts:deploy:phase4'], {
    stdio: 'inherit',
    env: process.env
  });
  if (deployment.status !== 0) {
    throw new Error(`Phase 4 deployment exited with code ${deployment.status ?? 'unknown'}.`);
  }
  const verification = spawnSync('pnpm', ['contracts:verify:phase4'], {
    stdio: 'inherit',
    env: process.env
  });
  if (verification.status !== 0) {
    throw new Error(`Phase 4 verification exited with code ${verification.status ?? 'unknown'}.`);
  }
  try {
    const actorResponse = await fetch(`${apiUrl}/api/demo/actor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actorId: 'issuer' })
    });
    if (!actorResponse.ok) {
      console.warn('Chain reset succeeded; API actor could not be reset because the API is unavailable.');
    }
  } catch {
    console.warn('Chain reset succeeded; API actor could not be reset because the API is unavailable.');
  }
  console.log('GreenFlow chain reset complete: six clean contracts redeployed and Issuer selected. Use the in-app reset to clear API metadata too.');
} catch (error) {
  console.error('Reset failed. Start the demo stack first.', error);
  process.exit(1);
}

