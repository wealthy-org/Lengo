import s from "../app/trade.module.css";
import d from "./docs.module.css";
import { DEPLOYMENTS, MAINNET_LENGO_TOKEN, addrUrl } from "@/lib/chain";
import { MAINNET_MARKETS } from "@/lib/markets";

const toc = [
  ["start", "Getting started"],
  ["formulas", "Formulas"],
  ["params", "Parameters"],
  ["contracts", "Contracts"],
  ["routes", "Cross-chain routes"],
  ["limits", "Safety & limits"],
  ["roadmap", "Roadmap"],
];

const params = [
  ["Market pair", "WETH (18 dec collateral) / USDG (6 dec debt)"],
  ["Max borrow LTV", "60%"],
  ["Liquidation threshold", "75%"],
  ["Liquidation eligibility", "HF < 1.00"],
  ["Liquidator bonus", "5% of repaid debt value"],
  ["Close factor", "≤ 50% of debt per liquidation call"],
  ["Borrow APR", "8% fixed, per-second accrual into a global RAY index"],
  ["Beta TVL caps", "25 WETH collateral cap · 50,000 USDG supply cap"],
  ["Emergency pause", "Guardian can pause new deposits/borrows; repay, withdraw & liquidate never pause"],
  ["Price oracle", "Chainlink ETH/USD proxy (7,200 s heartbeat guard, keeperless) + $1.00 USDG peg"],
];

const CHAINLINK_ETH_USD = "0x78F3556b67E17Df817D51Ef5a990cDaF09E8d3A9";

export default function Docs() {
  const mainnetAddrs: [string, string | undefined][] = [
    ...MAINNET_MARKETS.map((m) => [`LengoMarket (${m.pair})`, m.market] as [string, string | undefined]),
    ["ChainlinkOracle (Adapter)", DEPLOYMENTS.mainnet.oracle],
    ["Chainlink ETH / USD Proxy", CHAINLINK_ETH_USD],
    ["USDG Debt Asset (6 dec)", DEPLOYMENTS.mainnet.debtAsset],
    ["$LENGO Utility Token (18 dec)", MAINNET_LENGO_TOKEN],
  ];
  const testnetAddrs: [string, string | undefined][] = [
    ["LengoMarket (Testnet · 46630)", DEPLOYMENTS.testnet.market],
    ["DemoOracle (Testnet)", DEPLOYMENTS.testnet.oracle],
    ["tBTC (8 dec · Testnet)", DEPLOYMENTS.testnet.collateral],
    ["tUSDC (6 dec · Testnet)", DEPLOYMENTS.testnet.debtAsset],
  ];

  return (
    <>
      <div className={s.pageHead}>
        <div>
          <h1>Docs</h1>
          <p>Architecture, risk math, deployed Robinhood Chain Mainnet contracts, and cross-chain routing.</p>
        </div>
        <span>Mainnet Beta · Robinhood Chain · 4663</span>
      </div>
      <div className={d.wrap}>
        <nav className={d.toc}>
          {toc.map(([id, t], i) => (
            <a key={id} href={`#${id}`}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              {t}
            </a>
          ))}
        </nav>
        <article className={d.body}>
          <section id="start">
            <h2>Getting started on Mainnet</h2>
            <ol>
              <li>Connect an EVM wallet — Lengo automatically configures and switches to <b>Robinhood Chain Mainnet (chain ID 4663)</b>.</li>
              <li>Bringing collateral from another network? Open <a href="/app/routes?preset=collateral&mode=live">Routes → Cross-chain collateral</a> to route <code>SOL</code>, <code>USDC</code>, <code>USDT</code>, <code>ETH</code>, or <code>BTC</code> into <code>WETH</code> / <code>USDe</code> on Robinhood Chain and lock directly into <code>LengoMarket</code>.</li>
              <li>On <a href="/app">Markets</a>, supply <b>USDG</b> to earn borrower interest, or deposit collateral across 7 isolated Crypto &amp; RWA Stock markets (<code>WETH</code>, <code>cbBTC</code>, <code>WBTC</code>, <code>USDe</code>, <code>NVDA</code>, <code>TSLA</code>, <code>AAPL</code>) and borrow <b>USDG</b>.</li>
              <li>Monitor real-time Health Factor, Liquidation Price, LT proximity alerts, and price-shock stress tests on <a href="/app/positions">Positions</a>.</li>
              <li>Route borrowed <b>USDG</b> into <b>USDC, USDT, or DAI</b> across 14+ chains — or repay <b>USDG</b> debt from any chain — in <a href="/app/routes">Routes</a> (<b>Live</b> mode), and verify every event in <a href="/app/activity">Activity</a>.</li>
            </ol>
          </section>

          <section id="formulas">
            <h2>Formulas</h2>
            <pre>{`C = collateral value in USD (Chainlink ETH/USD price × WETH quantity)
D = USDG debt including accrued interest (debtShares × projectedBorrowIndex / 1e27)

LTV                     = D / C
Health factor           = (C × liquidationThreshold) / D
Extra borrow capacity   = max(0, C × maxBorrowLTV − D)
Est. liquidation price  = D / (collateralQuantity × liquidationThreshold)`}</pre>
            <p>With D = 0 the UI displays <b>No debt</b>, never NaN. Repay All passes <code>type(uint256).max</code> so debt shares clear to exact zero with no dust.</p>
            <p className={d.ex}>Example: 2 WETH at $1,700 ($3,400) with 1,360 USDG debt → LTV 40.0%, HF 1.875, liquidation price $906.67.</p>
          </section>

          <section id="params">
            <h2>Mainnet parameters</h2>
            <p>Immutable risk parameters deployed on Robinhood Chain Mainnet (4663), paired with conservative beta TVL caps.</p>
            <div className={d.table}>
              {params.map(([k, v]) => (
                <div key={k}>
                  <span>{k}</span>
                  <b>{v}</b>
                </div>
              ))}
            </div>
            <h3 style={{ marginTop: 22, fontSize: 13, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--lime)" }}>
              Per-Market Onchain Parameters &amp; Caps (All 7 Verified Mainnet Markets)
            </h3>
            <div className={d.table}>
              {MAINNET_MARKETS.map((m) => (
                <div key={m.id}>
                  <span>
                    {m.pair} ({m.isSeeded ? "LIVE · Seeded" : "DEPLOYED · Unseeded"})
                  </span>
                  <b>
                    Feed: {m.feedLabel ?? m.collSymbol} ({m.maxOracleAge.toLocaleString("en-US")}s) · LTV {Math.round(m.maxLtv * 100)}% · LT {Math.round(m.liqThreshold * 100)}% · {(m.apr * 100).toFixed(1)}% APR · Cap {m.collateralCapLabel ?? "—"} / {m.supplyCapLabel ?? "50,000 USDG"}
                    {m.uiMultiplier ? ` · ERC-8056 uiMultiplier ${m.uiMultiplier}` : ""}
                  </b>
                </div>
              ))}
            </div>
          </section>

          <section id="contracts">
            <h2>Deployed contracts — Robinhood Chain Mainnet (4663)</h2>
            <div className={d.table}>
              {mainnetAddrs.map(([k, v]) => (
                <div key={k}>
                  <span>{k}</span>
                  <b>{v ? <a href={addrUrl(v, "mainnet")} target="_blank" rel="noreferrer">{v} ↗</a> : "—"}</b>
                </div>
              ))}
            </div>
            <p>
              Built with Solidity 0.8.24, Foundry, and pinned OpenZeppelin 5.1.0. Verified (<code>exact_match</code> creation &amp; runtime bytecode) on Sourcify &amp; Blockscout, and covered by an <b>independent security review by HEY Research Lab</b> (note: an independent security review, not a formal audit).
            </p>
            <p>
              <b>Oracle &amp; Guardian Architecture (M-1 / I-6 Disclosure):</b> Each <code>LengoMarket</code> holds an immutable reference to <code>ChainlinkOracle</code> (<a href={addrUrl(DEPLOYMENTS.mainnet.oracle ?? "0xAc892397986B84ff42894739F05fE884D1D4c6da", "mainnet")} target="_blank" rel="noreferrer">{DEPLOYMENTS.mainnet.oracle} ↗</a>), which reads Chainlink&apos;s official price feeds via <code>latestRoundData()</code> with round-completeness (<code>answer &gt; 0</code>, <code>updatedAt &gt; 0</code>, <code>answeredInRound &gt;= roundId</code>) and staleness checks.{" "}
              <code>ChainlinkOracle</code> inherits OpenZeppelin <code>Ownable2Step</code>: its owner (currently the deployer/guardian address <code>0x9178…7681</code>, scheduled to transition to a ≥ 48-hour timelock + multisig) can call <code>setFeed(asset, feed, maxStaleness)</code> and <code>setFixedPeg(asset, price8Dec)</code> (used to peg <code>USDG</code> at $1.00). Until ownership is behind a timelock or renounced, the oracle owner has privileged ability to update feed addresses, staleness windows, or fixed pegs across markets sharing this adapter.
            </p>
            <p>
              <b>$LENGO Utility Tier:</b> The <code>$LENGO</code> token (<a href={addrUrl(MAINNET_LENGO_TOKEN, "mainnet")} target="_blank" rel="noreferrer">{MAINNET_LENGO_TOKEN} ↗</a>) is queried live onchain across <code>/app</code>, <code>/app/positions</code>, and <code>/app/routes</code>: wallets holding ≥ 10,000 <code>LENGO</code> automatically unlock the <b>0% 1Click App Routing Fee tier</b>.
            </p>
            <h3 style={{ marginTop: 24, fontSize: 13, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--lime)" }}>
              First Loan Live Proofs — Mainnet 4663 (Completed)
            </h3>
            <div className={d.table}>
              <div>
                <span>Supply USDG (Lender)</span>
                <b>
                  <a href="https://robinhoodchain.blockscout.com/tx/0x04887e2dd03391090f3f90eb170bba562955d76122e24bdafb2fbf73f715f0d7" target="_blank" rel="noreferrer">
                    0x04887e2d…f0d7 ↗
                  </a>
                </b>
              </div>
              <div>
                <span>Deposit WETH (Borrower)</span>
                <b>
                  <a href="https://robinhoodchain.blockscout.com/tx/0x4ff7f8d8c6c72ede29a11b76ffddca948c662f57d4eb220a8e34654fde9d6b98" target="_blank" rel="noreferrer">
                    0x4ff7f8d8…6b98 ↗
                  </a>
                </b>
              </div>
              <div>
                <span>Borrow USDG (Borrower)</span>
                <b>
                  <a href="https://robinhoodchain.blockscout.com/tx/0x57356f96ef1e9bebc9345de9530628c919faf2f9348c082f83b62cb240435f4d" target="_blank" rel="noreferrer">
                    0x57356f96…5f4d ↗
                  </a>
                </b>
              </div>
              <div>
                <span>Repay USDG (Borrower)</span>
                <b>
                  <a href="https://robinhoodchain.blockscout.com/tx/0xabdb082cf3c0fd5fd1875f616b0b4fa3b71bd7f3ac811157edffd4ad32725bcb" target="_blank" rel="noreferrer">
                    0xabdb082c…5bcb ↗
                  </a>
                </b>
              </div>
              <div>
                <span>Withdraw WETH (Borrower)</span>
                <b>
                  <a href="https://robinhoodchain.blockscout.com/tx/0x1123391fe9d0a87e5c2146b2cb577573b022bc48dbc31f1f37ff625e0416a2f7" target="_blank" rel="noreferrer">
                    0x1123391f…a2f7 ↗
                  </a>
                </b>
              </div>
              <div>
                <span>1Click USDG Deposit (RH → Solana)</span>
                <b>
                  <a href="https://robinhoodchain.blockscout.com/tx/0xc6684d3643a3d0378129c7b2ed80de1f44851e8ae71d4dcbb520b52016d09644" target="_blank" rel="noreferrer">
                    0xc6684d36…9644 ↗
                  </a>
                </b>
              </div>
              <div>
                <span>1Click USDC Payout (Solana)</span>
                <b>
                  <a href="https://solscan.io/tx/PWUk1xC3DdzyGvPZu9rVviDkj1EpNapzftXxjWPWwpfdFf6PyRMAWkmZqWbp8oCgk4jhuJFDgqz8pRzZV77RUwV" target="_blank" rel="noreferrer">
                    PWUk1xC3…7RUwV ↗
                  </a>
                </b>
              </div>
              <div>
                <span>NEAR Intents Settlement</span>
                <b>
                  <a href="https://explorer.near-intents.org/transactions/0x0D650Ee3D0961B376a9b90fB12e5fE0BD9D46283" target="_blank" rel="noreferrer">
                    0x0D650Ee3…6283 · SUCCESS ↗
                  </a>
                </b>
              </div>
              <div>
                <span>1Click USDG Deposit (RH → Base)</span>
                <b>
                  <a href="https://robinhoodchain.blockscout.com/tx/0xa484f312f7419d09f0d64fd85bcaff29394ed072d53603c510f2d523cf77a7f0" target="_blank" rel="noreferrer">
                    0xa484f312…a7f0 ↗
                  </a>
                </b>
              </div>
              <div>
                <span>1Click USDC Payout (Base)</span>
                <b>
                  <a href="https://basescan.org/tx/0x7e4f2eb4a67b2e083993793c4154ce34a23781d6f03e1b866b5e3e78b4c2cd0d" target="_blank" rel="noreferrer">
                    0x7e4f2eb4…cd0d ↗
                  </a>
                </b>
              </div>
              <div>
                <span>NEAR Intents Base Settlement</span>
                <b>
                  <a href="https://explorer.near-intents.org/transactions/0x0cC24E339540688717D23c86fE2783e3DD7C2E3d" target="_blank" rel="noreferrer">
                    0x0cC24E33…2E3d · SUCCESS ↗
                  </a>
                </b>
              </div>
              <div>
                <span>Seed RWA Pool · NVDA/USDG</span>
                <b>
                  <a href="https://robinhoodchain.blockscout.com/tx/0xef3a519afa18f8c11b68ff13348a11bbbffe3dd2255f83cdaa96d6befed58cfe" target="_blank" rel="noreferrer">
                    0xef3a519a…8cfe ↗
                  </a>
                </b>
              </div>
              <div>
                <span>Seed RWA Pool · TSLA/USDG</span>
                <b>
                  <a href="https://robinhoodchain.blockscout.com/tx/0x3ba93b6139f3be8c253c9b3a678bfaa2f084dbbb617bfa01980aeec24f24352b" target="_blank" rel="noreferrer">
                    0x3ba93b61…352b ↗
                  </a>
                </b>
              </div>
              <div>
                <span>Seed RWA Pool · AAPL/USDG</span>
                <b>
                  <a href="https://robinhoodchain.blockscout.com/tx/0xefce4d41320bf3d7175043d6dbfbe0720c7f18390bd3b36db2b08922bed05ec7" target="_blank" rel="noreferrer">
                    0xefce4d41…5ec7 ↗
                  </a>
                </b>
              </div>
              <div>
                <span>Cross-Chain Repay All · USDG</span>
                <b>
                  <a href="https://robinhoodchain.blockscout.com/tx/0x88a0e4bfdfa2b444d205b3f8b125afab714346d86a864451e5a36aa8e55844c8" target="_blank" rel="noreferrer">
                    0x88a0e4bf…44c8 ↗
                  </a>
                </b>
              </div>
              <div>
                <span>Post-Repay Collateral Exit · WETH</span>
                <b>
                  <a href="https://robinhoodchain.blockscout.com/tx/0x563d35bd6f8dbb8e56c1029e04dda04f164b2ba1bdd893e216d22195b6aab41f" target="_blank" rel="noreferrer">
                    0x563d35bd…b41f ↗
                  </a>
                </b>
              </div>
            </div>
            <h3 style={{ marginTop: 24, fontSize: 13, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--tx2)" }}>
              Testnet sandbox — Robinhood Chain Testnet (46630)
            </h3>
            <div className={d.table}>
              {testnetAddrs.map(([k, v]) => (
                <div key={k}>
                  <span>{k}</span>
                  <b>{v ? <a href={addrUrl(v, "testnet")} target="_blank" rel="noreferrer">{v} ↗</a> : "—"}</b>
                </div>
              ))}
            </div>
          </section>

          <section id="routes">
            <h2>Cross-chain routes (Preview &amp; Live)</h2>
            <p>
              The <a href="/app/routes">Routes</a> page integrates NEAR Intents 1Click in two modes: <b>Preview</b> (read-only market quotes with no deposit address) and <b>Live</b> (issues a dedicated deposit address, enforces strict ERC-20 origin asset verification on Robinhood Chain Mainnet, submits <code>txHash</code> to solvers, and polls live settlement status).
            </p>
            <ul>
              <li><b>Borrow payout (multi-chain &amp; multi-stable)</b>: convert borrowed <code>USDG</code> on Robinhood Chain directly into <code>USDC</code>, <code>USDT</code>, or <code>DAI</code> across Solana, Base, Arbitrum, Ethereum, Optimism, Polygon, BNB Chain, Avalanche, NEAR, TON, TRON, Sui, Aptos, and Stellar.</li>
              <li><b>Cross-chain collateral</b>: route <code>SOL</code>, <code>USDC</code>, <code>USDT</code>, <code>ETH</code>, or <code>BTC</code> from external chains into <code>WETH</code> / <code>USDe</code> on Robinhood Chain and lock directly into <code>LengoMarket</code>.</li>
              <li><b>Cross-chain repay</b>: settle outstanding <code>USDG</code> debt from any supported stablecoin/chain via 1Click and immediately unlock collateral.</li>
              <li><b>Position Health &amp; RWA Stocks</b>: monitor real-time Health Factor, Liquidation Price, and borrow headroom across Crypto &amp; Robinhood Stock markets (<code>NVDA</code>, <code>TSLA</code>, <code>AAPL</code>) on <a href="/app/positions">Positions</a>.</li>
            </ul>
          </section>

          <section id="limits">
            <h2>Safety, risk disclosures &amp; current scope</h2>
            <ul>
              <li><b>Independent Security Review (Not a Formal Audit)</b>: All 7 deployed <code>LengoMarket</code> contracts and <code>ChainlinkOracle</code> are <code>exact_match</code> verified on Sourcify/Blockscout, tested against unit, fuzz, and 128,000-call stateful invariant suites, and have undergone an <b>independent security review by HEY Research Lab</b>. TVL is bounded by conservative per-market beta caps (e.g. 25 WETH / 50,000 USDG).</li>
              <li><b>Non-custodial exit guarantee</b>: Even if the guardian pauses new deposits/borrows, <code>repay</code>, debt-free <code>withdrawCollateral</code>, and <code>withdrawSupply</code> remain permanently open. The guardian cannot move user funds, alter LTV/LT/APR parameters, or swap the market&apos;s oracle address.</li>
              <li><b>Oracle &amp; Guardian Architecture (M-1 / I-6)</b>: <code>ChainlinkOracle</code> inherits <code>Ownable2Step</code> (owner = deployer/guardian <code>0x9178…7681</code>, which currently carries an EIP-7702 smart-account delegation from wallet batching; <code>setGuardian</code> on <code>LengoMarket</code> is single-step). Moving oracle ownership and market guardianship to a ≥ 48-hour timelock + multisig is tracked as priority hardening.</li>
              <li><b>Oracle staleness, WETH heartbeat &amp; US market-hours feeds (L-2 / I-2 / I-8)</b>: <code>borrow</code>, <code>liquidate</code>, and <code>withdrawCollateral</code> (when debt &gt; 0) require a fresh oracle reading. On Robinhood Chain, the ETH/USD Chainlink feed exhibits a 24-hour heartbeat with deviation triggers (occasionally exceeding 7,200 s between rounds). Because <code>ChainlinkOracle</code> returns <code>block.timestamp</code> when a feed&apos;s configured <code>maxStaleness</code> exceeds 7,200 s (I-2), aligning WETH&apos;s oracle <code>maxStaleness</code> to 24h+ buffer keeps liquidations open across quiet periods. While <code>NVDA/USDG</code> and <code>TSLA/USDG</code> use 24/7 Chainlink equity feeds (90,000 s window), <code>AAPL/USDG</code> tracks regular US equity market hours (pausing updates over weekends/market holidays). Position Health (<code>/app/positions</code>) displays live oracle price age alongside every Health Factor (I-8).</li>
              <li><b>Sub-cent dust collateral &amp; partial repay edge cases (L-1 / I-7)</b>: In <code>LengoMarket</code> v1.0, bad-debt write-off triggers when a liquidation seizes 100% of a borrower&apos;s collateral (<code>p.collateral == 0</code>). If an underwater 18-decimal position is left with microscopic dust collateral worth less than 1 base unit of <code>USDG</code> (&lt; ~1.2×10<sup>7</sup> wei WETH), the exhausted-collateral branch rounds <code>repaid</code> to 0 and reverts with <code>ZeroAmount()</code> (L-1). Similarly, after <code>borrowIndex &gt; RAY</code>, sub-unit partial repayments that round to 0 debt shares are no-ops (I-7). Both are patched for v1.1 market deployments.</li>
              <li><b>Fixed APR &amp; pool liquidity utilization (I-5)</b>: Markets accrue interest at a fixed per-second RAY borrow rate without a variable utilization kink. If 100% of supplied <code>USDG</code> is actively borrowed (0 idle liquidity), lender <code>withdrawSupply</code> calls will revert with <code>InsufficientLiquidity()</code> until borrowers repay or additional <code>USDG</code> is supplied.</li>
              <li><b>ERC-8056 stock token multipliers, USDG $1.00 peg &amp; L2 sequencer (I-1 / I-3 / I-4 / I-9)</b>: <code>USDG</code> is valued at a $1.00 fixed peg in <code>ChainlinkOracle</code> (I-4). Tokenized equities (<code>NVDA</code>, <code>TSLA</code>, <code>AAPL</code>) are issuer-upgradable ERC-8056/ERC-20 proxies exposing <code>uiMultiplier()</code> (currently <code>1.000775</code> on NVDA, <code>1.001091</code> on AAPL, and <code>1.000000</code> on TSLA) and subject to issuer pause/compliance controls (I-1, I-9). Robinhood Chain is an Arbitrum Orbit L2 with a single sequencer without an onchain sequencer-uptime feed yet (I-3). Lengo never lists fee-on-transfer tokens.</li>
              <li><b>Native BTC / ZEC collateral</b>: Mainnet supports 7 isolated ERC-20 Crypto &amp; RWA Stock markets today; native non-EVM BTC &amp; ZEC origin-chain locking is in research.</li>
              <li><b>Charts</b>: Multi-timeframe (<code>15m / 1h / 4h / 1d</code>) historical candles in the UI are powered by Pyth Pro, while all onchain LTV and liquidation checks strictly read <code>ChainlinkOracle</code> on Robinhood Chain.</li>
            </ul>
          </section>

          <section id="roadmap">
            <h2>Roadmap</h2>
            <div className={d.table}>
              {[
                ["Phase 1 · LIVE", "Isolated lending engine + Testnet sandbox (46630)"],
                ["Phase 2 · LIVE", "Robinhood Chain Mainnet (4663) + keeperless ChainlinkOracle + Position Health"],
                ["Phase 3 · LIVE", "NEAR Intents 1Click Cross-Chain Collateral, 14+ Chain USDC/USDT/DAI Payout & Any-Chain Repay"],
                ["Phase 4 · LIVE", "7 isolated Crypto & RWA Stock markets (WETH, cbBTC, WBTC, USDe, NVDA, TSLA, AAPL) live on Mainnet"],
                ["Phase 5 · RESEARCH", "Native BTC & ZEC collateral locking, proof & redemption"],
              ].map(([k, v]) => (
                <div key={k}>
                  <span>{k}</span>
                  <b>{v}</b>
                </div>
              ))}
            </div>
          </section>
        </article>
      </div>
    </>
  );
}
