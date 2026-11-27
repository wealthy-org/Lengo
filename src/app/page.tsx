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

const tick = [["WETH/USDG","APR","8.00%"],["Max LTV","","60%"],["Liq. threshold","","75%"],["USDG → USDC","1Click","Live Payout"],["Oracle","Chainlink","ETH/USD"],["Chain","Robinhood","4663"],["Chart","Pyth Pro","Live 48h"],["Liq. bonus","","5%"]];
const params = [["Max borrow LTV","60%"],["Liquidation threshold","75%"],["Eligible when","HF < 1"],["Liquidator bonus","5%"],["Close factor","50% per call"],["Borrow APR","8% fixed"],["TVL caps (beta)","25 WETH · 50k USDG"],["Oracle","Chainlink ETH/USD"]];
const disclosure: [string, string, "live" | "preview" | "muted", string][] = [
  ["Lending engine", "Isolated WETH / USDG market · Sourcify verified", "live", "Independent security review by HEY Research Lab"],
  ["Collateral markets", "7 isolated Crypto & RWA Stock markets live onchain", "live", "Expand USDG liquidity depth across BTC & Equity pools"],
  ["Supply & borrow", "Public USDG lending · 8.0% fixed borrow APR", "live", "Dynamic utilization interest curve"],
  ["Price oracle", "Chainlink ETH/BTC/RWA feeds · Ownable2Step adapter", "live", "48h Timelock + multisig oracle ownership"],
  ["Cross-chain flows", "1Click Collateral, 14+ chain Payout & Any-Chain Repay", "live", "Single-signature atomic intent wrapper"],
  ["$LENGO utility token", "0xc256…7eef on RH 4663 · 0% 1Click routing fee tier (≥10k LENGO)", "live", "Staked LENGO borrow APR rebate & risk-param governance"],
  ["Native BTC & ZEC", "In research — not accepted on Mainnet yet", "muted", "Origin-chain lock, proof & redemption"],
  ["Safety rails", "25 WETH beta cap · non-custodial exit always open", "live", "Timelock guardian multisig"],
];
const phases = [
  ["Phase 1", "LIVE", "Lending engine", ["Isolated WETH/USDG market", "RAY debt index + virtual shares", "Live on RH Mainnet (4663)"], 100],
  ["Phase 2", "LIVE", "Position health & risk", ["Chainlink ETH/USD + RWA feeds", "Real-time HF & LT proximity alerts", "Capped TVL + non-custodial pause"], 100],
  ["Phase 3", "LIVE", "Multichain intents", ["Cross-chain collateral inflow", "14+ chain USDC / USDT / DAI payout", "Repay USDG debt from any chain"], 100],
  ["Phase 4", "LIVE", "RWA & BTC markets", ["cbBTC, WBTC & USDe isolated pools", "NVDA, TSLA & AAPL stock markets", "Permissionless USDG lending"], 100],
  ["Phase 5", "RESEARCH", "Native BTC & ZEC", ["Custody + signer model", "Proof and redemption", "Liquidation feasibility"], 10],
] as const;
const contracts = [
  ["LengoMarket.sol", "0x8f1C…5900 + 6 isolated Crypto & RWA Stock markets on RH 4663", "Core"],
  ["ChainlinkOracle.sol", "0xAc89…c6da · Keeperless Chainlink ETH/BTC/RWA adapter", "Oracle"],
  ["$LENGO Token (Mainnet)", "0xc256…7eef · Onchain 0% 1Click routing fee tier & governance", "Utility"],
  ["WETH & RWA Collateral", "WETH, cbBTC, WBTC, USDe, NVDA, TSLA & AAPL isolated collateral", "Asset"],
  ["USDG (Mainnet)", "0x5fc5…d168 · Global Dollar, 6 decimals, borrow & supply", "Asset"],
  ["Indexer / 1Click API", "Neon event read-model + NEAR Intents routing proxy", "Read"],
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
              <span>Mainnet Beta · RH 4663</span>
              <span>Chainlink Oracle · Keeperless</span>
              <span>1Click Payout · Live</span>
            </div>
          </div>
          <aside className={s.colR}><EventStream /></aside>
        </div>
        <Ticker items={tick} />
      </section>

      <section id="twosides" className={s.section}>
        <Head n="00" label="Cross-chain architecture" a="Two sides of lending." b="Collateral origin meets liquidity destination." aside="All 7 isolated Crypto & RWA Stock markets (WETH, cbBTC, WBTC, USDe, NVDA, TSLA, AAPL) are deployed and live on Robinhood Chain Mainnet (4663), with NEAR Intents 1Click routing cross-chain collateral, 14+ chain stablecoin payouts, and any-chain debt repayment. Holding ≥10,000 $LENGO (0xc256…7eef) unlocks 0% app routing fees." />
        <div className={s.split} data-stagger>
          <div className={`${s.side} bevel`}>
            <span className={s.k}>Side A · collateral &amp; RWA markets</span>
            <h3>7 isolated markets on Robinhood Chain</h3>
            <p>Deposit WETH, cbBTC, WBTC, USDe, or tokenized equities (NVDA, TSLA, AAPL) directly on Robinhood Chain — or route collateral from Solana, Base, Arbitrum &amp; Ethereum via NEAR Intents 1Click.</p>
            <div className={s.chips}><i>WETH · Live</i><i>cbBTC · Live</i><i>NVDA · Live</i><i>TSLA · Live</i><i>AAPL · Live</i></div>
          </div>
          <div className={s.core}>
            <span className={s.beam} />
            <Image src="/logo-mark.png" alt="" width={64} height={64} />
            <b>Robinhood Chain</b>
            <small>debt · interest · HF · liquidation</small>
          </div>
          <div className={`${s.side} bevel`}>
            <span className={s.k}>Side B · payout &amp; repay</span>
            <h3>Where you need liquidity</h3>
            <p>Route borrowed USDG into USDC, USDT, or DAI across 14+ chains, or repay USDG debt from any network via NEAR Intents 1Click — verified on Mainnet.</p>
            <div className={s.chips}><i>USDC · Solana</i><i>USDT · Arbitrum</i><i>USDC · Base</i><i>USDT · TON/TRON</i></div>
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
        <Head n="03" label="Liquidation engine" a="Chainlink feed." b="Deterministic liquidation. Proof onchain." aside="Chainlink updates ETH/USD directly on Robinhood Chain. If a borrower's Health Factor drops below 1.00, any liquidator can repay up to 50% of the USDG debt and seize WETH collateral plus a 5% bonus." />
        <div className={s.liq} data-stagger>
          {[["01", "Chainlink round", "Onchain ETH/USD price drop"], ["02", "HF < 1", "Position becomes eligible"], ["03", "Liquidate ≤ 50%", "Liquidator repays USDG"], ["04", "Settle", "WETH + 5% bonus out, debt down"]].map(([n, t, d], i) => (
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
        <Head n="05" label="Disclosure" a="What is live." b="What is next." aside="Every status below reflects what is deployed and verifiable today on Robinhood Chain Mainnet (4663) — zero inflated claims." />
        <div className={`${s.table} bevel`} data-reveal>
          <div className={s.tHead}>
            <span>Capability</span>
            <span><i className={`${s.pill} ${s.pillLive}`}>● Mainnet Beta · 4663</i></span>
            <span><i className={s.pill}>○ Next Milestone</i></span>
          </div>
          {disclosure.map(([cap, nowTxt, tone, nextTxt]) => (
            <div key={cap} className={s.tRow}>
              <span className={s.tCap}>{cap}</span>
              <span className={tone === "muted" ? s.muted : tone === "preview" ? s.tPrev : s.tLive}>
                <i className={s.tDot} />
                {nowTxt}
              </span>
              <span className={s.muted}>{nextTxt}</span>
            </div>
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
          <p>Supply USDG, deposit WETH collateral, route payouts across chains via NEAR Intents, and verify every tx on Robinhood Chain.</p>
        </div>
        <div className={`${s.ctaBtns} bevel`}>
          <a href="https://robinhoodchain.blockscout.com/address/0x8f1CDFEa078D84d0a2f974c658f71CF4B54c5900" target="_blank" rel="noreferrer" className="btn">RH Mainnet explorer ↗</a>
          <Link href="/app" className="btn btn-primary">Launch app →</Link>
        </div>
      </section>

      <footer className={`${s.foot} bevel`}>
        <Link href="/app">Markets</Link><Link href="/app/positions">Positions</Link><Link href="/app/routes">Routes</Link><Link href="/app/activity">Activity</Link><Link href="/docs">Docs</Link><a href="https://robinhoodchain.blockscout.com/address/0x8f1CDFEa078D84d0a2f974c658f71CF4B54c5900" target="_blank" rel="noreferrer">Contract · 0x8f1C…5900</a><a href="https://x.com/lengoapp" target="_blank" rel="noreferrer">X · @lengoapp</a>
        <span>Robinhood Chain · Mainnet Beta</span><span className={s.status}>Mainnet Beta · 4663 <i /></span>
      </footer>
    </div>
  );
}
