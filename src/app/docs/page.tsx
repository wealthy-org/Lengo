import s from "../app/trade.module.css";
import d from "./docs.module.css";
import { DEPLOYMENTS, MAINNET_LENGO_TOKEN, addrUrl } from "@/lib/chain";
import { MAINNET_MARKETS } from "@/lib/markets";

const toc = [
  ["start", "Getting started"],
  ["formulas", "Risk math & formulas"],
  ["params", "Market parameters"],
  ["contracts", "Contracts & proofs"],
  ["routes", "Cross-chain routes"],
  ["limits", "Security & disclosures"],
  ["roadmap", "Roadmap"],
];

const coreParams: [string, string, string][] = [
  ["Debt Asset", "USDG (6 dec)", "$1.00 fixed peg · Robinhood Chain"],
  ["Max Borrow LTV", "50% – 80%", "60% WETH · 65% BTC · 50–55% RWA"],
  ["Liq. Threshold", "65% – 88%", "75% WETH · 78% BTC · 65–70% RWA"],
  ["Liquidation Trigger", "HF < 1.00", "50% max close factor · 5% bonus"],
  ["Borrow APR", "6.5% – 9.0%", "Fixed rate · per-second RAY index"],
  ["Supply Cap", "50,000 USDG", "Per isolated market beta cap"],
  ["Price Oracle", "ChainlinkOracle", "Official Chainlink feeds + heartbeat"],
  ["Exit Guarantee", "Always Open", "Repay & withdraw never pause"],
];

const CHAINLINK_ETH_USD = "0x78F3556b67E17Df817D51Ef5a990cDaF09E8d3A9";

const shortAddr = (v?: string) => (v && v.length > 14 ? `${v.slice(0, 8)}…${v.slice(-6)}` : v ?? "—");

export default function Docs() {
  const mainnetAddrs: [string, string | undefined][] = [
    ...MAINNET_MARKETS.map((m) => [`LengoMarket · ${m.pair}`, m.market] as [string, string | undefined]),
    ["ChainlinkOracle · Adapter", DEPLOYMENTS.mainnet.oracle],
    ["Chainlink · ETH/USD Proxy", CHAINLINK_ETH_USD],
    ["USDG · Debt Token (6 dec)", DEPLOYMENTS.mainnet.debtAsset],
    ["$LENGO · Utility Token (18 dec)", MAINNET_LENGO_TOKEN],
    ["HarmonicRiskFeed · Session Oracle", "0xd91e56a9999974a1319150cd6fa00bc87cc2d91d"],
  ];

  const testnetAddrs: [string, string | undefined][] = [
    ["LengoMarket (Testnet · 46630)", DEPLOYMENTS.testnet.market],
    ["DemoOracle (Testnet · 46630)", DEPLOYMENTS.testnet.oracle],
    ["tBTC Collateral (8 dec)", DEPLOYMENTS.testnet.collateral],
    ["tUSDC Debt (6 dec)", DEPLOYMENTS.testnet.debtAsset],
  ];

  return (
    <>
      <div className={s.pageHead}>
        <div>
          <h1>Documentation</h1>
          <p>Protocol architecture, risk math, verified Robinhood Chain Mainnet (4663) contracts, onchain proofs, and security disclosures.</p>
        </div>
        <span>Mainnet Beta · Robinhood Chain · 4663</span>
      </div>

      <div className={d.wrap}>
        <aside className={d.tocWrap}>
          <nav className={d.toc}>
            {toc.map(([id, t], i) => (
              <a key={id} href={`#${id}`}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                {t}
              </a>
            ))}
          </nav>
          <div className={d.tocMeta}>
            <span>Verification Status</span>
            <b>● 7 Markets Seeded &amp; Live</b>
            <p>
              Bytecode verified (<code>exact_match</code>) on Sourcify &amp; Blockscout. Covered by an independent security review by HEY Research Lab.
            </p>
          </div>
        </aside>

        <article className={d.body}>
          {/* 01 · GETTING STARTED */}
          <section id="start">
            <div className={d.secHead}>
              <h2>01 · Getting started on Mainnet</h2>
              <span className={d.secTag}>Robinhood Chain (4663) + NEAR Intents 1Click</span>
            </div>
            <div className={d.stepsGrid}>
              <div className={d.stepCard}>
                <i>Step 01 · Connect</i>
                <b>Switch to RH 4663</b>
                <p>Connect any EVM wallet. Lengo automatically configures and switches to Robinhood Chain Mainnet (`4663`).</p>
              </div>
              <div className={d.stepCard}>
                <i>Step 02 · Collateral</i>
                <b>Deposit or Bridge In</b>
                <p>
                  Deposit `WETH`, `cbBTC`, `WBTC`, `USDe`, or RWA equities (`NVDA`, `TSLA`, `AAPL`) on <a href="/app">Markets</a>, or route from external chains via <a href="/app/routes?preset=collateral&mode=live">Routes</a>.
                </p>
              </div>
              <div className={d.stepCard}>
                <i>Step 03 · Borrow &amp; Lend</i>
                <b>Supply or Borrow USDG</b>
                <p>Supply `USDG` to earn borrower interest, or borrow `USDG` against locked collateral within each market&apos;s Max LTV.</p>
              </div>
              <div className={d.stepCard}>
                <i>Step 04 · Monitor</i>
                <b>Track Position Health</b>
                <p>
                  Inspect real-time Health Factor, Liquidation Price, oracle age, Harmonic stock session status, and price-shock simulations on <a href="/app/positions">Positions</a>.
                </p>
              </div>
              <div className={d.stepCard}>
                <i>Step 05 · Route &amp; Repay</i>
                <b>14+ Chain Settlement</b>
                <p>
                  Route borrowed `USDG` into `USDC`, `USDT`, or `DAI` across 14+ networks — or repay `USDG` debt from any chain — in <a href="/app/routes">Routes</a>.
                </p>
              </div>
            </div>
          </section>

          {/* 02 · FORMULAS */}
          <section id="formulas">
            <div className={d.secHead}>
              <h2>02 · Risk math &amp; formulas</h2>
              <span className={d.secTag}>Deterministic RAY (1e27) accounting</span>
            </div>
            <div className={d.split2}>
              <pre>{`C = collateral value in USD (Chainlink price × collateral quantity)
D = USDG debt incl. accrued interest (debtShares × borrowIndex / 1e27)

LTV                     = D / C
Health Factor (HF)      = (C × liquidationThreshold) / D
Remaining Borrow Room   = max(0, C × maxBorrowLTV − D)
Est. Liquidation Price  = D / (collateralQuantity × liquidationThreshold)`}</pre>
              <div className={d.infoCard}>
                <div>
                  <b>Accounting &amp; Rounding Guarantees</b>
                  <p style={{ marginTop: 6 }}>
                    When <code>D = 0</code>, Health Factor displays <b>No debt</b> (never <code>NaN</code>). Calling <b>Repay All</b> passes <code>type(uint256).max</code>, burning all borrower debt shares to exact zero with no residual dust. Virtual shares (<code>1e6</code> shares / <code>1</code> asset) prevent first-depositor inflation attacks.
                  </p>
                </div>
                <div className={d.ex}>
                  <b>Worked Example:</b> 2 WETH at $1,700 ($3,400 collateral) with 1,360 USDG debt in a 60% LTV / 75% LT market → <b>LTV 40.0%</b>, <b>HF 1.875</b>, <b>Liquidation Price $906.67</b>.
                </div>
              </div>
            </div>
          </section>

          {/* 03 · PARAMETERS */}
          <section id="params">
            <div className={d.secHead}>
              <h2>03 · Mainnet parameters &amp; market specs</h2>
              <span className={d.secTag}>7 Isolated Crypto &amp; RWA Equity Pools</span>
            </div>
            <div className={d.paramGrid}>
              {coreParams.map(([k, v, sub]) => (
                <div key={k} className={d.paramCell}>
                  <span>{k}</span>
                  <b>{v}</b>
                  <small>{sub}</small>
                </div>
              ))}
            </div>

            <div className={d.subHead}>Per-Market Onchain Configuration (All 7 Seeded &amp; Verified Mainnet Pools)</div>
            <div className={d.mktTableWrap}>
              <table className={d.mktTable}>
                <thead>
                  <tr>
                    <th>Market Pair</th>
                    <th>Category</th>
                    <th>Chainlink Feed</th>
                    <th>Max Age</th>
                    <th>Max LTV</th>
                    <th>Liq. Threshold</th>
                    <th>Borrow APR</th>
                    <th>Collateral Cap</th>
                    <th>Supply Cap</th>
                    <th>ERC-8056 Multiplier</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {MAINNET_MARKETS.map((m) => (
                    <tr key={m.id}>
                      <td><b>{m.pair}</b></td>
                      <td>{m.category}</td>
                      <td>{m.feedLabel ?? m.collSymbol}</td>
                      <td>{m.maxOracleAge.toLocaleString("en-US")}s</td>
                      <td>{Math.round(m.maxLtv * 100)}%</td>
                      <td>{Math.round(m.liqThreshold * 100)}%</td>
                      <td>{(m.apr * 100).toFixed(1)}%</td>
                      <td>{m.collateralCapLabel ?? "—"}</td>
                      <td>{m.supplyCapLabel ?? "50,000 USDG"}</td>
                      <td>{m.uiMultiplier ?? "1.000000 (ERC-20)"}</td>
                      <td><span className={d.badgeLive}>● Seeded · Live</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 04 · CONTRACTS & PROOFS */}
          <section id="contracts">
            <div className={d.secHead}>
              <h2>04 · Deployed contracts &amp; live proofs</h2>
              <span className={d.secTag}>Sourcify Exact Match · Chain ID 4663</span>
            </div>

            <div className={d.addrGrid}>
              {mainnetAddrs.map(([k, v]) => (
                <div key={k} className={d.addrRow}>
                  <span>{k}</span>
                  <b>
                    {v ? (
                      <a href={addrUrl(v, "mainnet")} target="_blank" rel="noreferrer" title={v}>
                        {shortAddr(v)} ↗
                      </a>
                    ) : (
                      "—"
                    )}
                  </b>
                </div>
              ))}
            </div>

            <div className={d.subHead}>Verified Mainnet Transaction Proofs (Robinhood Chain 4663, Solana &amp; Base)</div>
            <div className={d.proofCols}>
              {/* Column 1: Core Lending & Cross-Chain Repay */}
              <div className={d.proofCard}>
                <div className={d.proofHead}>
                  <span>Lending &amp; Repay Lifecycle</span>
                  <em>Chain 4663</em>
                </div>
                <div className={d.proofItem}>
                  <span>Supply USDG (WETH Pool)</span>
                  <b><a href="https://robinhoodchain.blockscout.com/tx/0x04887e2dd03391090f3f90eb170bba562955d76122e24bdafb2fbf73f715f0d7" target="_blank" rel="noreferrer">0x04887e…f0d7 ↗</a></b>
                </div>
                <div className={d.proofItem}>
                  <span>Deposit WETH Collateral</span>
                  <b><a href="https://robinhoodchain.blockscout.com/tx/0x4ff7f8d8c6c72ede29a11b76ffddca948c662f57d4eb220a8e34654fde9d6b98" target="_blank" rel="noreferrer">0x4ff7f8…6b98 ↗</a></b>
                </div>
                <div className={d.proofItem}>
                  <span>Borrow USDG</span>
                  <b><a href="https://robinhoodchain.blockscout.com/tx/0x57356f96ef1e9bebc9345de9530628c919faf2f9348c082f83b62cb240435f4d" target="_blank" rel="noreferrer">0x57356f…5f4d ↗</a></b>
                </div>
                <div className={d.proofItem}>
                  <span>Repay Full USDG Debt (#1)</span>
                  <b><a href="https://robinhoodchain.blockscout.com/tx/0xabdb082cf3c0fd5fd1875f616b0b4fa3b71bd7f3ac811157edffd4ad32725bcb" target="_blank" rel="noreferrer">0xabdb08…5bcb ↗</a></b>
                </div>
                <div className={d.proofItem}>
                  <span>Cross-Chain Repay All (#2)</span>
                  <b><a href="https://robinhoodchain.blockscout.com/tx/0x88a0e4bfdfa2b444d205b3f8b125afab714346d86a864451e5a36aa8e55844c8" target="_blank" rel="noreferrer">0x88a0e4…44c8 ↗</a></b>
                </div>
                <div className={d.proofItem}>
                  <span>Post-Repay Collateral Exit</span>
                  <b><a href="https://robinhoodchain.blockscout.com/tx/0x563d35bd6f8dbb8e56c1029e04dda04f164b2ba1bdd893e216d22195b6aab41f" target="_blank" rel="noreferrer">0x563d35…b41f ↗</a></b>
                </div>
                <div className={d.proofItem}>
                  <span>Cross-Chain Pool Supply #1 (0.25 USDG)</span>
                  <b><a href="https://robinhoodchain.blockscout.com/tx/0xcf2e76b91b2d4cc024616ce3accaecba8743ccc4ef022aff40c9639ec4e25c85" target="_blank" rel="noreferrer">0xcf2e76…5c85 ↗</a></b>
                </div>
                <div className={d.proofItem}>
                  <span>Cross-Chain Pool Supply #2 (0.13 USDG)</span>
                  <b><a href="https://robinhoodchain.blockscout.com/tx/0x970c967609fa3983467ebd3e781126dee2dadfa380151f266d219227a931a046" target="_blank" rel="noreferrer">0x970c96…a046 ↗</a></b>
                </div>
              </div>

              {/* Column 2: 1Click Cross-Chain Payouts */}
              <div className={d.proofCard}>
                <div className={d.proofHead}>
                  <span>1Click Cross-Chain Payouts</span>
                  <em>5 Chains · USDC &amp; USDT</em>
                </div>
                <div className={d.proofItem}>
                  <span>Solana USDC Payout (1.00 USDG)</span>
                  <b><a href="https://solscan.io/tx/PWUk1xC3DdzyGvPZu9rVviDkj1EpNapzftXxjWPWwpfdFf6PyRMAWkmZqWbp8oCgk4jhuJFDgqz8pRzZV77RUwV" target="_blank" rel="noreferrer">PWUk1xC3…7RUwV ↗</a></b>
                </div>
                <div className={d.proofItem}>
                  <span>Base USDC Payout (0.30 USDG)</span>
                  <b><a href="https://basescan.org/tx/0x7e4f2eb4a67b2e083993793c4154ce34a23781d6f03e1b866b5e3e78b4c2cd0d" target="_blank" rel="noreferrer">0x7e4f2e…cd0d ↗</a></b>
                </div>
                <div className={d.proofItem}>
                  <span>Arbitrum USDC Payout (0.15 USDG)</span>
                  <b><a href="https://arbiscan.io/tx/0xab62778d215835734109129fde86f2dc9f0e2ce43259cddd27f320ab175a5ba9" target="_blank" rel="noreferrer">0xab6277…5ba9 ↗</a></b>
                </div>
                <div className={d.proofItem}>
                  <span>BNB Chain USDT Payout (0.15 USDG)</span>
                  <b><a href="https://bscscan.com/tx/0xb13b8b8d07fa0e4b8c294b184d4bea4771aec0b28025d9be781d385f85b299d6" target="_blank" rel="noreferrer">0xb13b8b…99d6 ↗</a></b>
                </div>
                <div className={d.proofItem}>
                  <span>Polygon USDC Payout (0.15 USDG)</span>
                  <b><a href="https://polygonscan.com/tx/0x1c58e043f21d7e69a29b0e9342d93b7875166d1aa97b5659e7e13f1d7e7cf782" target="_blank" rel="noreferrer">0x1c58e0…f782 ↗</a></b>
                </div>
                <div className={d.proofItem}>
                  <span>NEAR Intents Explorer (All 5 Routes)</span>
                  <b><a href="https://explorer.near-intents.org/transactions/0xD1c6F77F9c2E22A9B3Cf77972d7B2d20e926f669" target="_blank" rel="noreferrer">0xD1c6F7…f669 ↗</a></b>
                </div>
              </div>

              {/* Column 3: All 6 Additional Market Seeds */}
              <div className={d.proofCard}>
                <div className={d.proofHead}>
                  <span>Isolated Pool Seeding</span>
                  <em>RWA &amp; Crypto</em>
                </div>
                <div className={d.proofItem}>
                  <span>Seed RWA · NVDA/USDG</span>
                  <b><a href="https://robinhoodchain.blockscout.com/tx/0xef3a519afa18f8c11b68ff13348a11bbbffe3dd2255f83cdaa96d6befed58cfe" target="_blank" rel="noreferrer">0xef3a51…8cfe ↗</a></b>
                </div>
                <div className={d.proofItem}>
                  <span>Seed RWA · TSLA/USDG</span>
                  <b><a href="https://robinhoodchain.blockscout.com/tx/0x3ba93b6139f3be8c253c9b3a678bfaa2f084dbbb617bfa01980aeec24f24352b" target="_blank" rel="noreferrer">0x3ba93b…352b ↗</a></b>
                </div>
                <div className={d.proofItem}>
                  <span>Seed RWA · AAPL/USDG</span>
                  <b><a href="https://robinhoodchain.blockscout.com/tx/0xefce4d41320bf3d7175043d6dbfbe0720c7f18390bd3b36db2b08922bed05ec7" target="_blank" rel="noreferrer">0xefce4d…5ec7 ↗</a></b>
                </div>
                <div className={d.proofItem}>
                  <span>Seed Crypto · cbBTC/USDG</span>
                  <b><a href="https://robinhoodchain.blockscout.com/tx/0xdb808435bd3f9dac585e9658ba6c0cc331902b9e515f29a605e574de9853e0fa" target="_blank" rel="noreferrer">0xdb8084…e0fa ↗</a></b>
                </div>
                <div className={d.proofItem}>
                  <span>Seed Crypto · WBTC/USDG</span>
                  <b><a href="https://robinhoodchain.blockscout.com/tx/0x5d55c1ad35e0986b3e7db7b0e648f037823b0eac714faa3376af039f7cc1b81f" target="_blank" rel="noreferrer">0x5d55c1…b81f ↗</a></b>
                </div>
                <div className={d.proofItem}>
                  <span>Seed Stable · USDe/USDG</span>
                  <b><a href="https://robinhoodchain.blockscout.com/tx/0xb035a9c29b5ac2906007f2a05cf6822d3845de29e92e145d78d5f2db15748b63" target="_blank" rel="noreferrer">0xb035a9…8b63 ↗</a></b>
                </div>
              </div>
            </div>

            <div className={d.subHead} style={{ color: "var(--tx3)" }}>Testnet Sandbox — Robinhood Chain Testnet (46630)</div>
            <div className={d.addrGrid}>
              {testnetAddrs.map(([k, v]) => (
                <div key={k} className={d.addrRow}>
                  <span>{k}</span>
                  <b>{v ? <a href={addrUrl(v, "testnet")} target="_blank" rel="noreferrer" title={v}>{shortAddr(v)} ↗</a> : "—"}</b>
                </div>
              ))}
            </div>
          </section>

          {/* 05 · CROSS-CHAIN ROUTES */}
          <section id="routes">
            <div className={d.secHead}>
              <h2>05 · Cross-chain routes &amp; $LENGO utility</h2>
              <span className={d.secTag}>NEAR Intents 1Click · Live &amp; Preview</span>
            </div>
            <div className={d.cardGrid4}>
              <div className={d.docCard}>
                <div className={d.docCardHead}><b>Multi-Chain Payout</b><em>14+ Chains</em></div>
                <p>Convert borrowed <code>USDG</code> on Robinhood Chain into <code>USDC</code>, <code>USDT</code>, or <code>DAI</code> across Solana, Base, Arbitrum, Ethereum, Optimism, Polygon, BNB, Avalanche, TON, TRON, Sui, NEAR, Aptos &amp; Stellar.</p>
              </div>
              <div className={d.docCard}>
                <div className={d.docCardHead}><b>Cross-Chain Collateral</b><em>Inbound</em></div>
                <p>Route <code>SOL</code>, <code>USDC</code>, <code>USDT</code>, <code>ETH</code>, or <code>BTC</code> from external chains into <code>ETH/WETH</code> or <code>USDe</code> on Robinhood Chain and lock directly into <code>LengoMarket</code>.</p>
              </div>
              <div className={d.docCard}>
                <div className={d.docCardHead}><b>Any-Chain Repay</b><em>Full Cycle</em></div>
                <p>Settle outstanding <code>USDG</code> debt on Robinhood Chain using assets from any external network via 1Click, then immediately unlock and withdraw collateral.</p>
              </div>
              <div className={d.docCard}>
                <div className={d.docCardHead}><b>$LENGO Fee Tier</b><em>0% Fee</em></div>
                <p>Wallets holding ≥ 10,000 <a href={addrUrl(MAINNET_LENGO_TOKEN, "mainnet")} target="_blank" rel="noreferrer">$LENGO ↗</a> on Robinhood Chain automatically unlock the 0% 1Click App Routing Fee tier across all routes.</p>
              </div>
            </div>
          </section>

          {/* 06 · SECURITY & DISCLOSURES */}
          <section id="limits">
            <div className={d.secHead}>
              <h2>06 · Security review &amp; architecture disclosures</h2>
              <span className={d.secTag}>Independent Security Review by HEY Research Lab</span>
            </div>
            <div className={d.cardGrid2}>
              <div className={d.docCard}>
                <div className={d.docCardHead}><b>Independent Security Review</b><em>Not a Formal Audit</em></div>
                <p>
                  All 7 deployed <code>LengoMarket</code> contracts and <code>ChainlinkOracle</code> are <code>exact_match</code> verified on Sourcify &amp; Blockscout, tested against unit, fuzz, and 128,000-call stateful invariant suites, and covered by an <b>independent security review by HEY Research Lab</b>. TVL is bounded by per-market beta caps (e.g. 25 WETH / 50,000 USDG).
                </p>
              </div>
              <div className={d.docCard}>
                <div className={d.docCardHead}><b>Non-Custodial Exit Guarantee</b><em>Always Open</em></div>
                <p>
                  Even if the market guardian pauses new deposits or borrows, <code>repay</code>, debt-free <code>withdrawCollateral</code>, <code>withdrawSupply</code>, and <code>liquidate</code> remain permanently open. The guardian cannot move user funds, alter LTV/LT/APR parameters, or change a market&apos;s oracle address.
                </p>
              </div>
              <div className={d.docCard}>
                <div className={d.docCardHead}><b>Oracle &amp; Guardian Ownership</b><em>Ownable2Step</em></div>
                <p>
                  Each <code>LengoMarket</code> references <code>ChainlinkOracle</code> (<a href={addrUrl(DEPLOYMENTS.mainnet.oracle ?? "0xAc892397986B84ff42894739F05fE884D1D4c6da", "mainnet")} target="_blank" rel="noreferrer">0xAc89…c6da ↗</a>), which inherits <code>Ownable2Step</code>. Its owner (currently deployer/guardian <code>0x9178…7681</code> with EIP-7702 wallet delegation; <code>setGuardian</code> is single-step) can configure feeds via <code>setFeed</code> and <code>setFixedPeg</code> ($1.00 USDG). Transitioning ownership to a ≥ 48h timelock + multisig is tracked as priority hardening.
                </p>
              </div>
              <div className={d.docCard}>
                <div className={d.docCardHead}><b>Feed Heartbeats &amp; Market Sessions</b><em>Chainlink + Harmonic</em></div>
                <p>
                  <code>borrow</code>, <code>liquidate</code>, and leveraged <code>withdrawCollateral</code> require a fresh price reading. ETH/USD on Robinhood Chain operates on a 24h heartbeat + deviation trigger (aligning oracle <code>maxStaleness</code> &gt; 7,200 s keeps liquidations active during low-volatility windows). <code>NVDA</code> and <code>TSLA</code> use 24/7 feeds, while <code>AAPL</code> tracks US market hours. Lengo now supports live session status (<code>Open</code> / <code>Closed</code> / <code>Halted</code>) via the <a href="https://harmonicagent.solutions/api/keeper/session?tokens=NVDA,TSLA,AAPL" target="_blank" rel="noreferrer">Harmonic Agent Session Oracle ↗</a>.
                </p>
              </div>
              <div className={d.docCard}>
                <div className={d.docCardHead}><b>Fixed APR, Liquidity &amp; Rounding</b><em>RAY Accounting</em></div>
                <p>
                  Interest accrues at a fixed per-second RAY rate without a variable utilization kink; if 100% of supplied <code>USDG</code> is borrowed (0 idle cash), <code>withdrawSupply</code> waits for repayments or new supply. In v1.0, full-liquidation bad-debt write-off requires <code>collateral == 0</code> (leaving microscopic dust &lt; ~1.2×10<sup>7</sup> wei WETH or sub-unit 0-share partial repays to be addressed in v1.1 market deployments).
                </p>
              </div>
              <div className={d.docCard}>
                <div className={d.docCardHead}><b>ERC-8056 Equities, USDG Peg &amp; L2</b><em>Asset Controls</em></div>
                <p>
                  <code>USDG</code> is valued at a $1.00 fixed peg in <code>ChainlinkOracle</code>. Tokenized equities (<code>NVDA</code>, <code>TSLA</code>, <code>AAPL</code>) are issuer-upgradable ERC-8056 proxies exposing <code>uiMultiplier()</code> (<code>1.000775</code> NVDA, <code>1.001091</code> AAPL, <code>1.000000</code> TSLA) and issuer compliance controls; fee-on-transfer tokens are never listed. Robinhood Chain is an Arbitrum Orbit L2 with a single sequencer; UI charts use Pyth Pro while all onchain checks read Chainlink.
                </p>
              </div>
            </div>
          </section>

          {/* 07 · ROADMAP */}
          <section id="roadmap">
            <div className={d.secHead}>
              <h2>07 · Roadmap</h2>
              <span className={d.secTag}>Execution Milestones</span>
            </div>
            <div className={d.roadGrid}>
              {[
                ["Phase 1", "LIVE", "Isolated lending engine + Robinhood Chain Testnet sandbox (46630)"],
                ["Phase 2", "LIVE", "Robinhood Chain Mainnet (4663) + ChainlinkOracle + Position Health"],
                ["Phase 3", "LIVE", "NEAR Intents 1Click Cross-Chain Collateral, 14+ Chain Payout & Repay"],
                ["Phase 4", "LIVE", "7 isolated Crypto & RWA Stock markets seeded & live + Harmonic session status"],
                ["Phase 5", "RESEARCH", "48h Timelock + multisig oracle handoff & native BTC / ZEC locking"],
              ].map(([p, st, desc]) => (
                <div key={p} className={d.roadCard}>
                  <div className={d.roadTop}><span>{p}</span><em>{st}</em></div>
                  <p>{desc}</p>
                </div>
              ))}
            </div>
          </section>
        </article>
      </div>
    </>
  );
}
