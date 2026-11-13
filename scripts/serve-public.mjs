import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { timingSafeEqual } from 'node:crypto';

// Educational demo: one public origin. Anvil and the Fastify API remain on localhost.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../apps/web/dist');
const listenPort = Number(process.env.PORT ?? '8080');
const password = process.env.DEMO_ACCESS_PASSWORD || '';
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon', '.webp': 'image/webp', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };

function authorized(req) {
  if (!password) return true;
  const h = req.headers.authorization || '';
  if (!h.startsWith('Basic ')) return false;
  try {
    const raw = Buffer.from(h.slice(6), 'base64').toString('utf8');
    const entered = raw.slice(raw.indexOf(':') + 1);
    const a = Buffer.from(entered);
    const b = Buffer.from(password);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch { return false; }
}

const server = http.createServer(async (req, res) => {
  if (!authorized(req)) { res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="GreenFlow demo"', 'Content-Type': 'text/plain' }); res.end('Enter the GreenFlow demo password.'); return; }
  let url;
  try { url = new URL(req.url || '/', 'http://localhost'); }
  catch { res.writeHead(400); res.end('Bad URL'); return; }
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
    const upstream = http.request({ hostname: '127.0.0.1', port: 3001, path: req.url, method: req.method, headers: { ...req.headers, host: '127.0.0.1:3001' }, timeout: 60_000 }, response => {
      res.writeHead(response.statusCode || 502, response.headers);
      response.pipe(res);
    });
    upstream.on('error', () => { if (!res.headersSent) { res.writeHead(502); res.end('Demo API is starting or unavailable.'); } else res.destroy(); });
    req.pipe(upstream);
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end('Method not allowed'); return; }
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { res.writeHead(400); res.end('Bad path'); return; }
  const candidate = path.resolve(root, '.' + pathname);
  if (candidate !== root && !candidate.startsWith(root + path.sep)) { res.writeHead(403); res.end('Forbidden'); return; }
  let served = candidate;
  try { if (!(await stat(served)).isFile()) served = path.join(root, 'index.html'); }
  catch { served = path.join(root, 'index.html'); }
  try {
    const info = await stat(served);
    const headers = { 'Content-Type': mime[path.extname(served)] || 'application/octet-stream', 'Content-Length': info.size, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' };
    res.writeHead(200, headers);
    if (req.method === 'HEAD') res.end(); else createReadStream(served).pipe(res);
  } catch { res.writeHead(404); res.end('Build files not found'); }
});
server.listen(listenPort, '0.0.0.0', () => console.log(`GreenFlow public demo listening on 0.0.0.0:${listenPort}`));
process.once('SIGTERM', () => server.close());
