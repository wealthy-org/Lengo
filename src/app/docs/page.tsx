import s from "../app/trade.module.css";
import d from "./docs.module.css";
import { DEPLOYMENTS, addrUrl } from "@/lib/chain";
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
              <li>Need WETH or ETH on Robinhood Chain? Use <a href="/app/routes">Routes</a> (e.g. <code>SOL → WETH</code> or <code>USDC Base → WETH</code>) via NEAR Intents 1Click.</li>
              <li>On <a href="/app">Markets</a>, supply <b>USDG</b> to earn borrower interest, or deposit <b>WETH</b> collateral and borrow <b>USDG</b> up to 60% LTV.</li>
              <li>Route borrowed <b>USDG</b> out to <b>USDC</b> on Solana, Base, Arbitrum, or Ethereum in <a href="/app/routes">Routes</a> (<b>Execute</b> mode), and verify every event in <a href="/app/activity">Activity</a>.</li>
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
            <h2>Mainnet parameters (WETH / USDG)</h2>
            <p>Immutable risk parameters deployed on Robinhood Chain Mainnet (4663), paired with conservative beta TVL caps.</p>
            <div className={d.table}>
              {params.map(([k, v]) => (
                <div key={k}>
                  <span>{k}</span>
                  <b>{v}</b>
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
              Built with Solidity 0.8.24, Foundry, and pinned OpenZeppelin 5.1.0. Verified on Sourcify &amp; Blockscout.{" "}
              <code>ChainlinkOracle</code> is completely keeperless — it reads Chainlink&apos;s official <code>ETH / USD</code> proxy directly via <code>latestRoundData()</code> with round-completeness and heartbeat staleness checks, with zero manual price override functions.
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
              <li><b>Borrow payout</b>: convert borrowed <code>USDG</code> on Robinhood Chain directly into <code>USDC</code> on Solana, Base, Arbitrum, or Ethereum.</li>
              <li><b>Collateral inflow</b>: bridge <code>SOL</code> from Solana or <code>USDC</code> from Base directly into <code>WETH</code> on Robinhood Chain Mainnet.</li>
              <li><b>Asset routing</b>: cross-chain <code>BTC</code> / <code>ZEC</code> swap quotes via NEAR Intents (distinct from native collateral locking).</li>
            </ul>
          </section>

          <section id="limits">
            <h2>Safety &amp; current scope</h2>
            <ul>
              <li><b>Capped Mainnet Beta</b>: Contracts are verified and covered by unit, fuzz, edge-case, and 128,000-call invariant suites, but have not yet undergone an external third-party audit. TVL is capped at 25 WETH / 50,000 USDG during beta.</li>
              <li><b>Non-custodial exit guarantee</b>: Even if the guardian pauses new deposits/borrows or if the oracle goes stale, <code>repay</code>, debt-free <code>withdrawCollateral</code>, and <code>withdrawSupply</code> remain permanently open.</li>
              <li><b>Native BTC / ZEC collateral</b>: Currently in research (Mainnet uses <code>WETH</code> collateral today, with <code>cbBTC</code> CCIP market next).</li>
              <li><b>Charts</b>: Historical market candles in the UI are powered by Pyth Pro, while all onchain LTV and liquidation checks strictly read Chainlink on Robinhood Chain.</li>
            </ul>
          </section>

          <section id="roadmap">
            <h2>Roadmap</h2>
            <div className={d.table}>
              {[
                ["Phase 1 · LIVE", "Isolated lending engine + Testnet sandbox (46630)"],
                ["Phase 2 · LIVE", "Robinhood Chain Mainnet Beta (4663) WETH / USDG + keeperless ChainlinkOracle"],
                ["Phase 3 · LIVE", "NEAR Intents 1Click cross-chain Live Payout (USDG RH → USDC Solana/Base)"],
                ["Phase 4 · SEEDING", "Stock & BTC isolated markets deployed on Mainnet (pool seeding in progress)"],
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
