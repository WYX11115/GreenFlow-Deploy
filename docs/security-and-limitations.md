# Security and limitations

## Phase 4 controls

- API, web server, and RPC bind to loopback only.
- The standard Anvil mnemonic is a public test fixture and must never hold real assets.
- Anvil starts silently so fixture private keys are not printed in routine logs.
- API responses and the frontend expose public fixture addresses only.
- Health checks the real RPC, expected chain ID, and deployed bytecode at all six Phase 4 addresses.
- MockUSD minting, eligibility updates/revocation, bond minting and pause actions use OpenZeppelin AccessControl roles.
- Bond mint/transfer receipt is rejected on-chain when the recipient is inactive or expired.
- Bond supply is capped at 10 whole units; MockUSD and bond accounting use integer subunits.
- `BondOffering` uses `SafeERC20` and `ReentrancyGuard`; payment to `GreenTreasury` and bond minting are atomic.
- Only the deployed offering holds the bond `MINTER_ROLE`. Its separate self-administered mint-authority role is emptied after handoff, preventing default admin from granting another minter.
- Issuer and verifier are distinct roles. Issuer proposals cannot authorize spending, and admin receives no verifier role.
- Approved project policy is immutable in Phase 2. There is no unrestricted withdrawal, arbitrary approval or policy-amendment route.
- `approveAndRelease` rechecks vendor, milestone, project and budget state, marks paid before interaction, and transfers with `SafeERC20` under a reentrancy guard.
- Pause blocks disbursement; only `ADMIN_ROLE` may pause or unpause. Completed payments remain recorded.
- Financial API actions sign only as the selected registered fixture actor and wait for a successful
  receipt before the UI reports success. Caller-supplied signing addresses and transaction targets
  are not accepted.
- Evidence accepts only PDF/PNG/JPEG up to 5 MB and hashes exact bytes with SHA-256. Evidence and
  reset routes are role-gated at the API boundary; all financial authorization remains on-chain.
- Reverted transaction hashes are stored only as rejected attempts and never enter the successful
  event ledger or financial totals.
- Servicing has no treasury withdrawal path. Only the issuer can fund the fixed 1,050 MockUSD requirement, and the vault cannot accept overfunding.
- Only the servicing vault can burn bonds or finalize the irreversible transfer freeze; temporary burner/lifecycle administration roles are relinquished after deployment.
- Maturity requires full 10-unit issuance and local-chain time. A claim checks eligibility, record-date finalization, holdings, funding, and prior-claim state, then burns and pays atomically under a reentrancy guard.

## Explicit limitations

- Actor switching is not authentication. The backend controls local test signers for presentation convenience.
- No KYC occurs. Seeded eligibility is a fictional on-chain flag with illustrative attributes.
- No ERC-3643 or ONCHAINID claim is made. The official stack was tested separately but not integrated; see `ERC3643_FEASIBILITY.md`.
- No green impact is measured. The verifier attests to fictional off-chain evidence; hashes prove byte integrity, not truth.
- Evidence bytes and rejected attempts are process-memory fixtures and disappear on API restart or
  full in-app reset; this is not a durable document archive or audit database.
- Policy supports one vendor per project and one completed payment per milestone. Partial-payment change orders and approved-policy amendments are deliberately unsupported.
- The deployment admin retains default role-administration authority and could grant roles in this local teaching system. Production governance, multisig, timelocks and separation-of-duty monitoring require an audit and separate design.
- MockUSD is a conventional ERC-20 fixture. Fee-on-transfer, rebasing or malicious payment tokens are outside this fixed-deployment model.
- MockUSD will have no reserves or monetary value.
- Local execution does not prove public Polygon deployment, production security, legal issuance, custody, privacy, or regulatory compliance.
- Tokenisation does not eliminate issuer credit risk or guarantee coupon/principal funding.
- The API's maturity time advance uses Anvil-only JSON-RPC and is an explicit presentation simulation, not a production oracle or administrator power.
- Record-date transfer freeze is irreversible in this fixed teaching lifecycle. Production transfer, default, dispute, and recovery rules require separate legal and audited design.

