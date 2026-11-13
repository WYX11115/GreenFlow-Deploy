# GreenFlow Bond implementation plan

This plan translates the master blueprint into phase-gated delivery. The blueprint and handoff in `docs/` remain the product source of truth. Later phases are planned, not authorized by this file.

## Product architecture and dependency chain

`Anvil → Solidity contracts → Fastify/viem signer API → React role UI`

SQLite and local evidence storage support presentation metadata only. Chain state remains authoritative for eligibility, supply, subscriptions, policy permissions, disbursement state, and servicing claims.

## Phase 0 — Project foundation (complete)

### Tasks

- Create a pinned pnpm monorepo with `apps/web`, `apps/api`, `packages/contracts`, and `packages/shared`.
- Pin Node 22, Foundry/Anvil binaries, Solidity 0.8.24, chain ID 31337, localhost ports, deterministic mnemonic, public actor addresses, canonical amounts, and route inventory.
- Build the Fastify application foundation with `GET /api/health`, `GET /api/demo/actors`, and localhost-only `POST /api/demo/actor`.
- Build the React shell, persistent demo disclosure, chain-health indicator, navigation, explicit future-phase placeholders, and functional actor switcher.
- Add one-command orchestration, reset, Phase 0 smoke check, strict type checks, builds, and unit tests.
- Create persistent engineering instructions, full delivery plan, progress log, README, and safe environment example.

### Gate 0 acceptance

- Anvil, API, and UI start from one command.
- `/api/health` reports connected chain ID 31337 and current block.
- The UI loads, shows the fictional/local/mock disclosure, displays all fixed actors, and switches the API-selected actor.
- Every financial route is visibly a placeholder; there are no fake transactions or financial results.
- Lint/type checks, unit tests, contract toolchain check, production build, and running-stack smoke check pass.

## Phase 1 — Compliance-token feasibility and investor eligibility (complete)

### Dependencies

Stable Phase 0 chain, Foundry build, shared actors, API health, and honest UI status labels.

### Tasks

- Implement `MockUSD` with 6 decimals and demo-only faucet role.
- Attempt a time-boxed, reproducible local deployment of the official ERC-3643/T-REX + ONCHAINID stack.
- Record commands, contracts, test outcomes, maintenance cost, and blockers in a decision memo.
- If unsuitable for the pitch, implement `DemoInvestorEligibilityRegistry` and `DemoPermissionedBondToken` behind `BondTokenAdapter`, with truthful labels.
- Test eligible Alice/Bob ownership and direct-call rejection for ineligible Charlie.

### Implemented decision

The official suite was cloned at commit `2f0704d`, compiled successfully (106 Solidity files), and passed its 275-test suite. It was not adopted because integrating its Hardhat/Solidity 0.8.17/OpenZeppelin 4 proxy-and-claims ecosystem would add a second contract toolchain, 990 packages with material audit findings, and disproportionate deployment/identity complexity. The fallback contracts and `IBondTokenAdapter` preserve the migration boundary; see `docs/ERC3643_FEASIBILITY.md`.

### Gate 1

**Passed:** eligible ownership works on-chain; ineligible receipt/transfer reverts; role and supply controls pass; deterministic Anvil deployment is verified; the official-suite decision is explicit and evidenced. Stop for Phase 2 approval.

## Phase 2 — Subscription and programmable treasury (complete)

### Dependencies

Phase 1 token adapter decision and deployed local payment/eligibility assets.

### Tasks

- Implement `BondOffering`: fixed 10 units at 100 MockUSD, atomic payment-to-treasury and mint.
- Implement `GreenTreasury`: verifier-only approved policy, project/vendor/milestone caps, issuer requests, rejection, pause, and atomic approve-and-release.
- Add deterministic deploy/seed scripts and address manifest generation.
- Add Solidity unit and invariant tests for T-01 through T-14, including role, vendor, pre-approval, duplicate, over-budget, underfunding, and pause failures.

### Implemented result

`BondOffering` enforces a fixed 10-unit, 100 MockUSD subscription with atomic payment-to-treasury
and minting. `GreenTreasury` records issuer proposals, requires independent verifier activation,
stores evidence digests, and atomically verifies and releases approved milestone payments. The
deployment permanently seals mint administration after making the offering the only bond minter,
keeps startup clean, and provides a separate receipt-producing scenario runner. Forty-two Solidity
tests cover all Phase 1 behavior and the
applicable T-01–T-14 success, authorization, accounting and rollback paths.

### Gate 2

**Passed:** Alice 6 + Bob 4 subscriptions produce treasury 1,000; valid M1 payment leaves treasury
700 and Vendor A +300; UnknownVendor, premature and duplicate attempts have reverted receipts and
move no funds. Stop for Phase 3 approval.

## Phase 3 — Transactional API, evidence, and presentation UI (complete; Gate 3 passed)

### Dependencies

Stable Phase 2 ABIs, deployment manifest, custom errors/events, and reset semantics.

### Tasks

- Add actor-scoped backend signers, contract reads/writes, receipt confirmation, decoded errors, and event indexing.
- Add SQLite metadata and guarded evidence uploads with raw-byte SHA-256, MIME/size limits, and integrity comparison.
- Complete Issuer, Verifier, Investor, Impact, Admin, and local transaction detail flows.
- Show failed actions as rejected attempts rather than successful ledger events.
- Add API integration and browser tests for subscriptions, policy authorization, request review, invalid attempts, and M1 payout.

### Gate 3

**Passed:** the presenter can complete subscription through M1 payout entirely in the browser;
every balance and receipt reconciles to chain state. Evidence and rejected-attempt metadata use a
resettable in-memory local store for the single-presenter demo; SQLite remains deferred until
metadata must survive process restarts. Stop for Phase 4 approval.

## Phase 4 — Separate servicing lifecycle (complete; Gate 4 passed)

### Dependencies

Full issuance, frozen/capped supply, stable holder balances, and UI/API transaction patterns.

### Tasks

- Implement independently funded `BondServicingVault`, maturity guard, record-date transfer freeze, and one combined coupon-plus-principal claim with token burn/redemption.
- Add local-only time advancement and explicit simulation messaging.
- Add separate project-spending and servicing ledgers/screens.
- Test T-15 through T-18 and invariant that the green treasury never funds servicing.

### Gate 4

**Passed:** issuer funds 1,050 independently; Alice receives 30 + 600, Bob 20 + 400; vault reaches 0; all 10 units are retired; treasury remains 700; early, unauthorized, underfunded, and double-claim paths fail without changing balances. Stop for Phase 5 approval.

## Phase 5 — QA and pitch packaging (complete; Gate 5 passed)

### Dependencies

All required flows and stable reset/deployment scripts.

### Tasks

- Complete rendered-browser happy/negative paths, evidence tamper check, and two deterministic resets.
- Rehearse the full flow twice from clean state with no remote dependency or terminal action after startup.
- Polish responsive/accessibility states, pending/success/rejection feedback, recovery screens, and transaction debug panel.
- Produce a 5–7 minute runbook, troubleshooting guide, screenshots, and offline backup package.

### Implemented result

The final MVP now has a chain-state-driven presenter guide, a 5–7 minute runbook, stable pending/
success/rejection states, evidence-byte tamper tests, a quiet presentation launcher, and eight
visually inspected desktop/mobile backup screenshots. Browser validation uses installed headless
Chrome through the DevTools protocol because the integrated browser controller was unavailable;
it performs real rendered-UI navigation, actor selection, and clicks rather than substituting API
requests. The separate API E2E continues to prove exact accounting and unchanged rejected paths.

### Gate 5

**Passed:** lint, 65 automated tests, production build, launch, API E2E, command-line reset, and
two complete rendered-UI rehearsals passed. The browser runs ended in clean reset state with named
controls, responsive 500px rendering, eight screenshots, and zero console errors. Stop before the
deferred Phase 6.

## Phase 6 — Production-oriented roadmap (deferred; not MVP authorization)

- Polygon Amoy/public deployment and verified address manifests.
- Audited contracts, production key custody, monitoring, recovery, privacy, and incident controls.
- Genuine ERC-3643/ONCHAINID integration and regulated onboarding.
- Legally integrated security terms and permitted cash/stablecoin settlement.
- Multi-issuer governance, change orders, disputes, analytics, and suitable secondary-market controls.

## Cross-phase validation map

- Contract tests: blueprint T-01–T-18 in Phases 1, 2, and 4.
- Evidence integrity: T-19 in Phase 3/5.
- Deterministic reset: T-20 in Phase 5, with basic reset mechanics established in Phase 0.
- NFRs: integer accounting and localhost security from foundation; auditability/error handling as transactions arrive; accessibility and resilience checked continuously; full repeatability at Gate 5.

