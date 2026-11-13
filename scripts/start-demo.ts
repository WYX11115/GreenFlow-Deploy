import { spawn, type ChildProcess } from 'node:child_process';

const environment = {
  ...process.env,
  ANVIL_RPC_URL: process.env.ANVIL_RPC_URL ?? 'http://127.0.0.1:8545',
  ANVIL_CHAIN_ID: process.env.ANVIL_CHAIN_ID ?? '31337',
  API_HOST: '127.0.0.1',
  API_PORT: process.env.API_PORT ?? '3001',
  WEB_ORIGIN: process.env.WEB_ORIGIN ?? 'http://127.0.0.1:5173',
  VITE_API_URL: process.env.VITE_API_URL ?? 'http://127.0.0.1:3001'
};

const apiUrl = `http://127.0.0.1:${environment.API_PORT}`;
const webUrl = 'http://127.0.0.1:5173';
const children: ChildProcess[] = [];
const hosted = process.env.GREENFLOW_HOSTED === '1';

function run(command: string, args: string[], stdio: 'inherit' | 'ignore' = 'inherit') {
  const child = spawn(command, args, { env: environment, stdio });
  children.push(child);
  return child;
}

function runToCompletion(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { env: environment, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code ?? 'unknown'}.`));
    });
  });
}

async function waitFor(label: string, probe: () => Promise<boolean>, timeoutMs = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      if (await probe()) return;
    } catch {
      // The process is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`${label} did not become ready within ${timeoutMs / 1000} seconds.`);
}

async function jsonRpc(method: string) {
  const response = await fetch(environment.ANVIL_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: [] })
  });
  if (!response.ok) return null;
  return (await response.json()) as { result?: unknown };
}

function stop(exitCode = 0) {
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(exitCode), 100).unref();
}

process.once('SIGINT', () => stop(0));
process.once('SIGTERM', () => stop(0));

try {
  console.log('\nGreenFlow final MVP · preparing shared types');
  await runToCompletion('pnpm', ['--filter', '@greenflow/shared', 'build']);

  console.log('\nGreenFlow final MVP · starting Anvil');
  const chain = run('pnpm', ['chain:start'], 'ignore');
  chain.once('exit', (code) => {
    if (code && code !== 0) stop(code);
  });
  await waitFor('Anvil', async () => {
    const result = await jsonRpc('eth_chainId');
    return result?.result === '0x7a69';
  });

  console.log('\nGreenFlow final MVP · deploying and verifying local contracts');
  await runToCompletion('pnpm', ['contracts:deploy:phase4']);
  await runToCompletion('pnpm', ['contracts:verify:phase4']);

  console.log('\nGreenFlow final MVP · starting API and web');
  const api = run('pnpm', ['--filter', '@greenflow/api', 'dev']);
  const web = hosted ? null : run('pnpm', ['--filter', '@greenflow/web', 'dev']);
  for (const child of [api, web].filter((child): child is ChildProcess => child !== null)) {
    child.once('exit', (code) => {
      if (code && code !== 0) stop(code);
    });
  }

  await waitFor('API', async () => {
    const response = await fetch(`${apiUrl}/api/health`);
    if (!response.ok) return false;
    const health = (await response.json()) as { chain?: { chainId?: number } };
    return health.chain?.chainId === 31_337;
  });
  if (!hosted) await waitFor('web app', async () => (await fetch(webUrl)).ok);

  console.log(`
╭────────────────────────────────────────────────────────────╮
│  GreenFlow final MVP is ready                              │
│                                                            │
│  Web   ${webUrl.padEnd(51)}│
│  API   ${apiUrl.padEnd(51)}│
│  RPC   ${environment.ANVIL_RPC_URL.padEnd(51)}│
│                                                            │
│  Chain 31337 · green treasury + servicing lifecycle ready  │
│  Stop all processes with Ctrl+C                            │
╰────────────────────────────────────────────────────────────╯
`);
} catch (error) {
  console.error('\nUnable to start GreenFlow:', error);
  stop(1);
}

