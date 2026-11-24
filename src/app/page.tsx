import Link from "next/link";
import Image from "next/image";
import s from "./landing.module.css";
import fx from "./fx.module.css";
import { CycleWord, Ticker, Ruler } from "./Fx";
import { MarketList, EventStream } from "./Console";
import Bento from "./Bento";
import Story from "./Story";
import RiskCalc from "./RiskCalc";
import Motion from "./Motion";
import TopNav from "./TopNav";
import CopyCA from "./CopyCA";

const tick = [["WETH/USDG","APR","8.00%"],["Max LTV","","60%"],["Liq. threshold","","75%"],["USDG → USDC","1Click","Live Execute"],["Oracle","Chainlink","ETH/USD"],["Chain","Robinhood","4663"],["Chart","Pyth Pro","Live 48h"],["Liq. bonus","","5%"]];
const params = [["Max borrow LTV","60%"],["Liquidation threshold","75%"],["Eligible when","HF < 1"],["Liquidator bonus","5%"],["Close factor","50% per call"],["Borrow APR","8% fixed"],["TVL caps (beta)","25 WETH · 50k USDG"],["Oracle","Chainlink ETH/USD"]];
const disclosure = [
  ["Lending contracts", "Live on RH Mainnet (4663) + Testnet (46630)", "External security audit"],
  ["Collateral asset", "WETH (18 dec) on RH Mainnet", "Native BTC, ZEC, SOL"],
  ["Borrow asset", "USDG (6 dec) Global Dollar", "Additional markets"],
  ["Price oracle", "Chainlink ETH/USD (keeperless)", "Multi-oracle fallback"],
  ["Multichain payout", "NEAR Intents 1Click (Preview + Live Execute)", "1-tx borrow + route"],
  ["Native BTC / ZEC deposit", "In research (testnet demo uses tBTC)", "Lock, proof, redemption"],
  ["Safety rails", "Capped TVL + non-custodial pause", "Timelock multisig"],
];
const phases = [
  ["Phase 1", "LIVE", "Lending lifecycle", ["Isolated tBTC/tUSDC market", "Faucet + dashboard", "Deposit → withdraw on RH"], 100],
  ["Phase 2", "BUILDING", "Risk demo", ["Demo oracle scenarios", "Two-wallet liquidation", "Accounting invariants"], 60],
  ["Phase 3", "BUILDING", "Multichain preview", ["1Click token discovery", "Route preview quotes", "Expiry + error states"], 40],
  ["Phase 4", "NEXT", "Release package", ["Public testnet app", "Docs + QA", "Proof index"], 10],
  ["Phase 5", "RESEARCH", "Native BTC", ["Custody + signer model", "Proof and redemption", "Liquidation feasibility"], 0],
] as const;
const contracts = [
  ["TestCollateralToken.sol", "tBTC, 8 decimals, capped mint, testnet only", "Asset"],
  ["TestDebtToken.sol", "tUSDC, 6 decimals, capped mint, testnet only", "Asset"],
  ["DemoOracle.sol", "Price + timestamp, validity checks, labeled overrides", "Oracle"],
  ["LengoMarket.sol", "Collateral, lender shares, debt index, liquidate", "Core"],
  ["Indexer / API", "Events, quotes, alerts. Cannot touch balances", "Read"],
];

function Head({ n, label, a, b, aside }: { n: string; label: string; a: string; b: string; aside?: string }) {
  return (
    <div className={s.secHead}>
      <div className={s.label}><em>{n}</em> / {label}<span className="hatch" data-rule /></div>
      <div className={s.headRow}>
        <h2 className={s.h2} data-split><span>{a}</span><span className={s.dim}>{b}</span></h2>
        {aside && <p className={s.aside} data-reveal>{aside}</p>}
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className={s.page}>
      <Motion />
      <TopNav />

      <section className={`${s.hero} grid-bg`} data-hero>
        <div className={s.vignette} aria-hidden />
        <div className={fx.scanline} />
        <Ruler />
        <div className={s.console}>
          <aside className={s.colL}><MarketList /></aside>
          <div className={s.center}>
            <div className={`${s.heroBox} bevel`}>
              <div className={s.addr}><span>MARKET</span>0x8f1C…5900 · WETH/USDG<em>MAINNET · 4663</em></div>
              <div className={s.markWrap} data-hero-mark>
                <Image src="/logo-mark.png" alt="Lengo" width={150} height={150} priority className={s.mark} />
              </div>
              <div className={s.eyebrow}><span className="dot" /> Cross-chain lending · Robinhood Chain + NEAR Intents</div>
              <h1 className={s.h1}>
                <span>Borrow against</span>
                <span className={s.wordFrame}><CycleWord words={["BTC", "ZEC", "SOL", "HYPE"]} /></span>
                <span>Liquidity across chains</span>
              </h1>
            </div>
            <p className={`${s.sub} bevel`}>Your assets on one chain. Your liquidity on another. Borrow against collateral across networks, settled on Robinhood Chain.</p>
            <div className={s.ctas}>
              <Link href="/app" className="btn btn-primary">Launch App →</Link>
              <a href="https://robinhoodchain.blockscout.com/address/0x8f1CDFEa078D84d0a2f974c658f71CF4B54c5900" target="_blank" rel="noreferrer" className="btn">Mainnet Contract ↗</a>
              <Link href="/app/routes" className="btn">Cross-chain Routes</Link>
            </div>
            <CopyCA address="0xc256e0fb1f93164b8e499746bba593a8e40a7eef" />
            <div className={s.badgesRow}>
              <span>Live on Robinhood Chain (4663)</span>
              <span>Chainlink Oracle · Keeperless</span>
              <span>1Click Cross-Chain Execution</span>
            </div>
          </div>
          <aside className={s.colR}><EventStream /></aside>
        </div>
        <Ticker items={tick} />
      </section>

      <section id="twosides" className={s.section}>
        <Head n="00" label="Cross-chain architecture" a="Two sides of lending." b="Collateral origin meets liquidity destination." aside="Target design: collateral stays on its origin network, debt and risk accounting live on Robinhood Chain, and stablecoins are routed to your chain via NEAR Intents. Today: testnet lending live, route preview only, native collateral in research." />
        <div className={s.split} data-stagger>
          <div className={`${s.side} bevel`}>
            <span className={s.k}>Side A · collateral origin</span>
            <h3>Where your collateral lives</h3>
            <p>BTC on Bitcoin, ZEC on Zcash, SOL on Solana, HYPE on Hyperliquid. Lengo must verify it is locked, not swapped. Collateral stays collateral. In research — testnet uses tBTC.</p>
            <div className={s.chips}><i>BTC</i><i>ZEC</i><i>SOL</i><i>HYPE</i><i>ETH</i></div>
          </div>
          <div className={s.core}>
            <span className={s.beam} />
            <Image src="/logo-mark.png" alt="" width={64} height={64} />
            <b>Robinhood Chain</b>
            <small>debt · interest · HF · liquidation</small>
          </div>
          <div className={`${s.side} bevel`}>
            <span className={s.k}>Side B · payout destination</span>
            <h3>Where you need liquidity</h3>
            <p>NEAR Intents 1Click previews routing the borrowed stablecoin to your chain. Debt stays on Robinhood Chain; conversion and fees are shown separately. Quote preview today.</p>
            <div className={s.chips}><i>USDC · Solana</i><i>USDC · Base</i><i>USDC · Arbitrum</i><i>USDG · Robinhood</i></div>
          </div>
        </div>
      </section>

      <section id="system" className={s.section}>
        <Head n="01" label="System overview" a="One position." b="Every step on record." aside="Collateral intents come in, the risk guard checks every action, the ledger records debt on Robinhood Chain, and payouts are quoted through NEAR Intents. This is the whole path." />
        <div data-reveal><Bento /></div>
      </section>

      <section id="flow" className={s.section}>
        <div className={s.label}><em>02</em> / Lending lifecycle<span className="hatch" data-rule /></div>
        <Story />
      </section>

      <section className={s.section}>
        <Head n="03" label="Liquidation demo" a="Two wallets." b="One price drop. Proof onchain." aside="An authorized testnet operator moves the demo oracle under a visible Demo price override. Once HF drops below 1, a separate liquidator repays up to half the debt and takes tBTC plus a 5% bonus." />
        <div className={s.liq} data-stagger>
          {[["01", "Oracle update", "Demo price override event"], ["02", "HF < 1", "Position becomes eligible"], ["03", "Liquidate ≤ 50%", "Liquidator pays tUSDC"], ["04", "Settle", "tBTC + 5% bonus out, debt down"]].map(([n, t, d], i) => (
            <div key={n} className={`${s.liqStep} ${i === 2 ? s.liqHot : ""}`}><span>{n}</span><b>{t}</b><p>{d}</p></div>
          ))}
        </div>
      </section>

      <section id="risk" className={s.section}>
        <Head n="04" label="Risk, in the open" a="The math is on the page." b="Not in a tooltip." />
        <div data-reveal className="bevel"><RiskCalc /></div>
        <div className={s.riskGrid} data-stagger>
          <pre className={`${s.formula} bevel`}>{`LTV            = D / C
Health factor  = (C × liqThreshold) / D
Extra capacity = max(0, C × maxLTV − D)
Liq. price     = D / (qty × liqThreshold)`}</pre>
          <div className={`${s.params} bevel`}>{params.map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}</div>
        </div>
      </section>

      <section id="disclosure" className={s.section}>
        <Head n="05" label="Disclosure" a="What is real." b="What is preview." aside="Claims are only useful when they are exact. This is what release 0.1 actually does, including everything it does not." />
        <div className={`${s.table} bevel`} data-reveal>
          <div className={s.tHead}><span>Capability</span><span><i className={s.pill}>● v0.1 testnet</i></span><span><i className={s.pill}>○ Next</i></span></div>
          {disclosure.map(([a, b, c]) => (
            <div key={a} className={s.tRow}><span>{a}</span><span className={b.startsWith("Not") ? s.muted : ""}>{b}</span><span className={s.muted}>{c}</span></div>
          ))}
        </div>
      </section>

      <section id="roadmap" className={s.sectionWide}>
        <div className={s.inner}><Head n="06" label="Roadmap" a="Ship the loop first." b="Then go native." /></div>
        <div className={s.hwrap} data-hwrap>
          <div className={s.htrack} data-htrack>
            {phases.map(([p, st, t, items, pct]) => (
              <div key={p} className={`${s.phase} bevel`}>
                <div className={s.pTop}><span>{p}</span><em className={st === "LIVE" ? s.live : ""}>{st}</em></div>
                <h3>{t}</h3>
                <ul>{items.map((x) => <li key={x}>{x}</li>)}</ul>
                <div className={s.prog}><i style={{ width: `${pct}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={s.section}>
        <div className={s.contracts}>
          <div>
            <div className={s.label}><em>07</em> / Contracts<span className="hatch" data-rule /></div>
            <h2 className={s.h2} data-split><span>The</span><span>contracts.</span></h2>
            <p className={s.aside} data-reveal>Small pieces, one job each. Solidity + Foundry with pinned, audited libraries. Chain is the source of truth; the database only speeds up reads.</p>
          </div>
          <div className={`${s.cList} bevel`} data-stagger>
            {contracts.map(([n, d, t]) => <div key={n}><b>{n}</b><span>{d}</span><em>{t}</em></div>)}
          </div>
        </div>
      </section>

      <section className={s.cta}>
        <div className={`${s.ctaBox} bevel`} data-reveal>
          <h2 data-split><span>Deposit.</span><span>Borrow.</span><span className={s.dim}>Route.</span></h2>
          <p>Mint test assets, open a position, push it toward liquidation, and check every tx on the explorer.</p>
        </div>
        <div className={`${s.ctaBtns} bevel`}>
          <a href="https://robinhoodchain.blockscout.com/address/0x8f1CDFEa078D84d0a2f974c658f71CF4B54c5900" target="_blank" rel="noreferrer" className="btn">RH Mainnet explorer ↗</a>
          <Link href="/app" className="btn btn-primary">Launch app →</Link>
        </div>
      </section>

      <footer className={`${s.foot} bevel`}>
        <Link href="/app">Markets</Link><Link href="/app/routes">Routes</Link><Link href="/app/activity">Activity</Link><Link href="/faucet">Faucet</Link><Link href="/docs">Docs</Link><a href="https://x.com/lengoapp" target="_blank" rel="noreferrer">X · @lengoapp</a>
        <span>Demo assets · no value</span><span className={s.status}>Status <i /></span>
      </footer>
    </div>
  );
}
