# GreenFlow — Implementation Agent Quickstart

**Read the complete companion document first:** `GreenFlow_MVP_Implementation_Blueprint.md` (master specification, v1.0). This quickstart tells a coding agent where to begin; the master spec controls any omissions here.

## Mission
Build a reliable, visually polished but small **local-EVM full-stack demonstration** of GreenFlow Bond, a programmable tokenised green bond which enforces **approved use-of-proceeds spending** at the time money moves. Local demo only; **do not require Polygon, wallets, faucets, real money or external KYC services**. The frontend must genuinely trigger smart-contract transactions on local Anvil; no fabricated successful states.

## MVP commitments
1. End-to-end investor purchase with simulated investor eligibility and true contract-level token transfer restriction.
2. Issuer proposes green project and vendor/milestone budget policy; **independent verifier** authorises project/vendor/milestone spend policy **on-chain**. Issuer cannot self-authorise green use of proceeds.
3. Issuer requests vendor payment with SHA-256 hash of off-chain fictional evidence; verifier approves and the treasury **atomically pays** only a pre-approved vendor, within pre-approved project/milestone caps, without double payout.
4. Show blocked vendor payment / budget overspend / unauthorized role / pre-verification payout attempt; failed tx must leave all balances unchanged.
5. Investor dashboard showing issued bond token amount, allocated project budget, verified milestones, treasury balance, paid vendors, tx hashes, evidence digest.
6. Independent issuer-funded servicing vault for one 5% coupon and full principal redemption on simulated maturity; no double claims; never siphon unspent green proceeds into debt service.
7. Deterministic local wallets, role switcher and `pnpm demo:start`, `pnpm demo:reset`, `pnpm test`, `pnpm test:e2e`.

## Canonical seed dataset
- GreenSun Energy Pte Ltd; GreenSun Solar Green Bond 2026, `GSGB`, 10 whole bond units, $100 mock USD face per unit; 5% annual coupon, 1 simulated year.
- Alice (eligible) buys 6, Bob (eligible) buys 4, Charlie (not eligible) is rejected.
- Green treasury receives $1,000 mock USD (ERC-20 with 6 decimals).
- Issuer proposes Solar Panels for Community Facilities: total budget $800; approved Vendor A, unapproved Vendor B; milestones $300 equipment and $500 installation.
- Independent verifier authorises policy, reviews milestone evidence and signs `approveAndRelease` to release $300 to Vendor A; the contract enforces all rules.
- Treasury ends $700 after first payout and $200 after both, distinct from servicing vault.
- Issuer funds servicing vault with additional $1,050 mock USD from its own test account; Alice claims $30 coupon+$600 principal, Bob $20 coupon+$400 principal. Never claim tokenisation guarantees issuer repayment.

## Stack
- Solidity 0.8.24, Foundry `anvil`/`forge`, OpenZeppelin v5 AccessControl/SafeERC20/ReentrancyGuard/Pausable.
- Node + Fastify + viem backend with local test-only signers; SQLite + off-chain demo evidence file storage.
- React + Vite + TypeScript + Tailwind frontend. Route views: `/demo`, `/issuer/offerings`, `/issuer/treasury`, `/verifier`, `/investor`, `/impact`, `/admin`, `/transactions/:hash`.
- pnpm monorepo; typed ABI and amount helpers; source of truth for funds and permissions is chain, never SQLite.

## ERC-3643 / ONCHAINID rule
Run an early self-deployment spike on the **official** ERC-3643/T-REX suite. If reliable, integrate it; if too slow, finish the story with an explicitly labeled `DemoPermissionedBondToken` plus `DemoInvestorEligibilityRegistry`, **not falsely described as ERC-3643/ONCHAINID**. Put a token adapter boundary in the API for later substitution. See master spec Section 1.3.

## Phase-by-phase execution plan (all phases, gated)

**Source of truth:** `GreenFlow_MVP_Implementation_Blueprint.md`, Section 13. Never confuse this roadmap with permission to build all phases at once. Implement exactly the requested phase, verify its gate, update `IMPLEMENTATION_PROGRESS.md`, then STOP until user approval. Phase 6 is explicitly deferred.

### Phase 0 — Scope lock, foundation and skeleton
**Objective:** Make the repository and development environment reproducibly runnable without pretending that financial flows are implemented.

**Build:**
- pnpm monorepo and `apps/web`, `apps/api`, `packages/contracts`, `packages/shared`, `docs` structures.
- Foundry/Anvil local chain, fixed demo actor wallets and role names; no public deployment.
- Boot scripts for local chain, API, and UI; API `GET /api/health` returns correct chain ID and local connectivity.
- Frontend navigation/route placeholders, visible `DEMO / local chain / mock funds` disclaimer and functional *presenter-only* actor switcher.
- Shared TypeScript interfaces/constants for bond/project/milestone/payment; sample amounts locked in documentation.
- Root `AGENTS.md`, `IMPLEMENTATION_PLAN.md`, `IMPLEMENTATION_PROGRESS.md`; sample `.env.example` without real keys.

**Acceptance Gate 0:** All required processes start reliably; health check works; roles appear; placeholders are explicitly placeholders; no hardcoded fake successful transactions. **Stop for approval.**

### Phase 1 — Local compliance-token spike and honest ERC-3643 decision
**Objective:** Validate eligible vs. ineligible bond ownership on chain and determine if complete ERC-3643/ONCHAINID is feasible in the MVP.

**Build:**
- `MockUSD.sol` test payment asset and a minimal compliant local bond-token interface.
- Try **official** T-REX/ONCHAINID local self-deployment on a disposable spike branch; document setup, blocker(s), commands and test outcome.
- If feasible and reliable, plan official integration for Phase 2. Otherwise implement `DemoInvestorEligibilityRegistry` and `DemoPermissionedBondToken` with on-chain mint/receive/transfer restrictions, and a `BondTokenAdapter` interface for later replacement.
- Display the actual implementation status in the UI and docs. Never call the simplified fallback ERC-3643 compliant.

**Acceptance Gate 1:** Eligible Alice/Bob can receive demo tokens, ineligible Charlie cannot receive or transfer into ownership (direct contract calls revert). Tests pass and an explicit decision memo records whether official T-REX will be used. **Stop for approval.**

### Phase 2 — Atomic bond subscription and programmable green treasury (core differentiator)
**Objective:** Make GreenFlow's innovation work **on chain**, independently of the frontend.

**Build:**
- `BondOffering.sol`: $100/unit, 10 units; simulated MockUSD subscription to issuer-designated *green proceeds treasury* coupled with bond issuance atomically. Alice buys 6/$600, Bob buys 4/$400; Charlie rejected.
- `GreenTreasury.sol`: issuer proposes project policy; **independent verifier** authorises project, vendor, project and milestone caps; issuer requests payout with hashed evidence; verifier approves and **atomically transfers** MockUSD to the approved vendor.
- Authorisation, duplication and budget guards at the Solidity level: wrong role, wrong vendor, unapproved policy/milestone, overspend, duplicate payment, insufficient balance and pause.
- Unit/invariant tests for both success and rejection, with balances and revert results asserted.

**Acceptance Gate 2:** Starting from $1,000 collected, M1 $300 authorised transfer leaves treasury $700, Vendor A +$300, Vendor B +$0. Invalid attempts never transfer money. Direct contract calls prove restrictions; all tests pass. **Stop for approval.**

### Phase 3 — Presentation-grade API, evidence store and role-specific UI
**Objective:** Enable presenters to demonstrate the complete approved/rejected disbursement story through a polished browser UI, without terminal interaction after startup.

**Build:**
- Fastify/viem API with demo-actor scoped signers; no client-controlled private key selection and no real keys.
- React + Vite + TS role routes: `/demo`, `/issuer/offerings`, `/issuer/treasury`, `/verifier`, `/investor`, `/impact`, `/admin`, `/transactions/:hash`.
- Real contract reads, action forms, receipt confirmation, understandable custom-error decoding, policy proposal/review, evidence upload + SHA-256 verification and investor audit timeline.
- SQLite **only** for non-authoritative metadata, evidence paths, rejected attempts and indexed event lookups. Balances, supply and authorised permissions must come from the chain.
- On failed transactions, show a visible rejected attempt; do **not** fabricate a successful on-chain transaction/event.

**Acceptance Gate 3:** From browser alone, presenter can subscribe as Alice/Bob, show Charlie blocked, propose and verify spending policy, attempt invalid payout, approve valid M1 and view treasury $700 / Vendor A +$300 with transaction hash. All displayed balances reconcile to chain. **Stop for approval.**

### Phase 4 — Separate bond servicing and explanatory UX
**Objective:** Demonstrate bondholders' economic payments without falsely spending residual green proceeds for debt service.

**Build:**
- `BondServicingVault.sol`, independently funded by issuer with **additional** $1,050 MockUSD.
- Simulated record date/maturity rules; one annual 5% coupon and $1,000 principal redemption allocated to holdings ($30/$600 Alice; $20/$400 Bob).
- Prevent double coupon claims and double principal claims, and prevent transfer/entitlement manipulation during claim period as prescribed by master spec.
- Investor servicing screens and dashboard separation of **project spending** from **repayment source**; label milestones as approval evidence, not proven environmental impact.

**Acceptance Gate 4:** Servicing vault starts $1,050, pays $50 coupon + $1,000 principal, ends $0; green proceeds treasury remains unaffected. No double claims and all numbers reconcile. **Stop for approval.**

### Phase 5 — QA, repeatable demo and pitch packaging
**Objective:** Make the MVP robust enough for a classroom investor pitch.

**Build:**
- `pnpm demo:start` and `pnpm demo:reset` run reliably and reproducibly.
- `pnpm test`, `pnpm test:e2e`, `pnpm build`, lint / smoke checks as documented; Playwright coverage of happy path and key rejection cases.
- UX polish, error recovery, clear mock-vs-real disclosures, evidence hash checking, readiness checks and no inert buttons.
- 5–7 minute demo runbook and contingency screenshots/recording; avoid reliance on faucets, remote RPC or external service.

**Acceptance Gate 5:** Clean-reset demo runs **twice** from start to finish, with no external dependency and no terminal action after startup. Any unimplemented feature is clearly marked; no fabricated success states. **Stop; report final readiness.**

### Phase 6 — Later production-oriented work (NOT authorised now)
Potential Polygon Amoy/public deployment, audited controls, real T-REX/ONCHAINID and regulated investor onboarding, actual bank/cash settlement integration, legal rights and debt-servicing workflows, multi-issuer/analytics. Do not execute Phase 6 unless separately commissioned.

### Mandatory closeout of each authorised phase
1. State scope completed with feature/requirement IDs from the blueprint.
2. List created/modified files and explain why.
3. Run validation commands, state pass/fail counts and quote actual error output for failures (do not invent results).
4. Record architecture deviations and unresolved risks; never silently change project's business promise.
5. Update `IMPLEMENTATION_PROGRESS.md` with gate result and next-phase dependencies.
6. **STOP AND REQUEST USER APPROVAL** for the next phase; do not start it.

## Definition of done
- Entire main demonstration possible in a browser without terminal intervention after startup.
- Both eligible investor subscription and ineligible subscription rejection tested.
- Before release `treasury=1000`, after $300 release `treasury=700`, `Vendor A +300`, `Vendor B +0`; attempt to pay twice fails.
- Policy and milestone approval must come from VERIFIER_ROLE, not the issuer wallet.
- A rejected/reverted tx produces no vendor payment and is labeled an unsuccessful **attempt**, not recorded as a successful on-chain event.
- Final separate servicing vault accounting: initial 1050, coupon 50, principal 1000, vault 0; GreenTreasury unaffected.
- Compile/tests pass, failure behavior works, no dead UI buttons, local reset repeatable.
- Visible `DEMO / local chain / mock funds / simulated KYC + verifier` disclaimer and truthful ERC-3643 compliance label.

## Start now — explicit first-phase order

**Implement Phase 0 only**, using the phase-specific deliverables and Gate 0 above. Read the master blueprint before coding, including Section 13 and FR/NFR/test IDs. Create the repo skeleton, actor switcher, scripts and local health connection. **Do not implement the Phase 2 treasury contract in Phase 0**; it belongs to Phase 2. Stop for approval once Gate 0 is demonstrably satisfied.
