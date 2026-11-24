import s from "../app/trade.module.css";
import d from "./docs.module.css";
import { DEPLOYMENTS, addrUrl } from "@/lib/chain";

const toc = [["start", "Getting started"], ["formulas", "Formulas"], ["params", "Parameters"], ["contracts", "Contracts"], ["routes", "Cross-chain routes"], ["limits", "Limits & safety"], ["roadmap", "Roadmap"]];
const params = [["Max borrow LTV", "60%"], ["Liquidation threshold", "75%"], ["Liquidation eligibility", "HF < 1"], ["Liquidator bonus", "5% of repaid debt value"], ["Close factor", "≤ 50% of debt per call"], ["Borrow APR", "8% fixed, simple accrual into a global index"], ["Safety rails", "Configurable collateral/supply TVL caps + guardian pause (never blocks repay or exit)"], ["Oracle freshness", "300 s (testnet) / 900 s (mainnet). Borrow & withdraw-with-debt require a fresh price"]];

export default function Docs() {
  const testnetAddrs: [string, string | undefined][] = [
    ["LengoMarket (Testnet · 46630)", DEPLOYMENTS.testnet.market],
    ["tBTC (8 dec · Testnet)", DEPLOYMENTS.testnet.collateral],
    ["tUSDC (6 dec · Testnet)", DEPLOYMENTS.testnet.debtAsset],
    ["DemoOracle (Testnet)", DEPLOYMENTS.testnet.oracle],
  ];
  const mainnetAddrs: [string, string | undefined][] = [
    ["LengoMarket (Mainnet · 4663)", DEPLOYMENTS.mainnet.market],
    ["WETH (18 dec · Mainnet)", DEPLOYMENTS.mainnet.collateral],
    ["USDG (6 dec · Mainnet)", DEPLOYMENTS.mainnet.debtAsset],
    ["PriceOracle (Mainnet)", DEPLOYMENTS.mainnet.oracle],
  ];
  return (
    <>
      <div className={s.pageHead}>
        <div><h1>Docs</h1><p>How Lengo v0.1 works, what it computes, and what it does not do yet.</p></div>
        <span>Release 0.1 · Robinhood Chain Testnet</span>
      </div>
      <div className={d.wrap}>
        <nav className={d.toc}>{toc.map(([id, t], i) => <a key={id} href={`#${id}`}><span>{String(i + 1).padStart(2, "0")}</span>{t}</a>)}</nav>
        <article className={d.body}>
          <section id="start">
            <h2>Getting started</h2>
            <ol>
              <li>Connect an EVM wallet and switch to Robinhood Chain Testnet (chain ID 46630).</li>
              <li>Get testnet ETH for gas, then mint tBTC and tUSDC on the <a href="/faucet">Faucet</a>.</li>
              <li>On <a href="/app">Markets</a>, deposit tBTC, borrow tUSDC inside 60% LTV, then repay and withdraw.</li>
              <li>Every action is a real testnet transaction with an explorer link. <a href="/app/activity">Activity</a> is rebuilt from contract events.</li>
            </ol>
          </section>
          <section id="formulas">
            <h2>Formulas</h2>
            <pre>{`C = collateral value in USD (oracle price × quantity)
D = debt including accrued interest, valued with the debt price at read time

LTV                     = D / C
Health factor           = (C × liquidationThreshold) / D
Extra borrow capacity   = max(0, C × maxBorrowLTV − D)
Est. liquidation price  = D / (collateralQuantity × liquidationThreshold)`}</pre>
            <p>With D = 0 the UI shows <b>No debt</b>, never NaN. A position without collateral cannot borrow. The liquidation price is an estimate: it moves as interest accrues or the debt price changes.</p>
            <p className={d.ex}>Fixture: C = $10,000, D = $4,000 → LTV 40%, HF 1.875, extra capacity $2,000.</p>
          </section>
          <section id="params">
            <h2>Parameters</h2>
            <p>Testnet demo values set at deployment, not mainnet recommendations. Changing them means deploying a new market.</p>
            <div className={d.table}>{params.map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}</div>
          </section>
          <section id="contracts">
            <h2>Contracts</h2>
            <div className={d.table}>
              {testnetAddrs.map(([k, v]) => <div key={k}><span>{k}</span><b>{v ? <a href={addrUrl(v, "testnet")} target="_blank" rel="noreferrer">{v} ↗</a> : "Not deployed yet"}</b></div>)}
              {mainnetAddrs.map(([k, v]) => <div key={k}><span>{k}</span><b>{v ? <a href={addrUrl(v, "mainnet")} target="_blank" rel="noreferrer">{v} ↗</a> : "Ready to deploy via DeployMainnet.s.sol"}</b></div>)}
            </div>
            <p>Solidity 0.8.24, Foundry, OpenZeppelin 5.1 (pinned). Mainnet uses <code>PriceOracle</code> (Ownable2Step + keeper role + min/max bounds + per-update deviation circuit breaker, no demoOverride) and <code>LengoMarket</code> with TVL caps and non-custodial pause guards.</p>
          </section>
          <section id="routes">
            <h2>Cross-chain routes (Preview &amp; Live Execute)</h2>
            <p>The Routes page connects to NEAR Intents 1Click in two modes: <b>Quote Preview</b> (<code>dry: true</code>, no deposit address) and <b>Live Execute</b> (<code>dry: false</code>, issues a real deposit address, supports 1-click wallet transfer on Robinhood Chain Mainnet, submits txHash to solvers, and polls live settlement status).</p>
            <ul>
              <li><b>Borrow payout</b>: route borrowed USDG on Robinhood Chain (<code>hood</code>) directly to USDC on Solana, Base, Arbitrum, or Ethereum.</li>
              <li><b>Collateral inflow</b>: route USDC from Base into WETH on Robinhood Chain Mainnet.</li>
              <li><b>Asset routing</b>: BTC/ZEC swap quotes via NEAR Intents. A swap is not native collateral.</li>
            </ul>
          </section>
          <section id="limits">
            <h2>Limits in v0.1</h2>
            <ul>
              <li>tBTC has no Bitcoin backing. tUSDC has no value and is not Circle USDC.</li>
              <li>Native BTC/ZEC collateral is under development. No real deposits are accepted.</li>
              <li>No private positions. Confidential swap settlement does not hide collateral, debt or HF on a public RH contract.</li>
              <li>Liquidation demo uses an authorized oracle override labeled <code>Demo price override</code>, emitted onchain.</li>
              <li>Browser notifications only work while the app is open.</li>
            </ul>
          </section>
          <section id="roadmap">
            <h2>Roadmap</h2>
            <div className={d.table}>
              {[["M1", "Lending lifecycle on RH testnet"], ["M2", "Risk demo: oracle scenarios, two-wallet liquidation"], ["M3", "Multichain preview: discovery, dry quotes, error states"], ["M4", "Release package: public testnet, docs, QA, proof index"], ["M5", "BTC spike: custody, proof, redemption, liquidation feasibility"]].map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}
            </div>
          </section>
        </article>
      </div>
    </>
  );
}
