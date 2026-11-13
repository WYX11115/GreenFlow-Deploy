# GreenFlow contracts

This is the Foundry workspace for the local GreenFlow EVM contracts. Phases 1–4 implement simulated payment/eligibility assets, atomic subscription, the programmable green treasury, and separately funded maturity servicing.

- `MockUSD`: six-decimal, role-gated, valueless demo currency.
- `DemoInvestorEligibilityRegistry`: fictional active/expiry eligibility controlled by `REGISTRAR_ROLE`.
- `DemoPermissionedBondToken`: zero-decimal, 10-unit capped token that rejects ineligible recipients.
- `IBondTokenAdapter`: stable interface for Phase 2 issuance and later official-suite substitution.
- `BondOffering`: fixed 10-unit offering at 100 MockUSD; payment and minting are atomic.
- `GreenTreasury`: issuer proposal, verifier policy activation, evidence-linked requests, and atomic verifier-approved vendor release.
- `BondServicingVault`: exact issuer funding, local maturity finalization, transfer freeze, combined principal/coupon payment, bond burn, and one-claim enforcement.
- `IServicingBondToken`: narrow vault adapter for authorized burn and lifecycle freeze operations.

This is **not ERC-3643 or genuine ONCHAINID/KYC**. Environmental verification is an off-chain verifier attestation rather than autonomous proof. Local time advancement is a presentation-only Anvil control.

```bash
pnpm contracts:build
pnpm contracts:test
pnpm chain:start                 # terminal 1
pnpm contracts:deploy:phase4    # terminal 2
pnpm contracts:verify:phase4
pnpm contracts:scenario:phase2  # mutates a clean deployment through the full scenario
```

