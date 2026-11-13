# GreenFlow — hosted teaching demo

**Not production software.** Uses a private Anvil local blockchain inside the hosting container, mock funds, fictional evidence, and demo accounts. Any visitor who can use the shared demo can switch roles, change its state, or reset it. There is no real KYC, custody or asset transfer.

## Easiest persistent demo URL: Railway + GitHub

1. Upload this folder to a GitHub repository. The Dockerfile must be in the repository root.
2. Open https://railway.com/ and create a project using **Deploy from GitHub repo**. Select this repository. Railway detects `Dockerfile`.
3. Let Railway build and start the service. Build installs pnpm and workspace deps; startup launches internal Anvil, deploys six contracts, starts the API, then serves the built UI on Railway's `PORT`.
4. In the Railway service, go to **Settings → Networking → Public Networking → Generate Domain**. If Railway asks which internal port, choose `8080` (or the PORT assigned by Railway if you changed it). The link should be `https://...up.railway.app`.
5. Open the public link in a private/incognito browser. The dashboard and `/api/health` should both respond; check issuer subscription and verifier approval.
6. Share the public app link with the professor, plus the GitHub source code link if allowed.

### Optional password protection

In Railway service Variables, set `DEMO_ACCESS_PASSWORD` to a unique password. The site will prompt for a username and password: username can be any non-empty string, and password must match the variable. Provide the password to the professor separately. Do not commit a password to source code.

### Important cautions

- Everyone accessing this single service shares the **same demo state**. The next visitor can pick up where another left off; the admin reset button restores a clean state.
- Chain history is **ephemeral**. It is recreated when the Railway container restarts/redeploys. That is fine for a class demo, but the chain is not durable storage.
- The localhost wallet mnemonic in this code is a public TEST mnemonic. Never send real assets to it.
- Runtime resources and build time may require more than Railway's small Free tier; monitor estimated usage and do not assume indefinite free hosting.
- For security, this demo must never be treated as real financial infrastructure.

### Temporary alternative: Cloudflare Quick Tunnel from your laptop

1. Run `pnpm install --frozen-lockfile` and `VITE_API_URL= pnpm --filter @greenflow/web build`.
2. Start `node scripts/hosted-demo.mjs` in one terminal (requires local Node 22.12+ and pnpm 12.15).
3. Install `cloudflared`, then in a second terminal run `cloudflared tunnel --url http://localhost:8080`.
4. Share the printed `trycloudflare.com` URL. It only works while your computer, demo, and tunnel remain running. The URL changes each time; it is **not suitable for an assignment link that must remain available later**.
