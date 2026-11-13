import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const webUrl = process.env.WEB_URL ?? 'http://127.0.0.1:5173';
const chromePath = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const debugPort = Number(process.env.CHROME_DEBUG_PORT ?? '9223');
const runCount = Number(process.env.BROWSER_RUNS ?? '2');
const screenshotDirectory = resolve('docs/screenshots');
const actorNames: Record<string, string> = {
  admin: 'Platform Admin', issuer: 'GreenSun Issuer', verifier: 'Independent Verifier',
  alice: 'Alice', bob: 'Bob', charlie: 'Charlie'
};

type Json = Record<string, unknown>;
type Pending = { resolve: (value: Json) => void; reject: (reason: Error) => void };

class CdpClient {
  #id = 0;
  #pending = new Map<number, Pending>();
  readonly errors: string[] = [];

  constructor(private socket: WebSocket) {
    socket.onmessage = (event) => {
      const message = JSON.parse(String(event.data)) as { id?: number; method?: string; params?: Json; result?: Json; error?: { message: string } };
      if (message.id) {
        const pending = this.#pending.get(message.id);
        if (!pending) return;
        this.#pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result ?? {});
        return;
      }
      if (message.method === 'Runtime.exceptionThrown') this.errors.push(JSON.stringify(message.params));
      if (message.method === 'Log.entryAdded') {
        const entry = message.params?.entry as { level?: string; text?: string } | undefined;
        if (entry?.level === 'error' && !entry.text?.includes('status of 409')) this.errors.push(entry.text ?? 'Browser log error');
      }
      if (message.method === 'Runtime.consoleAPICalled') {
        const type = message.params?.type;
        if (type === 'error' || type === 'assert') this.errors.push(JSON.stringify(message.params));
      }
    };
  }

  send(method: string, params: Json = {}): Promise<Json> {
    const id = ++this.#id;
    return new Promise((resolvePromise, reject) => {
      this.#pending.set(id, { resolve: resolvePromise, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate<T>(expression: string): Promise<T> {
    const response = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (response.exceptionDetails) throw new Error(`Browser expression failed: ${JSON.stringify(response.exceptionDetails)}`);
    const result = response.result as { value?: T; description?: string } | undefined;
    return result?.value as T;
  }
}

const sleep = (milliseconds: number) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

async function waitFor<T>(read: () => Promise<T>, description: string, timeout = 20_000): Promise<T> {
  const deadline = Date.now() + timeout;
  let value: T;
  do {
    value = await read();
    if (value) return value;
    await sleep(100);
  } while (Date.now() < deadline);
  throw new Error(`Timed out waiting for ${description}.`);
}

async function connectBrowser(processHandle: ChildProcess) {
  await waitFor(async () => {
    if (processHandle.exitCode !== null) throw new Error(`Chrome exited with code ${processHandle.exitCode}.`);
    try { return (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok; } catch { return false; }
  }, 'Chrome debugging endpoint');
  const tabs = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json() as Array<{ type: string; webSocketDebuggerUrl?: string }>;
  const debuggerUrl = tabs.find(({ type, webSocketDebuggerUrl }) => type === 'page' && webSocketDebuggerUrl)?.webSocketDebuggerUrl;
  if (!debuggerUrl) throw new Error('Chrome did not expose a page debugging target.');
  const socket = new WebSocket(debuggerUrl);
  await new Promise<void>((resolvePromise, reject) => { socket.onopen = () => resolvePromise(); socket.onerror = () => reject(new Error('Unable to connect to Chrome.')); });
  return { client: new CdpClient(socket), socket };
}

async function navigate(client: CdpClient, path: string, expectedText: string) {
  await client.send('Page.navigate', { url: `${webUrl}${path}` });
  await waitFor(() => client.evaluate<boolean>(`document.readyState === 'complete' && document.body.innerText.includes(${JSON.stringify(expectedText)})`), `${path} to render`);
}

async function selectActor(client: CdpClient, actorId: string) {
  const name = actorNames[actorId];
  await waitFor(() => client.evaluate<boolean>(`Boolean(document.querySelector('[data-testid="actor-select"]:not(:disabled)'))`), 'actor selector');
  await client.evaluate(`(() => { const select = document.querySelector('[data-testid="actor-select"]'); if (!(select instanceof HTMLSelectElement)) throw new Error('Actor selector missing'); select.value = ${JSON.stringify(actorId)}; select.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  await waitFor(() => client.evaluate<boolean>(`(() => { const select = document.querySelector('[data-testid="actor-select"]'); return select instanceof HTMLSelectElement && !select.disabled && select.value === ${JSON.stringify(actorId)} && document.body.innerText.includes(${JSON.stringify(name)}); })()`), `${name} actor selection`);
}

async function action(client: CdpClient, label: string, expectedMessage: string) {
  const labelJson = JSON.stringify(label);
  await waitFor(() => client.evaluate<boolean>(`(() => { const button = [...document.querySelectorAll('button[data-action]')].find((item) => item.getAttribute('data-action') === ${labelJson}); return button instanceof HTMLButtonElement && !button.disabled; })()`), `enabled action ${label}`);
  await client.evaluate(`(() => { const matches = [...document.querySelectorAll('button[data-action]')].filter((item) => item.getAttribute('data-action') === ${labelJson}); if (matches.length !== 1 || !(matches[0] instanceof HTMLButtonElement)) throw new Error('Expected one ${label} button'); matches[0].click(); return true; })()`);
  try {
    return await waitFor(() => client.evaluate<string>(`(() => { const text = document.body.innerText; return text.includes(${JSON.stringify(expectedMessage)}) ? ${JSON.stringify(expectedMessage)} : ''; })()`), `${label} result`, 30_000);
  } catch (error) {
    const diagnostic = await client.evaluate<string>('document.body.innerText.slice(-2000)');
    throw new Error(`${error instanceof Error ? error.message : String(error)}\nVisible browser text:\n${diagnostic}`);
  }
}

async function capture(client: CdpClient, fileName: string) {
  const result = await client.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false }) as { data?: string };
  assert(result.data, `No screenshot data returned for ${fileName}.`);
  await writeFile(join(screenshotDirectory, fileName), Buffer.from(result.data, 'base64'));
}

async function scrollActionIntoView(client: CdpClient, label: string) {
  await client.evaluate(`(() => { const button = [...document.querySelectorAll('button[data-action]')].find((item) => item.getAttribute('data-action') === ${JSON.stringify(label)}); button?.parentElement?.scrollIntoView({ block: 'center' }); return Boolean(button); })()`);
  await sleep(350);
}

async function expectPageText(client: CdpClient, ...values: string[]) {
  try {
    await waitFor(() => client.evaluate<boolean>(`(() => { const text = document.body.innerText; return ${JSON.stringify(values)}.every((value) => text.includes(value)); })()`), `page text: ${values.join(', ')}`);
  } catch (error) {
    const diagnostic = await client.evaluate<string>('document.body.innerText.slice(0, 3000)');
    throw new Error(`${error instanceof Error ? error.message : String(error)}\nVisible browser text:\n${diagnostic}`);
  }
}

async function runDemo(client: CdpClient, runNumber: number) {
  const captureRun = runNumber === runCount;
  console.log(`Browser rehearsal ${runNumber}/${runCount} · clean reset and issuance`);
  await navigate(client, '/demo', 'Green capital, with guardrails before money moves.');
  await selectActor(client, 'admin');
  await navigate(client, '/admin', 'Administration');
  await action(client, 'Reset six-contract demo', 'Open the offering');
  await navigate(client, '/demo', 'Open the offering');
  if (captureRun) await capture(client, 'phase5-01-main-dashboard.png');

  await selectActor(client, 'issuer');
  await navigate(client, '/issuer/offerings', 'Bond offering');
  await action(client, 'Open offering on chain', 'confirmed on local chain 31337');
  await selectActor(client, 'alice');
  await navigate(client, '/investor', 'Investor holdings & repayment');
  await action(client, 'Subscribe', 'confirmed on local chain 31337');
  await expectPageText(client, 'My bond units', '6', '$400');
  if (captureRun) await capture(client, 'phase5-02-investor-subscription.png');
  await selectActor(client, 'charlie');
  await action(client, 'Subscribe', 'eligibility token rejected');
  await selectActor(client, 'bob');
  await action(client, 'Subscribe', 'confirmed on local chain 31337');

  console.log(`Browser rehearsal ${runNumber}/${runCount} · policy, rejection, evidence, and atomic release`);
  await selectActor(client, 'issuer');
  await navigate(client, '/issuer/treasury', 'Green proceeds treasury');
  await action(client, 'Propose policy on chain', 'confirmed on local chain 31337');
  await action(client, 'Try before approval', 'blocked payment before verifier policy approval');
  await selectActor(client, 'verifier');
  await navigate(client, '/verifier', 'Verifier desk');
  await action(client, 'Approve project policy', 'confirmed on local chain 31337');
  await expectPageText(client, 'ACTIVE', '$800');
  if (captureRun) await capture(client, 'phase5-03-project-approved.png');
  await selectActor(client, 'issuer');
  await navigate(client, '/issuer/treasury', 'Green proceeds treasury');
  await action(client, 'Use fictional sample', 'Action completed.');
  await expectPageText(client, 'M1-equipment-delivery-demo.pdf', 'SHA-256');
  await action(client, 'Try UnknownVendor', 'blocked an unapproved vendor');
  if (captureRun) {
    await scrollActionIntoView(client, 'Try UnknownVendor');
    await capture(client, 'phase5-04-rejected-payment.png');
  }
  await action(client, 'Try M1 over-limit', 'blocked an amount above the M1 limit');
  await action(client, 'Request 300 MockUSD for M1', 'confirmed on local chain 31337');
  await selectActor(client, 'verifier');
  await navigate(client, '/verifier', 'M1 evidence & release');
  await action(client, 'Approve & release atomically', 'confirmed on local chain 31337');
  await expectPageText(client, 'PAID', '$300');
  if (captureRun) await capture(client, 'phase5-05-vendor-disbursement.png');
  await selectActor(client, 'alice');
  await navigate(client, '/impact', 'Use of proceeds & servicing');
  await expectPageText(client, 'Treasury balance', '$700', 'Paid to vendor', '$300');
  if (captureRun) await capture(client, 'phase5-06-investor-transparency.png');

  console.log(`Browser rehearsal ${runNumber}/${runCount} · separate servicing and redemption`);
  await selectActor(client, 'issuer');
  await navigate(client, '/issuer/offerings', 'Issuer-funded servicing vault');
  await action(client, 'Fund servicing vault', 'confirmed on local chain 31337');
  await selectActor(client, 'admin');
  await navigate(client, '/admin', 'Local maturity control');
  await action(client, 'Advance to maturity & finalize', 'confirmed on local chain 31337');
  await selectActor(client, 'alice');
  await navigate(client, '/investor', 'Combined maturity claim');
  await action(client, 'Claim maturity payment', 'confirmed on local chain 31337');
  await expectPageText(client, 'CLAIMED', '$1,030', '$630');
  await selectActor(client, 'bob');
  await action(client, 'Claim maturity payment', 'confirmed on local chain 31337');
  await expectPageText(client, 'CLAIMED', '$1,020', '$420');
  await navigate(client, '/impact', 'Debt-servicing ledger');
  await expectPageText(client, 'Treasury balance', '$700', 'Issuer funded', '$1,050', 'Vault balance', '$0', 'Principal paid', '$1,000', 'Coupon paid', '$50', '10 / 10 units retired');
  if (captureRun) {
    await capture(client, 'phase5-07-bond-servicing.png');
    await client.send('Emulation.setDeviceMetricsOverride', { width: 500, height: 1000, deviceScaleFactor: 1, mobile: true });
    await waitFor(() => client.evaluate<boolean>('window.innerWidth === 500'), 'mobile viewport');
    await sleep(500);
    await capture(client, 'phase5-08-mobile-servicing.png');
    await client.send('Emulation.clearDeviceMetricsOverride');
  }

  await selectActor(client, 'admin');
  await navigate(client, '/admin', 'Administration');
  await action(client, 'Reset six-contract demo', 'Open the offering');
  await navigate(client, '/demo', 'Open the offering');
  await expectPageText(client, '10 / 10 units issued', 'NEXT PRESENTER MOVE', 'Open the offering');
  console.log(`Browser rehearsal ${runNumber}/${runCount} passed and reset cleanly.`);
}

await mkdir(screenshotDirectory, { recursive: true });
const profileDirectory = await mkdtemp(join(tmpdir(), 'greenflow-chrome-'));
const browserProcess = spawn(chromePath, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
  '--disable-background-networking', '--disable-extensions', '--disable-sync', '--remote-allow-origins=*',
  `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profileDirectory}`, '--window-size=1440,1000',
  'about:blank'
], { stdio: 'ignore' });

let socket: WebSocket | undefined;
try {
  const connection = await connectBrowser(browserProcess);
  socket = connection.socket;
  const client = connection.client;
  await Promise.all([client.send('Page.enable'), client.send('Runtime.enable'), client.send('Log.enable')]);
  for (let run = 1; run <= runCount; run += 1) await runDemo(client, run);
  const unnamedInteractive = await client.evaluate<string[]>(`[...document.querySelectorAll('button, a, select')].filter((element) => { const name = element.getAttribute('aria-label') || element.textContent?.trim(); return !name; }).map((element) => element.outerHTML.slice(0, 160))`);
  assert(unnamedInteractive.length === 0, `Interactive controls without accessible names: ${unnamedInteractive.join(', ')}`);
  assert(client.errors.length === 0, `Browser console errors: ${client.errors.join('\n')}`);
  console.log(`Phase 5 browser gate passed: ${runCount} full UI rehearsals, clean resets, 8 screenshots, responsive check, named controls, and 0 console errors.`);
} finally {
  socket?.close();
  if (browserProcess.exitCode === null) {
    browserProcess.kill('SIGTERM');
    await Promise.race([
      new Promise<void>((resolvePromise) => browserProcess.once('exit', () => resolvePromise())),
      sleep(2_000)
    ]);
  }
  if (browserProcess.exitCode === null) browserProcess.kill('SIGKILL');
  await rm(profileDirectory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
