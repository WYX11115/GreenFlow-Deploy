import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ApiConfig } from '../config.js';

function run(command: string, args: string[]) {
  const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url));
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { cwd: repositoryRoot, stdio: 'ignore' });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`Reset command exited with ${code ?? 'unknown'}.`)));
  });
}

export async function resetLocalChain(config: ApiConfig) {
  const response = await fetch(config.ANVIL_RPC_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'anvil_reset', params: [] })
  });
  const body = await response.json() as { error?: { message?: string } };
  if (!response.ok || body.error) throw new Error(body.error?.message ?? 'Anvil reset failed.');
  const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url));
  const pnpmCli = join(repositoryRoot, 'node_modules', '.bin', 'pnpm');
  await run(pnpmCli, ['contracts:deploy:phase4']);
  await run(pnpmCli, ['contracts:verify:phase4']);
}
