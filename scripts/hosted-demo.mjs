import { spawn } from 'node:child_process';

const child = spawn('pnpm', ['demo:start'], { stdio: 'inherit', env: { ...process.env, GREENFLOW_HOSTED: '1', VITE_API_URL: '' } });
let publicServer;
let ended = false;

function shutdown(code = 0) {
  if (ended) return;
  ended = true;
  if (publicServer && !publicServer.killed) publicServer.kill('SIGTERM');
  if (!child.killed) child.kill('SIGTERM');
  setTimeout(() => process.exit(code), 150).unref();
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
child.on('exit', (code) => shutdown(code ?? 1));
child.on('error', error => { console.error(error); shutdown(1); });

async function healthy() {
  try {
    const response = await fetch('http://127.0.0.1:3001/api/health');
    return response.ok;
  } catch { return false; }
}
for (let i = 0; i < 240 && !ended; i++) {
  if (await healthy()) {
    publicServer = spawn('node', ['scripts/serve-public.mjs'], { stdio: 'inherit', env: process.env });
    publicServer.on('exit', (code) => shutdown(code ?? 1));
    publicServer.on('error', error => { console.error(error); shutdown(1); });
    console.log('GreenFlow is ready for public demo access.');
    break;
  }
  await new Promise(resolve => setTimeout(resolve, 1000));
}
if (!publicServer && !ended) { console.error('GreenFlow API did not become healthy.'); shutdown(1); }
