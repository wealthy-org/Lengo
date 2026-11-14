# M5 — Native BTC collateral: technical spike

**Status:** research only. Nothing in Lengo v0.1 accepts real BTC.
**Goal (brief §9):** user locks BTC on Bitcoin → Lengo can verify it → loan recorded on Robinhood Chain → payout (e.g. USDC on Solana). BTC must stay collateral; it must never be sold and still called BTC collateral.

## Key finding

The closest working reference, **Templar**, does not put lending on another chain. It keeps the lending contracts **on NEAR**. Native BTC sits in **NEAR Intents** (`intents.near`, custody described as Chain Signatures MPC) and shows up on NEAR as the NEP-245 token `btc.omft.near`. Markets such as `ibtc-iethusdc-1.v1.tmplr.near` and `izec-ixlmusdc.v1.tmplr.near` lend USDC against native BTC/ZEC this way.

For Lengo the lending engine must stay on **Robinhood Chain** (owner decision). The 1Click catalog on 2026-11-14 lists these RH (`hood`) assets: **USDG, PONS, CASHCAT, ETH, WETH, USDe**. It lists **no BTC representation on `hood`**. So the Templar pattern does not carry over directly. NEAR Intents can *route* BTC, but today nothing on RH can serve as verifiable BTC collateral.

> **Dependency:** a BTC claim token on RH whose backing and redemption Lengo can verify. Until that exists, keep shipping the tBTC testnet market.

Sources: docs.templarfi.org/guide/architecture.html, /guide/addresses.html (read 2026-11-14); live `GET /v0/tokens` from 1Click. Several points below are marked *to verify*, because the public pages don't cover them.

## Candidate designs

| | Design | Where BTC sits | Claim on RH | Main risk |
|---|---|---|---|---|
| A | **NEAR Intents BTC bridged to `hood` as an omft token** (if/when 1Click adds it) | NEAR Intents MPC custody | ERC-20 issued by the Intents bridge on RH | Trust in Intents MPC + bridge; redemption path and timing not documented publicly *(to verify)* |
| B | **Chain Signatures–controlled BTC vault per user**, with RH verifying deposits | A Bitcoin address whose key is NEAR MPC, derived per Lengo account | Lengo-minted receipt, minted only after a deposit proof | Needs a deposit proof the RH contract can trust (BTC light client or attested relayer). The release flow needs cross-chain messaging from RH to NEAR to sign the release. |
| C | **Existing wrapped BTC already on RH** (e.g. a cbBTC/WBTC-style asset, if deployed) | Wrapper issuer's custody | That ERC-20 | Not "native" BTC; it's custodial wrapper risk. Not present in the current catalog *(to verify on RH explorer)* |
| D | **Hybrid: collateral on NEAR, debt on RH** | Templar-style on NEAR | None; RH learns the position via messaging | Two-chain state; liquidation must act on NEAR but debt lives on RH, so the system isn't atomic |

**Recommendation:** go after **A** first. Ask NEAR Intents whether a BTC asset on `hood` is planned, and what its custody and redemption model would be. That path needs the fewest new trusted components from Lengo. Keep **B** as the fallback if Lengo must own custody logic. Reject **D** for v1, because a liquidation split across two chains is the riskiest part (brief §9 Q4–Q5).

## Answers to the brief's seven questions

1. **Where is BTC locked, and who can sign its release?** In A and B, on a Bitcoin address controlled by NEAR Chain Signatures MPC (Templar docs: 11-of-16 TEE operators, target 30, behind Intents transfers). The BTC-side release signing path is *not documented* on the pages read, and must be confirmed with NEAR Intents.
2. **How does the RH contract verify finality, owner, amount and lock?** In A, it trusts the bridge token's mint (the bridge attests). In B, it needs either a Bitcoin SPV/light-client contract on RH (expensive; none known on RH, *to verify*) or a quorum-attested relayer. In both cases, define a confirmation threshold (≥6 blocks proposed) and per-deposit idempotency keys.
3. **What claim exists on RH, who issues it, and how are backing and redemption verified?** In A, the Intents bridge issues an ERC-20 on RH; backing is proved through Intents balances, and redemption goes through Intents withdrawal *(timing not documented)*. In B, a Lengo receipt token is minted 1:1 per verified deposit and burned on release; backing is the sum of MPC-derived vault UTXOs, published as a proof-of-reserve.
4. **How do we prevent replay, double-credit, early release and liquidation/withdraw races?**
   - Key each deposit by `(btc_txid, vout)`.
   - Burn the receipt before requesting a release signature.
   - The release message must carry the RH position nonce and require `debt == 0` or a liquidation authorization.
   - A single state machine per position, with a lock while any release is pending.
5. **Who buys collateral in a liquidation, and do they wait for redemption?** In A, liquidators receive the RH BTC token immediately (like v0.1 tBTC) and can redeem through Intents later, so no wait is needed on RH. In B, liquidators receive the receipt token, and redemption waits for an MPC signature. We need backstop capital (a protocol-owned liquidator or vault) sized to the max per-market exposure. Third-party bots alone are not enough at launch.
6. **What happens when the source chain, signer, bridge, oracle or payout route is down?**
   - **Borrow is paused** on a stale oracle (already enforced).
   - **Repay and debt-free exit stay open** (already enforced).
   - **Releases queue** until the signer or bridge is available.
   - **Payout failure never forgives debt**; the funds stay retrievable, with the `delivered / refunded / recovery` states from brief §9.
7. **What exists and is audited, and what must be built?** Existing: NEAR Intents and Chain Signatures (operated by NEAR; audit status *to verify*) and Templar's NEAR markets (reference only). To build for A: a market listing for the RH BTC token, an oracle feed for it, and liquidation backstop ops. To build for B: a deposit verifier on RH, a cross-chain release flow from RH to NEAR, a receipt token and proof-of-reserve, plus a dedicated audit.

## Reproducible checks for the next step

- [ ] Query 1Click `/v0/tokens` weekly for a `blockchain: "hood"` BTC asset (script: `GET /api/routes/tokens` and filter by symbol).
- [ ] Confirm with NEAR Intents: custody model, redemption SLA, and whether `hood` BTC is on the roadmap.
- [ ] Check the RH explorer for any deployed wrapped-BTC ERC-20 and its issuer.
- [ ] If A becomes available: deploy a second isolated market with that token on testnet, rerun `forge test` + `e2e-fork.sh` with its decimals, and add the oracle feed to the keeper.
- [ ] ZEC: confirm whether the provider supports transparent or shielded addresses before assuming either (brief §9).

## What v0.1 already guarantees for this path

- One isolated market per collateral, so a BTC market can be added without touching tBTC.
- Collateral is never lender cash (enforced by invariant tests).
- Stale-oracle rules, the 50% close factor, bad-debt recognition and the Repay-All/exit paths are all already tested.
