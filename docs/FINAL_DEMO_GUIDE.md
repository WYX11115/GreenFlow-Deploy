# GreenFlow final demo guide

This is a 5–7 minute classroom investor-pitch walkthrough. Everything is fictional and runs on local Anvil chain `31337` with valueless MockUSD. The presenter role switcher controls deterministic development accounts; it is not authentication. When the role changes, the application opens that role's default page and the sidebar shows only that role's workspaces plus the shared **Home** and **Use of proceeds** views.

## Start

From the repository root:

```bash
pnpm install
pnpm demo:start
```

Wait for `GreenFlow final MVP is ready`, then open <http://127.0.0.1:5173>. The application starts on **Home** with **Issuer** selected. No terminal action is required during the presentation. The `/demo` route shows the next presenter move as chain state changes.

Role defaults are Issuer → **Offering**, Verifier → **Verifier desk**, Investor → **Investor
view**, Platform Admin → **Administration**, and Vendor → **Use of proceeds**. Switching roles does
not reset chain state.

## 5–7 minute sequence

| Time | Role · page | Click and expected result | Talking point |
|---:|---|---|---|
| 0:00 | **Issuer** · **Home** | Confirm the yellow demo disclosure and green chain badge. | “This is a deterministic local-chain teaching demo using mock funds and fictional identities.” |
| 0:20 | **Issuer** · **Offering** | **Open offering on chain**. | The issuer opens fixed terms: 10 whole units at 100 MockUSD each. |
| 0:40 | **Alice** · **Investor view** | Confirm the prefilled **6** units and click **Subscribe**. Alice shows 6 GSGB and 400 MockUSD. | Payment reaches the ring-fenced treasury and bond minting occurs atomically. |
| 1:00 | **Charlie** · **Investor view** | Confirm the prefilled **1** unit and click **Subscribe**. Only the result turns red and says eligibility rejected it; Charlie remains at 0 units. | The simplified demo compliance registry prevents ineligible ownership on-chain. It is not genuine KYC or ERC-3643. |
| 1:20 | **Bob** · **Investor view** | Confirm the prefilled **4** units and click **Subscribe**. Offering becomes full; treasury reaches 1,000. | Alice 6 + Bob 4 reconciles exactly to the 10-unit cap. |
| 1:40 | **Issuer** · **Treasury** | **Propose policy on chain**. Under **Payment safeguards**, expand **Demonstrate a blocked request**, keep **Payment before policy approval** selected, then click **Run safeguard test**. The transaction reverts. | This is the central separation of duties: the issuer proposes but cannot activate its own spending policy. |
| 2:10 | **Verifier** · **Verifier desk** | **Approve project policy**. PROJECT-001 becomes Active with an 800 budget, SolarSupply, M1 300 and M2 500. | An independent verifier activates the project, vendor, milestone and budget constraints. |
| 2:40 | **Issuer** · **Treasury** | **Use fictional sample**. In the optional safeguard demonstration, select **Payment to an unapproved vendor** and click **Run safeguard test**. Optionally repeat with **Payment above the selected milestone limit**. Both are rejected without payment. | “GreenFlow prevents an invalid payment before funds leave—not merely in a later report.” The evidence digest proves byte integrity, not physical truth. |
| 3:20 | **Issuer** · **Treasury** | **Request 300 MockUSD for M1**. Status becomes Pending Verification; funds have not moved. | Submission records the approved vendor, amount, milestone and SHA-256 evidence digest. |
| 3:45 | **Verifier** · **Verifier desk** | Inspect the evidence link and digest, then **Approve & release atomically**. Status becomes Paid. | One verifier transaction rechecks every rule and transfers 300 to SolarSupply atomically. |
| 4:25 | **Alice** · **Use of proceeds** | Show treasury 700, vendor payment 300, project remaining 500, events and receipt links. | Investors see chain-derived balances and a transaction-level audit trail. Rejected attempts are not successful payment events. |
| 4:55 | **Issuer** · **Offering** | **Fund servicing vault**. Vault reaches 1,050 while green treasury remains 700. | Debt service comes from a separate issuer-funded pot; residual green proceeds are never swept into repayment. |
| 5:15 | **Admin** · **Administration** | **Advance to maturity & finalize**. | This is explicit Anvil time simulation. It freezes transfers for a stable record date; it is not a production oracle. |
| 5:35 | **Alice**, then **Bob** · **Investor view** | Each clicks **Claim maturity payment**. Alice receives 630 and retires 6 units; Bob receives 420 and retires 4. | Each combined claim burns the bonds and atomically pays principal plus 5% coupon. Double claims are blocked. |
| 6:10 | Any · **Use of proceeds** | Show treasury 700, servicing funded 1,050, principal paid 1,000, coupon paid 50, vault 0 and 10/10 units retired. | Two ledgers reconcile independently. Tokenisation enforces the workflow but does not remove issuer credit risk. |

Core line: **“GreenFlow checks the approved project, vendor, milestone and budget before green-bond proceeds leave the treasury, then makes the result auditable.”**

## Reset

1. Select **Platform Admin**.
2. Open **Administration**.
3. Click **Reset six-contract demo** and wait for the green completion message.
4. The application selects **Issuer** and returns to **Home** automatically. The guide should say **Open the offering**, with Draft offering, 0/10 units, treasury 0 and servicing vault 0.

The in-app reset clears both blockchain state and temporary evidence/rejected-attempt metadata. `pnpm demo:reset` is the terminal fallback, but the presenter should not need it after startup.

## Troubleshooting

- **Chain unavailable:** stop the old process with `Ctrl+C`, check ports `5173`, `3001` and `8545`, then rerun `pnpm demo:start`.
- **Wrong button is disabled:** select the role named by Home’s next-move card and complete the preceding step.
- **A workspace tab is missing:** this is expected when the selected role does not own that workspace; switch to the role named in the sequence.
- **A role-specific access message appears after manually opening a restricted URL:** switch to the owning role or return to Home.
- **A transaction is waiting:** allow the local receipt to finish; do not click repeatedly.
- **Unexpected state:** use the in-app admin reset and restart the sequence.
- **`pnpm` launcher missing:** run `corepack prepare pnpm@12.15.0 --activate`, then retry.
- **No live browser available:** use the ordered screenshots in `docs/screenshots/` as the presentation backup.

## Truthful boundaries

- Local Anvil, not Polygon or a public deployment.
- MockUSD, not cash or a reserved stablecoin.
- Demo eligibility flags, not KYC, ONCHAINID or ERC-3643 compliance.
- Independent off-chain attestation, not autonomous environmental-impact proof.
- Fictional actors, organisations, approvals and documents.
- Presentation signers and local time controls are development fixtures only.
