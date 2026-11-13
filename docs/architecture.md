# Phase 4 architecture

## Runtime topology

```text
Browser (127.0.0.1:5173)
  │  role-aware intent, evidence, servicing, receipt and transparency views
  ▼
Fastify API (127.0.0.1:3001)
  │  selected fictional signer, raw-byte evidence hashing, receipt-confirmed writes
  ▼
Anvil (127.0.0.1:8545, chain 31337)
  ├── MockUSD (6 decimals; valueless demo currency)
  ├── DemoInvestorEligibilityRegistry
  ├── DemoPermissionedBondToken (0 decimals; cap 10)
  ├── BondOffering (10 units × 100 MockUSD)
  ├── GreenTreasury (policy and atomic disbursement enforcement)
  └── BondServicingVault (separate funding, maturity, burn and repayment)
```

Startup deploys and verifies six deterministic contracts, but deliberately leaves the offering in
`Draft`, bond supply at zero, both financial vaults empty and no project registered. The issuer is
seeded with a separate 1,050 MockUSD servicing allocation. The browser-facing API signs with the
selected unlocked local fixture account and waits for mined receipts.

## Frontend role access

The active presenter actor determines which role-specific workspace links appear in the sidebar.
One centralized route policy is used by both the navigation filter and the route guard, preventing
the two behaviours from drifting apart:

| Route | Allowed role |
|---|---|
| `/issuer/offerings` | Issuer |
| `/issuer/treasury` | Issuer |
| `/verifier` | Verifier |
| `/investor` | Investor |
| `/admin` | Platform Admin |

After the API confirms an actor change, the frontend uses the centralized role-workspace mapping
to replace the current location with the new role's default page: Offering, Verifier desk,
Investor view, Administration, or Use of proceeds for Vendor. This avoids interrupting the
presentation with an access warning during normal role switching.

`/demo`, `/impact`, and transaction receipt views are shared presentation/audit surfaces. A direct
visit to a restricted route renders a role-specific access message rather than the protected page,
with links to the active role's workspace and Home. The vendor's workspace is the shared Use
of proceeds view.

The role switcher and route guard support the single-presenter local demonstration; they are not
authentication or a production authorization boundary. API actor checks and on-chain contract
roles remain authoritative, and no API or contract permission is inferred from sidebar visibility.

## Contract and authority boundaries

| Contract | Authority and canonical state |
|---|---|
| `MockUSD` | `FAUCET_ROLE`; six-decimal demo balances and total supply. |
| `DemoInvestorEligibilityRegistry` | `REGISTRAR_ROLE`; fictional active/expiry eligibility. |
| `DemoPermissionedBondToken` | `PAUSER_ROLE`; restricted recipients and 10-unit cap. `MINTER_ROLE` belongs only to `BondOffering`; `BURNER_ROLE` and `LIFECYCLE_ROLE` belong only to `BondServicingVault`. The corresponding isolated administration roles are relinquished after handoff. |
| `BondOffering` | `ISSUER_ROLE` opens the fixed offering. Eligible investors pay exactly 100 MockUSD per unit directly to `GreenTreasury`; payment and mint are one transaction. |
| `GreenTreasury` | Issuer proposes policy and requests payment; verifier activates policy and executes `approveAndRelease`; admin may only pause/unpause unless separately granted another role. |
| `BondServicingVault` | Issuer alone funds up to exactly 1,050 MockUSD. Admin finalizes local maturity after full issuance. Eligible holders make one atomic claim that burns units and pays 100 principal + 5 coupon per unit. |

The offering uses `IBondTokenAdapter`, preserving a migration boundary from the explicitly labelled
demo compliance token to a future audited T-REX implementation. The treasury has no withdrawal or
token-approval method. Its only outbound token path is a successful `approveAndRelease` to the
vendor fixed by an active policy and immutable request.

The servicing vault has no route to the green treasury and no arbitrary withdrawal. Funding uses
the issuer's independent seeded balance. Finalization freezes holder-to-holder transfers
irreversibly while retaining only vault-authorized burns. Claim state is written before the
SafeERC20 payment under a reentrancy guard, so a failed payment rolls back both burn and accounting.

## Treasury state model

```text
Project: None → Proposed (issuer) → Active (independent verifier)

Milestone request:
  None → Pending (issuer; no funds move)
       → Paid (verifier approval and vendor transfer in one transaction)
       → Rejected (verifier; no funds move)
       → Cancelled (original issuer requester; no funds move)
```

Approved policy is immutable in Phase 2. A duplicate project ID is rejected; there is no hidden
administrator amendment or change-order path. Future policy amendments require an explicitly
designed, separately authorized versioning workflow rather than silently modifying committed state.

`approveAndRelease` rechecks active policy, vendor, milestone membership and completion, milestone
cap, project cap, request status, treasury balance and pause state. It updates accounting before the
SafeERC20 transfer and is non-reentrant; a failed transfer reverts the state changes atomically.

## Financial invariants

```text
totalRaised = unitsSold × 100 × 10^6
bond totalSupply = unitsSold ≤ 10
totalRaised = treasury MockUSD balance + GreenTreasury.totalReleased
project.spent ≤ project.budget
milestone.spent ≤ milestone.maxAmount
UnknownVendor received = 0
```

The main scenario ends with bond supply 10 (Alice 6, Bob 4), 1,000 MockUSD raised, 300 released to
SolarSupply, treasury balance 700 and PROJECT-001 remaining budget 500.

## Servicing state model and invariants

```text
Servicing: Unfunded → Funded exactly 1,050 → Maturity finalized / transfers frozen
Investor:  Holding units → claim principal + coupon atomically → units burned / claim consumed

servicing funded = 1,000 principal + 50 coupon
Alice = 6 × (100 + 5) = 630
Bob   = 4 × (100 + 5) = 420
principal paid + coupon paid + vault balance = total funded
units redeemed + bond totalSupply = 10
green treasury balance remains 700 throughout servicing
```

Local maturity advancement is exposed only to the selected admin and calls Anvil's time-control
RPC before the admin-signed `finalizeMaturity` transaction. It is explicitly a local simulation,
not a production clock or oracle design.

## Phase 4 application surfaces

- `packages/shared/src/abi.ts` exports human-readable ABI functions, events and business errors.
- `packages/shared/src/constants.ts` owns deterministic Phase 4 addresses and canonical actors.
- Full compiler ABIs remain in `packages/contracts/out`.
- The contracts emit subscription, policy, request, verifier, rejection/cancellation and release
  events with indexed identifiers; the API queries these events and re-queries canonical state.
- The API controls unlocked deterministic signers only on localhost, awaits receipts, and keeps
  reverted attempts visually and semantically separate from successful events.
- Evidence bytes and rejected-attempt metadata are resettable process-memory state. Only the
  SHA-256 digest is committed to the treasury request; metadata cannot authorize or move funds.
  Each evidence record is tagged to M1 or M2, and the API rejects cross-milestone evidence reuse.
- The packaged M1 fictional sample is sourced from `apps/web/public/assets`, loaded as exact bytes
  by the API, and returned with inline PDF headers through its evidence URL. Vite copies the same
  source file into `dist`, avoiding reliance on generated build output as an input.
- Milestone selection flows from the issuer UI through the API to the contract's milestone and
  request identifiers. The dashboard reads both request slots, and the verifier approves or rejects
  the explicitly selected request; M1 remains the default presentation path.
- The dashboard re-queries servicing funding, vault balance, maturity, freeze, paid principal,
  paid coupon, units redeemed and actor entitlement from chain state. Post-burn entitlement is
  retained from the vault's claimed-unit record for transparent repayment history.

## Canonical local endpoints

| Service | Endpoint | Authority |
|---|---|---|
| Web | `http://127.0.0.1:5173` | Presentation and user intent only |
| API | `http://127.0.0.1:3001` | Actor-scoped reads/writes, evidence metadata, receipts, and reset |
| Anvil | `http://127.0.0.1:8545` | Canonical assets, roles, subscriptions, policy, disbursement and servicing state |
