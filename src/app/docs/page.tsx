import s from "../app/trade.module.css";
import d from "./docs.module.css";
import { deployment, addrUrl } from "@/lib/chain";

const toc = [["start", "Getting started"], ["formulas", "Formulas"], ["params", "Parameters"], ["contracts", "Contracts"], ["routes", "Route preview"], ["limits", "Limits"], ["roadmap", "Roadmap"]];
const params = [["Max borrow LTV", "60%"], ["Liquidation threshold", "75%"], ["Liquidation eligibility", "HF < 1"], ["Liquidator bonus", "5% of repaid debt value"], ["Close factor", "≤ 50% of debt per call"], ["Borrow APR", "8% fixed, simple accrual into a global index"], ["Protocol reserve", "0%"], ["Oracle freshness", "300 s. Borrow and withdraw-with-debt need a fresh price; repay and debt-free exit do not"]];

export default function Docs() {
  const addrs: [string, string | undefined][] = [["LengoMarket", deployment.market], ["tBTC", deployment.tBTC], ["tUSDC", deployment.tUSDC], ["DemoOracle", deployment.oracle]];
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
              {addrs.map(([k, v]) => <div key={k}><span>{k}</span><b>{v ? <a href={addrUrl(v)} target="_blank" rel="noreferrer">{v} ↗</a> : "Not deployed yet"}</b></div>)}
            </div>
            <p>Solidity 0.8.24, Foundry, OpenZeppelin 5.1 (pinned). Debt uses shares over a borrow index; lenders hold shares over idle liquidity plus outstanding debt, with a virtual-share offset against inflation attacks. Not audited. &ldquo;Verified&rdquo; is only claimed for contracts the explorer actually verified.</p>
          </section>
          <section id="routes">
            <h2>Route preview</h2>
            <p>The Routes page asks NEAR Intents 1Click for a quote with <code>dry: true</code>, through a server proxy. It reads mainnet market data. No funds move, no deposit address is issued, and nothing connects a quote to your testnet debt.</p>
            <ul>
              <li><b>Borrow payout preview</b>: converting an RH debt asset (e.g. USDG on <code>hood</code>) to USDC on another chain. It does not prove USDC exists as a debt asset on RH.</li>
              <li><b>Asset routing preview</b>: a BTC/ZEC swap quote. A swap is not collateral; selling BTC is never called BTC collateral.</li>
              <li>Debt denomination and payout denomination stay separate. If debt is USDG and payout is USDC, the UI shows both and the conversion cost.</li>
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
