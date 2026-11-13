# GreenFlow engineering instructions

## Mission and current authorization

Build GreenFlow Bond as a deterministic, local-EVM teaching demonstration of programmable green-bond proceeds. The differentiator is contract-level prevention of payments that do not satisfy approved project, vendor, milestone, budget, and independent-verifier rules.

The project is phase-gated. **Phases 0–5 are complete. Do not implement Phase 6 or later without explicit user approval.** Read both source handoff files in `docs/` and `IMPLEMENTATION_PLAN.md` before changing product behavior.

## Non-negotiable product rules

- Core financial permissions and balances must eventually be enforced and sourced on-chain, never simulated as successful UI state.
- The issuer may propose spending policy; only an independently authorized verifier may activate it.
- Verifier approval and vendor payment must be atomic in `approveAndRelease`.
- Ring-fenced green proceeds and issuer-funded debt servicing remain separate.
- MockUSD uses 6 decimals and bond units use 0 decimals. Never use JavaScript floating point for signed accounting values.
- A simplified eligibility token must be labelled a demo compliance simulation, not ERC-3643 compliant.
- Environmental verification is an off-chain attestation whose digest is recorded on-chain; it is not autonomous proof of impact.
- All identities, funds, organizations, approvals, and documents are fictional. Never introduce real keys, PII, or bank credentials.
- Bind local services to `127.0.0.1`. Presenter signers are development fixtures only.

## Architecture conventions

- Monorepo: pnpm workspaces under `apps/*` and `packages/*`.
- Chain: Anvil, chain ID `31337`; contracts: Solidity `0.8.24` with Foundry.
- API: Fastify + viem. It may hold deterministic demo signers, but the contract remains authoritative.
- Web: React + Vite + TypeScript + Tailwind, with role-aware routes and accessible controls.
- Shared package owns domain types, public actor metadata, amount constants, and later generated ABIs/addresses.
- SQLite (introduced when metadata persistence is needed) may store display metadata, evidence paths, rejected attempts, and event indexes only—not canonical balances or permissions.
- API errors use stable machine-readable codes. Transaction UIs wait for successful receipts before displaying success.

## Development rules

- Keep TypeScript strict and dependency versions pinned.
- Use the fixed actors and sample amounts in `packages/shared/src/constants.ts`; do not invent competing seed data.
- Do not expose mnemonic-derived private keys through API responses, logs, or frontend bundles.
- Route placeholders must say which future phase unlocks them. Do not display fabricated balances, transaction hashes, or success states.
- Add or update tests with each phase, including negative cases that assert unchanged balances.
- Run `pnpm lint`, `pnpm test`, and `pnpm build` before closing an implementation phase. Run the phase-specific smoke/E2E gate as documented.
- Update `IMPLEMENTATION_PROGRESS.md` with actual commands and results. Never claim an unrun check passed.

## Phase gate protocol

For each authorized phase: implement only that phase, validate its acceptance gate, record deviations and risks, update progress, then stop and request approval. Phase 6 (public-chain and production-oriented work) is explicitly deferred.

