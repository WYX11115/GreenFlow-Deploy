# ERC-3643 / ONCHAINID feasibility decision

**Decision date:** 26 October 2026  
**Phase:** 1  
**Decision:** Use GreenFlow's explicitly labelled demo eligibility fallback for the local MVP. Do not claim ERC-3643 or ONCHAINID compliance.

## Question assessed

Can the official ERC-3643/T-REX and ONCHAINID implementation be integrated into GreenFlow's deterministic Foundry/Solidity 0.8.24 presentation stack with sufficient reliability and proportionate complexity for the academic MVP?

## Reproducible official-suite spike

Source: [ERC-3643 official reference repository](https://github.com/ERC-3643/ERC-3643), shallow clone of commit `2f0704dee9658ad9cd5b6ed82e7427da74c28345` dated 28 August 2026. The repository identifies itself as `@erc3643org/erc-3643` version `4.1.3`.

Commands executed in a disposable directory:

```bash
git clone --depth 1 https://github.com/ERC-3643/ERC-3643.git /private/tmp/greenflow-erc3643-spike
cd /private/tmp/greenflow-erc3643-spike
npm ci
npm run build
npm test
```

Actual results:

- `npm ci`: succeeded; 990 packages installed. npm reported 75 dependency vulnerabilities: 17 low, 15 moderate, 39 high, and 4 critical. These are tool/dependency audit findings, not a finding that the deployed contracts themselves contain those vulnerabilities.
- `npm run build`: succeeded; 106 Solidity files compiled with Solidity 0.8.17 and 308 TypeChain typings generated.
- `npm test`: succeeded; **275 passing, 0 failing** in approximately 11 seconds after granting the test process permission to open its ephemeral local reporting port.
- Hardhat warned that the Node runtime selected in the disposable checkout was unsupported and emitted deprecated dependency warnings.
- The official tests exercised full suite and factory deployments, identity/claim registries, compliance, restricted transfers, recovery, freezing, and gateway controls.

## What genuine integration requires

The official stack is not a single token contract. Its tested topology includes:

- token implementation and proxy;
- Identity Registry and Identity Registry Storage;
- Claim Topics Registry;
- Trusted Issuers Registry;
- Modular Compliance and optional modules;
- ONCHAINID identity contracts;
- trusted claim issuer/key/signature lifecycle;
- implementation authority, factories, proxies, gateway, agents, freeze/recovery controls.

This matches the ERC-3643 requirement that a receiving wallet be registered and verified through its identity/claim infrastructure, with separate compliance checks. The production factory route is also access-controlled for approved association participants, so GreenFlow would have to self-deploy and own the complete stack locally rather than rely on the official deployed gateway.

## Integration findings

| Criterion | Finding |
|---|---|
| Technical executability | **Pass standalone.** The official repository compiles and its own local tests pass. |
| Existing stack compatibility | **Poor.** It uses Hardhat, Solidity 0.8.17, OpenZeppelin 4.x, ethers v5-era tooling and upgradeable proxies; GreenFlow deliberately uses Foundry, Solidity 0.8.24, OpenZeppelin 5.x and viem. |
| Dependency footprint | **Disproportionate.** The isolated install added 990 packages and a second contract toolchain. |
| Identity setup | **High complexity.** Each investor needs identity registration and, for meaningful verification, ONCHAINID keys/claims, claim topics and trusted issuers. |
| Presentation reliability | **Higher operational risk.** Many implementations, proxies, factories, roles and claim signatures must be deployed and seeded correctly before the core treasury story begins. |
| MVP requirement fit | **Excess scope.** Phase 1 needs deterministic fictional eligibility and hard transfer rejection, not production recovery, claim governance or association deployment access. |
| Migration path | **Preserved.** `IBondTokenAdapter` isolates the Phase 2 offering from the concrete demo token and can be implemented by a future audited T-REX integration. |

## Decision and rationale

The official suite is **technically runnable**, but adopting it inside this MVP is not sufficiently reliable or proportionate. It would introduce a second Solidity/compiler/deployment ecosystem, a large audited-but-aging JavaScript dependency graph, and extensive claim-governance setup before GreenFlow can demonstrate its differentiating programmable treasury.

Therefore Phase 1 uses:

- `DemoInvestorEligibilityRegistry`
- `DemoPermissionedBondToken`
- the `IBondTokenAdapter` business-facing interface

This fallback enforces eligibility, mint authority, transfer receipt restrictions, supply cap and pause state on-chain. It is labelled throughout the code, UI and documentation as a **demo compliance simulation — not ERC-3643 compliant and not genuine KYC**.

## Reconsideration trigger

Revisit official integration only for Phase 6 or a separately authorized spike when the project can allocate time for audited version selection, complete ONCHAINID claim governance, proxy/factory ownership, migration testing, dependency remediation, and regulated onboarding design. A passing upstream test suite alone is not evidence that GreenFlow has implemented those operational controls.

