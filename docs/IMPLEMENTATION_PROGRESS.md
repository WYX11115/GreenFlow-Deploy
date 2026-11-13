# GreenFlow Bond implementation progress

Last updated: 3 November 2026 (Asia/Singapore)

## Current gate

**Phases 0–5 — complete; Gates 0–5 passed.** The local MVP is presentation-ready. Phase 6 is deferred and has not been started.

## Completed scope

- Read and reconciled the complete MVP blueprint and implementation handoff.
- Initialized a Git repository on branch `main` and created the pinned pnpm workspace.
- Added `apps/web`, `apps/api`, `packages/contracts`, and `packages/shared` foundations.
- Pinned Node 22, pnpm 12.15.0, Anvil/Forge 1.7.1, Solidity 0.8.24, localhost ports, and chain ID 31337.
- Defined the eight canonical fictional actors and verified every address against the live Anvil account order.
- Implemented live-chain `GET /api/health`, actor inventory, and in-memory localhost presenter switching.
- Implemented all planned UI routes as explicit placeholders, a persistent local/mock disclosure, responsive navigation, live chain state, canonical terms/story, and a functional actor selector.
- Added a Foundry adapter interface boundary without implementing a token or financial behavior.
- Added start, reset, build, type-check/format, unit-test, and live-stack smoke scripts.
- Added the full MVP plan, engineering guardrails, architecture notes, demo storyboard, and security/limitations record.

### Phase 1

- Implemented six-decimal `MockUSD` with `FAUCET_ROLE`, guarded minting, ERC-20 accounting and explicit demo-funds events.
- Implemented `DemoInvestorEligibilityRegistry` with `REGISTRAR_ROLE`, fictional jurisdiction/accredited attributes, expiration and revocation.
- Implemented zero-decimal `DemoPermissionedBondToken` with a 10-unit cap, recipient eligibility enforcement, `MINTER_ROLE`, `PAUSER_ROLE` and truthful non-ERC-3643 labelling.
- Expanded `IBondTokenAdapter` with the stable eligibility/balance/supply/cap/mint surface needed by Phase 2.
- Added 15 Foundry tests for successful and rejected minting, transfers, revocation/expiry, pause, cap and role controls.
- Added deterministic Anvil deployment, canonical addresses, 4,050 MockUSD seed allocation, live verification, startup deployment and reset/reseed.
- Updated API health to require bytecode at all expected contract addresses before reporting ready.
- Completed and documented the official ERC-3643/T-REX + ONCHAINID feasibility spike.

### Phase 2

- Implemented `BondOffering` with a fixed 10-unit cap, 100 MockUSD price, eligibility check,
  SafeERC20 payment directly to `GreenTreasury`, role-gated mint and atomic rollback.
- Implemented `GreenTreasury` with issuer-only project proposals, verifier-only policy activation,
  immutable approved policy, vendor/project/milestone caps, evidence digests, request rejection and
  cancellation, verifier-only atomic `approveAndRelease`, reentrancy protection and emergency pause.
- Assigned deployed bond `MINTER_ROLE` exclusively to `BondOffering`, revoked admin direct mint and
  permanently relinquished the isolated self-administered mint-authority role.
- Added 27 Phase 2 Foundry tests covering applicable T-01–T-14 scenarios, admin mint-role
  reacquisition prevention, and all required unchanged-balance failure paths. Phase 1's 15 tests
  remain green (42 Solidity tests total).
- Added deterministic five-contract deployment, shared addresses/ABI signatures, clean-state live
  verification, startup/reset integration and a separate full on-chain scenario runner.
- Corrected the canonical EIP-55 checksums for the two pre-existing vendor fixtures after viem
  rejected their prior mixed-case spelling.
- Updated health/UI wording and preserved transaction screens as truthful Phase 3 placeholders.

### Phase 3

- Added actor-scoped viem transaction signing with deterministic unlocked Anvil accounts; no
  private key is returned, logged, or bundled in the browser.
- Added receipt-confirmed API actions for offering open, subscription, project proposal/approval,
  payment request, atomic verifier release/rejection, treasury pause, and full demo reset.
- Added chain-derived offering, holdings, treasury, project, milestone, request, event, and receipt
  views. Financial balances and permissions are never sourced from the metadata store.
- Added guarded PDF/PNG/JPEG evidence ingestion (5 MB maximum), raw-byte SHA-256 hashing, a
  fictional sample document, verifier inspection, and digest-to-request reconciliation.
- Added distinct rejected-attempt records backed by real reverted transaction hashes for Charlie,
  pre-policy payment, UnknownVendor, and M1 over-limit paths.
- Replaced every Phase 3 placeholder with working role-aware Offering, Treasury, Verifier,
  Investor, Use of Proceeds, Administration, and Transaction Receipt screens.
- Added an in-browser full reset, progress/loading/error states, receipt links, desktop and compact
  responsive layouts, and an automated full Phase 3 live-stack acceptance script.
- Chose resettable process-memory storage for evidence bytes/metadata and rejected attempts because
  the authorized scope is a single-presenter local demo and persistence across reset/restart is not
  required. SQLite remains the planned migration point when metadata persistence is needed.

### Phase 4

- Implemented `BondServicingVault` with a fixed 1,050 MockUSD issuer-funding requirement, one-year
  local maturity, full-issuance guard, irreversible record-date finalization, exact per-unit
  principal/coupon accounting, atomic burn-and-pay claims, and double-claim protection.
- Extended the bond token with separately administered `BURNER_ROLE` and `LIFECYCLE_ROLE`; only the
  vault receives them, and deployment relinquishes their self-administered grant authority.
- Kept servicing structurally separate from `GreenTreasury`: the issuer receives an independent
  1,050 seed, the treasury has no vault-funding route, and servicing leaves its 700 balance intact.
- Added deterministic six-contract Phase 4 deploy/verify/reset/start flows and a shared address/ABI
  manifest for the vault at `0x5FC8d32690cc91D4c39d9d3abcBD16989F875707`.
- Added actor-scoped viem servicing endpoints for issuer funding, admin-only Anvil time advancement
  plus record-date finalization, holder claims, chain-derived servicing dashboard fields, events,
  and receipt detail.
- Extended the existing design system: issuer servicing funding, investor combined repayment,
  admin maturity control, and side-by-side project/servicing ledgers are complete role-aware flows.
- Added 14 servicing contract tests and a Phase 4 live E2E that proves early claim, unauthorized
  funding, and duplicate claim failures preserve state, then reconciles exact Alice/Bob payments.

### Phase 5

- Added a chain-state-driven **Next presenter move** card and live completion checkpoints to the
  Home page, plus the exact 5–7 minute presenter runbook in `docs/FINAL_DEMO_GUIDE.md`.
- Fixed two browser-only product defects discovered during rehearsal: parameterless UI POSTs no
  longer send an empty JSON content type, and actor changes remount transaction feedback so a prior
  role's success/error cannot leak into the next role's screen.
- Tightened the treasury presentation path: full issuance precedes policy proposal, the
  pre-approval rejection is enabled only in the proposed state, evidence actions become disabled
  once attached, and the copy explicitly explains byte-level digest sensitivity.
- Added exact raw-byte SHA-256 unit coverage, a one-byte modification assertion, metadata-reset
  coverage, and the same original/modified evidence integrity proof to the live API E2E.
- Added a dependency-free Chrome DevTools browser gate that operates the rendered UI through role
  changes, navigation and clicks. It covers the complete issuance/control/payment/servicing story,
  unchanged rejected paths, final ledger reconciliation, clean resets, accessible control names,
  desktop/500px rendering, screenshot capture, and console errors.
- Added eight visually inspected screenshots covering the dashboard, subscription, policy,
  rejection, release, transparency, servicing, and mobile states under `docs/screenshots/`.
- Stabilized unattended presentation startup by suppressing the already-silent Anvil child's noisy
  RPC stream, while preserving deployment/verification output and app errors. Added an inline
  favicon to eliminate the browser's only 404 console error.

### Post-Gate 5 role-specific UI hardening — 3 November 2026

- Centralized the frontend route-to-role policy and used it for both sidebar filtering and guarded
  route rendering, so the navigation and direct-URL behaviour cannot drift apart.
- Limited Offering/Treasury to Issuer, Verifier desk to Verifier, Investor view to Investor, and
  Administration to Platform Admin. Home, Use of proceeds, and transaction receipt views
  remain shared; Vendor uses the shared transparency workspace.
- Added a clear access message for direct visits to another role's workspace, with links to the
  current role's workspace and Home. This client-side presentation control does not replace
  API actor checks or on-chain contract authorization.
- Added role-policy unit coverage plus rendered-app coverage for issuer navigation and a blocked
  direct Administration visit. No API, shared business logic, or contract behaviour was changed.
- Updated successful actor switching to navigate immediately to the selected role's centralized
  default workspace, avoiding disruptive access messages during the presenter sequence. Added a
  rendered regression test for Verifier-to-Issuer switching.
- Renamed the shared Demo room navigation label to Home. Clean API startup and reset now select
  Issuer, the root route opens Home, and a completed in-app reset returns there automatically.
- Generalized evidence and disbursement handling across M1 and M2. Synchronized issuer selectors
  control milestone-tagged evidence and the selected milestone's amount/request ID; the API rejects
  cross-milestone evidence, the dashboard reads both requests, and the verifier can process either.
- Replaced the generated M1 sample bytes with the supplied one-page fictional evidence PDF in the
  web public assets. The API hashes and serves those exact bytes inline, and issuer/verifier links
  open the document in a new tab. Tests pin its SHA-256 and verify the served PDF response.
- Simplified investor subscription to a neutral Subscribe action with a separate editable unit
  field, prefilled 6/4/1 for Alice/Bob/Charlie. Rejection styling appears only after a failed
  transaction. Moved the holder register to the issuer Offering page; it reveals only positive
  on-chain holders after subscription and reports bond units/subscribed value instead of MockUSD.
- Removed the presentation-irrelevant deterministic contract-address card from Administration,
  while retaining the demo reset as a compact standalone admin action.
- Replaced the three hard-coded Treasury failure buttons with live, milestone-aware payment
  safeguards and one optional collapsed rejection simulator. Existing contract/API rejection paths
  remain unchanged.

## Post-Gate 5 validation record — 3 November 2026

| Command/check | Actual result |
|---|---|
| `pnpm lint` | PASS — shared build, strict TypeScript checks for all workspaces, and Forge formatting. |
| `pnpm test` | PASS — shared 1/1, API 10/10, web 12/12, Foundry 56/56; **79 tests total, 0 failed**. |
| `pnpm build` | PASS — shared/API builds, Vite production build (2,006 modules; 357.66 kB JS / 109.21 kB gzip; 20.50 kB CSS / 5.02 kB gzip), and Solidity build. |

Foundry again emitted only the existing non-fatal managed-sandbox signature-cache warning and
timestamp/test-transfer lint notices; every command exited successfully.

## Phase 5 validation record — 27 October 2026

| Command/check | Actual result |
|---|---|
| `pnpm lint` | PASS — shared build, strict TypeScript checks for all workspaces, and Forge formatting. |
| `pnpm test` | PASS — shared 1/1, API 6/6, web 2/2, Foundry 56/56; **65 tests total, 0 failed**. |
| `pnpm build` | PASS — shared/API builds, Vite production build (2,004 modules; 349.94 kB JS / 107.58 kB gzip; 19.76 kB CSS / 4.86 kB gzip), and Solidity 0.8.24 build. |
| `pnpm demo:start` | PASS — six deterministic contracts deployed and verified; API, web, and RPC reported ready on `127.0.0.1`; chain routine output is presentation-quiet. |
| `pnpm test:e2e` | PASS — separate API gate verified exact evidence SHA-256, changed digest after one-byte modification, unchanged rejected paths, Alice 630, Bob 420, vault 0, and green treasury 700. |
| `pnpm test:browser` | PASS — **two complete real rendered-UI rehearsals** through headless Chrome/CDP, both reset cleanly; 8 screenshots, 500px responsive check, named controls, and 0 console errors. A later single clean pass refreshed the polished screenshots after visual review. |
| Screenshot review | PASS — all 8 desktop/mobile PNGs visually inspected; the rejection receipt is in-frame and the mobile sidebar is settled closed. |
| `pnpm demo:reset` | PASS — six contracts redeployed at the deterministic addresses; verification reported Draft offering, zero supply/treasury/vault, issuer 1,050 seed, and Platform Admin selected. Browser rehearsals had already cleared temporary evidence/rejected-attempt metadata. |

The integrated in-app browser controller was unavailable, so the required browser interactions used
installed Google Chrome via the DevTools protocol rather than Playwright. This is not an API-only
substitute: it selects roles, follows routes, and clicks the rendered controls. API and browser
results are reported separately above. Screenshots plus the runbook are the offline presentation
backup; no video recording was produced because it was optional and did not improve the reliable
local backup package.

Gate 5 rehearsal figures reconciled twice: Alice/Bob issued 6/4 units; Charlie remained at 0;
green treasury moved 1,000 → 700 only after atomic verifier release; SolarSupply received 300;
issuer independently funded 1,050; Alice/Bob received 630/420; vault reached 0; all 10 units were
retired. Each run finished with an in-app reset to clean state.

## Phase 4 validation record — 27 October 2026

| Command/check | Actual result |
|---|---|
| `pnpm lint` | PASS — shared build, strict TypeScript checks for all workspaces, and Forge formatting. |
| `pnpm test` | PASS — shared 1/1, API 4/4, web 1/1, Foundry 56/56; **62 tests total, 0 failed**. |
| `pnpm build` | PASS — shared/API builds, Vite production build (2,004 modules; 345.87 kB JS / 106.71 kB gzip), and Solidity 0.8.24 build. |
| `pnpm demo:start` | PASS — six deterministic contracts deployed and verified; API, web, and RPC ready on `127.0.0.1`. |
| `pnpm test:e2e` | PASS — clean reset; full issuance/M1 flow; early claim and unauthorized funding rejected unchanged; issuer funded 1,050; maturity finalized; Alice paid 630; duplicate rejected unchanged; Bob paid 420; ten units retired; vault 0; treasury 700. |
| `pnpm demo:reset` | PASS — all six contracts redeployed at identical addresses with Draft offering, zero supply, zero treasury/vault balances, issuer 1,050 servicing seed, and Platform Admin selected. |
| In-app `/api/demo/reset` | PASS — repeated the verified chain reset and additionally cleared evidence, rejected attempts, events, and actor selection; final dashboard readback was Draft/0 supply/0 treasury/0 vault/0 metadata. |
| Headless Chrome visual QA | PASS — 1440px investor repayment and separate-ledger views plus 500px compact investor view rendered and were visually inspected; screenshots saved under `docs/screenshots/`. |

Gate 4 final state before the clean reset: Alice received 600 principal + 30 coupon; Bob received
400 principal + 20 coupon; all 10 bond units were burned; servicing principal/coupon totals were
1,000/50; servicing vault balance was 0; green treasury remained 700 and SolarSupply remained 300.

## Phase 3 validation record — 27 October 2026

| Command/check | Actual result |
|---|---|
| `corepack prepare pnpm@12.15.0 --activate` | PASS — repaired the missing Corepack pnpm launcher cache. |
| `pnpm install --frozen-lockfile` | PASS — all 5 workspace projects installed from the pinned lockfile with pnpm 12.15.0. |
| `pnpm lint` | PASS — shared build, strict TypeScript checks for all workspaces, and Forge formatting. |
| `pnpm test` | PASS — shared 1/1, API 3/3, web 1/1, Foundry 42/42; **47 tests total, 0 failed**. |
| `pnpm build` | PASS — shared/API builds, Vite production build (2,004 modules; 344.60 kB JS / 106.38 kB gzip), and Solidity build. |
| `pnpm demo:start` | PASS — clean deterministic deploy/verification; API, web, and RPC ready on loopback. |
| `pnpm test:e2e` | PASS — full reset; issuer open; Alice 6; Charlie reverted; Bob 4; policy proposal; pre-policy, UnknownVendor, and over-limit reverts; evidence hash; M1 request; verifier atomic release; final reconciliation. |
| Headless Chrome visual QA | PASS — 1440px use-of-proceeds/admin states and 500px compact investor view inspected; screenshots saved under `docs/screenshots/`. |

Gate 3 final state: bond supply 10 (Alice 6, Bob 4, Charlie 0); 1,000 MockUSD raised;
treasury 700; SolarSupply 300; UnknownVendor 0; PROJECT-001 Active and spent 300; M1 Paid;
four rejected attempts remain visually and semantically separate from the successful event ledger.

## Validation record — 26 October 2026

| Command/check | Actual result |
|---|---|
| `pnpm lint` | PASS — strict TypeScript checks for all 3 TS workspaces; Forge formatting check passed. |
| `pnpm test` | PASS — shared 1/1, API 2/2, web 1/1 (4 tests total); Forge invoked successfully and reported 0 Solidity behavior tests, as expected before Phase 1. |
| `pnpm build` | PASS — shared/API TypeScript builds; Vite transformed 1,996 modules and emitted a 323.76 kB JS bundle (101.82 kB gzip); Solidity interface compiled/cached successfully. |
| `pnpm demo:start` | PASS — Anvil, API, and web started; readiness banner printed the three localhost URLs. |
| `pnpm test:e2e` | PASS — chain ID 31337/block 0, 8/8 addresses matched live RPC, actor switch round-trip to Bob, web shell HTTP response verified. |
| `pnpm demo:reset` | PASS — `anvil_reset` returned the chain to block 0 and API actor to Platform Admin. |
| Headless Chrome visual QA, 1440×1000 | PASS — layout, disclosures, live chain badge, phase labels, and no-fake-finance messaging rendered correctly. |

Foundry emitted a non-fatal warning while attempting to create its global signature cache under `~/.foundry` in the managed sandbox. Compilation/build still exited 0; this directory is normally writable on a developer machine and is not a project defect.

## Phase 1 validation record — 26 October 2026

| Command/check | Actual result |
|---|---|
| Official `npm ci` | PASS — 990 packages installed; npm audit summary reported 75 findings (17 low, 15 moderate, 39 high, 4 critical). |
| Official `npm run build` | PASS — 106 Solidity 0.8.17 files compiled; 308 typings generated. |
| Official `npm test` | PASS — 275/275 tests in the upstream ERC-3643 checkout. |
| `pnpm lint` | PASS — all strict TypeScript checks and Forge formatting. |
| `pnpm test` | PASS — 4/4 Vitest tests plus 15/15 Foundry tests; 19 total, 0 failed. |
| `pnpm build` | PASS — API/shared builds, Vite production build (1,996 modules), Solidity 0.8.24 build. |
| `pnpm demo:start` | PASS — chain started, contracts deployed and verified, then API/UI became ready. |
| `pnpm demo:reset` | PASS — chain cleared, same addresses redeployed, balances/eligibility restored and verified. |
| `pnpm test:e2e` | PASS — chain 31337, Phase 1 bytecode ready, 8 RPC-matched actors, actor switch and web response. |
| `pnpm contracts:verify:phase1` | PASS — 3 deployed bytecodes, 4,050 MockUSD supply, exact actor balances, Alice/Bob eligible, Charlie ineligible, zero bond supply/cap 10, Alice mint simulation accepted, Charlie/unauthorized mint simulations rejected. |

## Phase 2 validation record — 27 October 2026

| Command/check | Actual result |
|---|---|
| `pnpm contracts:test` | PASS — Phase 1 15/15 plus Phase 2 27/27; **42 Solidity tests, 0 failed**. |
| `pnpm contracts:deploy:phase2` | PASS — five contracts deployed at deterministic expected addresses on chain 31337. |
| `pnpm contracts:verify:phase2` | PASS — bytecode/configuration/roles verified; clean Draft offering, supply 0, treasury 0; offering is sole minter, admin cannot reacquire mint authority, and issuer/verifier roles are separate. |
| `pnpm demo:reset` without API | PASS — chain reset, deterministic redeploy and verification succeeded; unavailable actor API produced a warning rather than failing the chain reset. |
| `pnpm contracts:scenario:phase2` | PASS — 9 successful receipts, 3 reverted receipts, and all final financial assertions passed. |
| `pnpm lint` | PASS — shared build, strict type checks for all TypeScript workspaces, and Forge formatting check. |
| `pnpm test` | PASS — shared 1/1, API 2/2, web 1/1 and Foundry 42/42; **46 tests total, 0 failed**. |
| `pnpm build` | PASS — shared/API TypeScript builds, Vite production build (1,997 modules; 323.80 kB JS / 101.80 kB gzip), and Solidity build. |
| `pnpm demo:start` | PASS — clean five-contract deploy/verification followed by healthy API and web startup on loopback. |
| `pnpm test:e2e` | PASS — chain 31337/block 5, five contracts ready, all 8 actors RPC-matched, Bob switch round-trip, and web shell response. An earlier pre-hardening run also passed before the final rerun. |
| `pnpm demo:reset` with live API | PASS — chain reset, identical addresses and clean state restored; Platform Admin selected. |
| Shared ABI parse check | PASS — all exported Phase 2 human-readable ABI signature sets parsed successfully with viem. |

Scenario receipt evidence from the clean accepted run:

- Alice subscription: `0xc89cfce33c557066e3ec27e80197989c6cad05ccba00482906e5ca56f07d5200`
- Bob subscription: `0xce057475fba911bfecb7bd8bbc4b4c9f1c854b87f307710344dfbf9a252729b5`
- PROJECT-001 policy approval: `0x862da817d71bdc50dc0f0882b3ad90f3b9d027166bc6b67b3e47be0d91f7ad13`
- M1 approve-and-release: `0x1be94f7cbdf649793fc6f1c39edf81d7f4a1c89834f0d34a09ba07bd0dca6cb8`
- UnknownVendor rejection (reverted receipt): `0xd81b4ce72a282c7c1093fb3e70cbbd19c1915378cd16c49c10114f2f13a82e0a`
- Issuer premature release (reverted receipt): `0x37988dcc4654297a5c97102db7049a724dfe0345f67bcfd060b40efaeb57b0fc`
- Duplicate release (reverted receipt): `0xcd04bceb899a28d4f225ceb228caefb06d3b749f66ac53ece750934e96aed206`

Final verified scenario state: bond supply 10 (Alice 6, Bob 4); 1,000 MockUSD raised;
treasury 700; SolarSupply 300; UnknownVendor 0; PROJECT-001 spent 300 and has 500 approved
budget remaining. Reverted attempts did not alter these balances.

## Architectural decisions

- Use the standard Anvil development mnemonic only as an explicitly public fixture; expose addresses, never private keys.
- Keep Phase 0 actor selection in API memory. Persistence and per-session isolation are unnecessary for the single-presenter local demo and can be revisited with Phase 3 metadata storage.
- Keep the contracts package business-logic-free in Phase 0. Foundry/Anvil are installed and validated, but token, treasury, offering, and servicing contracts remain gated.
- Use a real JSON-RPC chain probe for health; do not return a hardcoded healthy state.
- Run Anvil with `--silent` so routine startup does not print fixture private keys.
- Keep test/build scripts local and pinned; no remote RPC, faucet, hosted database, or external identity provider is required.
- The official reference suite is runnable standalone, but is not adopted for this MVP because its Hardhat/Solidity 0.8.17/OpenZeppelin 4 proxy-and-claims topology and 990-package dependency graph would create disproportionate integration and demo risk. The full evidence is in `docs/ERC3643_FEASIBILITY.md`.
- Keep live bond supply at zero in Phase 1. Eligible receipt is proven by tests and non-mutating `eth_call`; actual issuance must occur atomically with subscription in Phase 2.
- Keep the normal Phase 2 startup state clean: offering Draft, supply zero, treasury zero and no
  project proposal. Run the scenario only after an explicit reset when receipt evidence is needed.
- Freeze approved policy for the MVP. Supporting amendments safely requires verifier-authorized
  versioning and committed-request migration rules; no amendment route is exposed in Phase 2.

## Outstanding risks and next dependencies

- The fallback is not genuine ERC-3643/ONCHAINID or KYC and must never be presented as such.
- The deployed offering is the only bond minter. The token constructor grants the deployment admin
  temporary isolated mint administration for Phase 1 compatibility; the Phase 2 deploy script
  assigns the offering, revokes admin mint, then removes the final self-administered mint authority
  so `DEFAULT_ADMIN_ROLE` cannot reacquire it.
- MockUSD faucet minting is intentionally unlimited and admin-controlled for local reset/setup only.
- Evidence and rejected attempts are resettable in-memory demo metadata, not persistent records;
  canonical permissions, balances, policy, and payment status remain on-chain.
- No public deployment, real identity/KYC, durable evidence archive, production maturity oracle,
  default/recovery workflow, or production key custody exists yet.
- The local admin retains role-administration authority; production multisig/timelock governance,
  formal audits and key custody are out of scope.
- The Phase 2 policy supports one vendor per project, one completed payment per milestone and no
  post-approval amendments. Formal change orders and disputes remain future work.
- Actor selection is process-global and in-memory, appropriate only for the one-presenter localhost demo.
- `pnpm test:e2e` is the API transaction acceptance path. `pnpm test:browser` separately operates
  the rendered UI with headless Chrome/CDP; the integrated browser controller was unavailable.
- Public-chain deployment and production security are outside the MVP scope.

## Next phase dependencies

Phase 6 remains explicitly deferred and requires separate approval. It would cover public-chain
deployment, audited/production contracts, genuine regulated identity, key custody, monitoring,
recovery, legal settlement integration, and production governance. None of that work was started.

## Gate decision

Gates 0–4 remain passed. **Gate 5 is passed:** the final local MVP completes two clean rendered-UI
rehearsals with reconciled accounting, stable reset, clear limitations, responsive screenshots,
named controls, and zero browser console errors; all required lint/test/build/API/reset checks pass.
The final presentation starts with `pnpm demo:start` and follows `docs/FINAL_DEMO_GUIDE.md`.
**STOP before Phase 6.**


