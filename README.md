# GreenFlow Bond

GreenFlow Bond is a local, presentation-first demonstration of a tokenised green bond whose proceeds are governed by programmable spending controls. This repository contains the complete **Phases 0–5 MVP**: the runnable foundation, eligibility-restricted bond, atomic subscription, independently authorized programmable treasury, working browser flows, separate issuer-funded maturity servicing, and presentation-ready QA package.

> **DEMO — local blockchain — mock funds — simulated identities and verification.** No real security, money, KYC decision, green certification, or public-chain deployment exists here.

## First-time setup

The standard demo is fully local. It does not require Docker, a browser wallet, a public RPC,
MetaMask, a database server, or a global Foundry installation.

### 1. Install the required software

Install these tools before cloning the repository:

1. **Git** — download it from [git-scm.com](https://git-scm.com/downloads), or use the Git already
   provided by your development environment.
2. **Node.js 22.12 or newer** — download Node 22 from
   [nodejs.org](https://nodejs.org/en/download). The repository includes `.nvmrc`, so macOS/Linux
   users with `nvm` can run `nvm install && nvm use` instead.
3. **Google Chrome** — optional for normal use, but required by `pnpm test:browser` and automated
   screenshot generation. Download it from [google.com/chrome](https://www.google.com/chrome/).
4. **A terminal** — Terminal/iTerm on macOS, a Linux shell, or PowerShell on Windows.

Foundry and Anvil are pinned in the workspace at version 1.7.1 and are installed by pnpm. Do not
install separate global copies for this project.

Confirm the basic tools are available:

```bash
git --version
node --version
corepack --version
```

`node --version` must report `v22.12.0` or newer.

### 2. Clone or extract the repository

```bash
git clone <repository-url>
cd GreenFlow
```

Replace `<repository-url>` with the Git URL supplied for this project. If you received a ZIP file,
extract it and open a terminal in the extracted `GreenFlow` directory instead.

### 3. Install a pnpm-12-compatible Corepack and activate pnpm

The Corepack bundled with some Node 22 installers predates pnpm 11/12's executable-layout change.
Update Corepack to `0.34.7` first; this release supports Node 22.12+ and understands the pnpm 12
`pnpm.mjs` entry point. The project itself requires pnpm `12.15.0`, declared in `package.json`.

```bash
corepack disable
npm uninstall --global pnpm yarn
npm install --global corepack@0.34.7
corepack cache clean
corepack enable
corepack install --global pnpm@12.15.0
hash -r
pnpm --version
```

The final command must print `12.15.0`. `hash -r` refreshes the command lookup in macOS/Linux
shells; PowerShell users can omit that line and open a new terminal instead. If a global npm command
reports a permissions error, use a user-owned Node installation such as `nvm`; do not change project
file permissions or run the GreenFlow application with `sudo`.

### 4. Install dependencies

```bash
pnpm install --frozen-lockfile
```

This installs all five workspace projects, including the pinned Anvil and Forge executables. Use
pnpm—not `npm install` or `yarn`—so the committed lockfile remains authoritative.

### 5. Create the local environment file

The checked-in defaults already use the standard localhost ports, so this file is primarily a
documented local configuration copy.

macOS or Linux:

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

The included mnemonic is the public Anvil development fixture. Never reuse it for real assets.
Local `.env` files are ignored by Git; `.env.example` remains tracked.

### 6. Start the complete demo

From the repository root, run:

```bash
pnpm demo:start
```

Leave this terminal running. Open the application in a browser:
- Web app: <http://127.0.0.1:5173>

The clean application starts on **Home** with **Issuer** selected as the presenter actor.

### 7. Stop or reset

Press `Ctrl+C` in the `pnpm demo:start` terminal to stop the chain, API, and web application.

For a complete reset during a presentation, use the preferred browser flow:

1. select **Platform Admin**;
2. open **Administration**; and
3. click **Reset six-contract demo** and wait to return to **Home** as Issuer.

That resets the contracts and clears temporary evidence and rejected-attempt metadata. If the UI is
unavailable but the stack is still running, use the terminal fallback:

```bash
pnpm demo:reset
```

The fallback resets Anvil, redeploys and verifies the six deterministic contracts, restores seeded
MockUSD/eligibility, and selects Issuer. Restart `pnpm demo:start` if the stack itself was
stopped.

## Validation and development commands

Static checks do not require the demo stack:

```bash
pnpm lint
pnpm test
pnpm build
```

For live API and browser checks, keep `pnpm demo:start` running in Terminal A. In Terminal B run:

```bash
pnpm test:e2e
pnpm test:browser
```

- `test:e2e` resets the running stack and executes the complete API workflow, exact accounting,
  rejected paths, and original-versus-modified evidence hashing.
- `test:browser` uses installed Chrome to complete the rendered role workflow twice, exercise
  actual controls, check the 500px layout and accessible names, capture eight screenshots, reset,
  and fail on browser console errors.

The browser script automatically finds Chrome at its standard macOS location. Elsewhere, set
`CHROME_PATH` before running it.

Linux example:

```bash
CHROME_PATH=/usr/bin/google-chrome pnpm test:browser
```

Windows PowerShell example:

```powershell
$env:CHROME_PATH = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
pnpm test:browser
```

### Useful commands

| Command | Purpose |
|---|---|
| `pnpm demo:start` | Start, deploy, verify, and health-check the complete local MVP. |
| `pnpm demo:reset` | Reset and redeploy the six contracts while the stack is running. |
| `pnpm lint` | Run strict TypeScript checks and Forge formatting verification. |
| `pnpm test` | Run shared, API, web, and 56 Solidity tests. |
| `pnpm build` | Produce all TypeScript/web builds and compile Solidity contracts. |
| `pnpm test:e2e` | Run the complete live API acceptance flow. |
| `pnpm test:browser` | Run real Chrome UI rehearsals and refresh presentation screenshots. |
| `pnpm chain:start` | Start only Anvil for contract-focused work. |
| `pnpm contracts:deploy:phase4` | Deploy the final six-contract manifest to running local Anvil. |
| `pnpm contracts:verify:phase4` | Verify the clean final contract deployment. |

For contract-only development, start `pnpm chain:start` in Terminal A, then run the deploy and
verify commands from Terminal B.

## Troubleshooting

### pnpm reports a missing Corepack module

If the error mentions a missing path ending in `pnpm/12.15.0/bin/pnpm.cjs`, the installed Corepack
is using the pre-pnpm-11 executable path. Replace that Corepack version, clear its supported cache
directory, and reinstall the pinned pnpm release:

```bash
corepack disable
npm uninstall --global pnpm yarn
npm install --global corepack@0.34.7
corepack cache clean
corepack enable
corepack install --global pnpm@12.15.0
hash -r
pnpm --version
pnpm install --frozen-lockfile
```

PowerShell users should omit `hash -r` and open a new terminal. If the error remains, run
`type -a node corepack pnpm` on macOS/Linux (or `Get-Command node,corepack,pnpm -All` in PowerShell)
to find an older Node/Corepack installation earlier on `PATH`. If `corepack` itself is unavailable,
reinstall Node 22 and open a new terminal before retrying.

### A localhost port is already in use

Stop any older `pnpm demo:start`, Vite, API, or Anvil terminal first. To identify listeners on
macOS/Linux:

```bash
lsof -nP -iTCP:5173 -sTCP:LISTEN
lsof -nP -iTCP:3001 -sTCP:LISTEN
lsof -nP -iTCP:8545 -sTCP:LISTEN
```

On Windows PowerShell:

```powershell
Get-NetTCPConnection -LocalPort 5173,3001,8545 -ErrorAction SilentlyContinue
```

### The page opens but reports that the chain is unavailable

Wait for the `GreenFlow final MVP is ready` banner. If startup stopped earlier, press `Ctrl+C`, fix
the first reported error, and run `pnpm demo:start` again. Do not start the Vite UI alone for the
presentation—the API and Anvil must also be running.

### Chrome cannot be started by the browser test

Install Google Chrome and point `CHROME_PATH` to the executable as shown above. Normal use of the
web app does not require Chrome; this requirement applies only to `pnpm test:browser`.

### A demo action is disabled or the state is unexpected

Return to **Home** and follow the displayed next role/action. If necessary, use the in-app
admin reset and restart the walkthrough from **Open the offering**.

## Workspace map

```text
apps/api/             Local-only Fastify API and chain/actor services
apps/web/             React role-based working presentation MVP
packages/contracts/   Foundry contracts, tests, and deterministic Phase 4 deployment
packages/shared/      Canonical actors, terms, types, and formatting helpers
scripts/              Start, reset, scenario, and E2E orchestration
docs/                 Master product blueprint and agent handoff
```

See [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) for the complete MVP roadmap and
[`docs/IMPLEMENTATION_PROGRESS.md`](docs/IMPLEMENTATION_PROGRESS.md) for actual gate results.
