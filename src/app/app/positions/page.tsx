"use client";
import Link from "next/link";
import { useState } from "react";
import { Pair } from "../../TokenIcon";
import s from "../trade.module.css";
import p from "./positions.module.css";
import { usePortfolio, type MarketHealthRow } from "@/lib/usePortfolio";
import { addrUrl } from "@/lib/chain";

const usd = (n: number, d = 2) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const hfTxt = (h: number) => (h === Infinity ? "No debt" : h.toFixed(2));
const tone = (h: number) => (h === Infinity || h >= 1.3 ? s.ok : h >= 1.15 ? s.warn : s.bad);

type FilterTab = "All" | "My Positions" | "Crypto" | "RWA Stocks";

export default function PositionsPage() {
  const P = usePortfolio();
  const [tab, setTab] = useState<FilterTab>("All");
  const [shockPct, setShockPct] = useState<number>(0); // 0, -15, -30, -45

  const applyShock = (r: MarketHealthRow) => {
    const mult = 1 + shockPct / 100;
    const simPrice = r.price * mult;
    const simCollUsd = r.coll * simPrice;
    const simHf = r.debt <= 0 ? Infinity : (simCollUsd * r.spec.liqThreshold) / r.debt;
    const simLtv = simCollUsd > 0 ? r.debt / simCollUsd : 0;
    const simRoom = Math.max(0, Math.min(simCollUsd * r.spec.maxLtv - r.debt, r.poolAvailable));
    return { simPrice, simCollUsd, simHf, simLtv, simRoom };
  };

  const atRiskRows = P.rows.filter((r) => {
    const { simHf } = applyShock(r);
    return r.debt > 0 && simHf < 1.3;
  });
  const worstRow = atRiskRows.sort((a, b) => applyShock(a).simHf - applyShock(b).simHf)[0];

  const filtered = P.rows.filter((r) => {
    if (tab === "My Positions") return r.coll > 0 || r.debt > 0 || r.lenderClaim > 0;
    if (tab === "Crypto") return r.spec.category === "Crypto" || r.spec.category === "Stable" || r.spec.category === "Testnet";
    if (tab === "RWA Stocks") return r.spec.category === "Robinhood Stock";
    return true;
  });

  return (
    <>
      <div className={s.pageHead}>
        <div>
          <h1>Position Health</h1>
          <p>
            Real-time Health Factor, Liquidation Price, and remaining borrow room across crypto &amp; RWA stock markets — read directly from onchain contracts.
          </p>
        </div>
        <span>
          {P.isMainnet ? `Robinhood Chain Mainnet · 4663 · ${P.rows.length} Isolated Markets` : "Robinhood Chain Testnet · 46630"}
        </span>
      </div>

      {/* Portfolio Summary Strip */}
      <div className={`${p.summary} bevel`}>
        <div>
          <span>Total Collateral</span>
          <b>{P.loading ? <span className="skel skel-lg" /> : usd(P.totals.collUsd)}</b>
          <small>{P.loading ? <span className="skel skel-sm" /> : `${P.totals.activeCount} active position${P.totals.activeCount === 1 ? "" : "s"}`}</small>
        </div>
        <div>
          <span>Outstanding Debt</span>
          <b>{P.loading ? <span className="skel skel-lg" /> : usd(P.totals.debtUsd)}</b>
          <small>USDG · accrued RAY index</small>
        </div>
        <div>
          <span>Remaining Borrow Room</span>
          <b className={s.ok}>{P.loading ? <span className="skel skel-lg" /> : usd(P.totals.borrowRoomUsd)}</b>
          <small>inside market Max LTV &amp; pool liquidity</small>
        </div>
        <div>
          <span>Lowest Health Factor</span>
          <b className={tone(P.totals.minHf)}>{P.loading ? <span className="skel skel-md" /> : hfTxt(P.totals.minHf)}</b>
          <small>liquidatable below 1.00</small>
        </div>
        <div>
          <span>Lender Supply Claim</span>
          <b>{P.loading ? <span className="skel skel-lg" /> : usd(P.totals.lenderClaimUsd)}</b>
          <small>withdrawable idle USDG</small>
        </div>
        <div>
          <span>$LENGO Fee Tier</span>
          <b className={P.hasLengoTier ? s.ok : ""}>
            {P.loading ? <span className="skel skel-md" /> : P.hasLengoTier ? "0% Fee Tier" : `${P.lengoBal.toFixed(0)} LENGO`}
          </b>
          <small>
            <a href="https://robinhoodchain.blockscout.com/token/0xc256e0fb1f93164b8e499746bba593a8e40a7eef" target="_blank" rel="noreferrer">
              ≥10k LENGO · 0% 1Click fee ↗
            </a>
          </small>
        </div>
      </div>

      {/* Visual LT Proximity Warning Banner */}
      {worstRow && (() => {
        const sim = applyShock(worstRow);
        const crit = sim.simHf < 1.15;
        return (
          <div className={`${p.alertBox} ${crit ? p.alertCrit : ""} bevel`} role="alert">
            <div>
              <strong className={crit ? s.bad : s.warn}>
                {sim.simHf < 1.0
                  ? `⚠ LIQUIDATION THRESHOLD BREACHED · ${worstRow.spec.pair}`
                  : crit
                    ? `⚠ CRITICAL LT PROXIMITY · ${worstRow.spec.pair} (HF ${sim.simHf.toFixed(2)})`
                    : `● APPROACHING LIQUIDATION THRESHOLD · ${worstRow.spec.pair} (HF ${sim.simHf.toFixed(2)})`}
              </strong>
              <p>
                {shockPct < 0 ? `Under a ${shockPct}% price move, ` : ""}
                {worstRow.spec.collSymbol} LTV reaches <b>{(sim.simLtv * 100).toFixed(1)}%</b> against a{" "}
                <b>{Math.round(worstRow.spec.liqThreshold * 100)}% LT</b> (liquidation price{" "}
                <b>{usd(worstRow.liqPrice, worstRow.price >= 1000 ? 0 : 2)}</b>). Repay USDG or add collateral to restore safety buffer.
              </p>
            </div>
            <div className={p.actions}>
              <Link href={`/app?market=${worstRow.spec.id}&act=Repay`} className={p.actPrimary}>
                Repay {worstRow.spec.debtSymbol} →
              </Link>
              <Link href={`/app/routes?preset=repay&mode=live`}>
                Repay from Any Chain →
              </Link>
              <Link href={`/app?market=${worstRow.spec.id}&act=Deposit`}>
                Top-Up {worstRow.spec.collSymbol}
              </Link>
            </div>
          </div>
        );
      })()}

      {/* Filter & Price Shock Simulator Toolbar */}
      <div className={`${p.toolbar} bevel`}>
        <div className={p.tabs}>
          {(["All", "My Positions", "Crypto", "RWA Stocks"] as FilterTab[]).map((t) => (
            <button key={t} className={tab === t ? p.tabOn : ""} onClick={() => setTab(t)}>
              {t === "RWA Stocks" ? "RWA Stocks (NVDA · TSLA · AAPL)" : t}
            </button>
          ))}
        </div>
        <div className={p.shock}>
          <span>Stress shock:</span>
          {[0, -15, -30, -45].map((sh) => (
            <button key={sh} className={shockPct === sh ? p.shockOn : ""} onClick={() => setShockPct(sh)}>
              {sh === 0 ? "Live (0%)" : `${sh}%`}
            </button>
          ))}
        </div>
      </div>

      {/* Market Health Grid */}
      {P.loading ? (
        <div className={p.grid}>
          {Array.from({ length: 4 }).map((_, idx) => (
            <section key={idx} className={`${p.card} bevel`} style={{ padding: 20, gap: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="skel skel-lg" />
                <span className="skel skel-sm" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
                <span className="skel skel-row" style={{ height: 42 }} />
                <span className="skel skel-row" style={{ height: 42 }} />
                <span className="skel skel-row" style={{ height: 42 }} />
                <span className="skel skel-row" style={{ height: 42 }} />
              </div>
              <span className="skel skel-row" style={{ height: 22 }} />
            </section>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div key={tab} className={`${p.card} bevel pane-swap`} style={{ padding: 28, textAlign: "center" }}>
          <p style={{ color: "var(--tx2)", fontSize: 14 }}>
            {P.isConnected
              ? "No active collateral or lender positions in this filter yet."
              : "Connect your wallet to inspect live Health Factor, Liquidation Price, and borrow headroom across all markets."}
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 14 }}>
            <Link href="/app" className="btn btn-primary">Open Markets →</Link>
            <Link href="/app/routes?preset=collateral&mode=live" className="btn">Deposit Cross-Chain Collateral →</Link>
          </div>
        </div>
      ) : (
        <div key={`${tab}:${shockPct}`} className={`${p.grid} pane-swap`}>
          {filtered.map((r) => {
            const { simPrice, simCollUsd, simHf, simLtv, simRoom } = applyShock(r);
            const digits = r.price >= 1000 ? 0 : 2;
            const maxPct = (r.spec.maxLtv / 0.95) * 100;
            const liqPct = (r.spec.liqThreshold / 0.95) * 100;
            const curPct = Math.min(100, (simLtv / 0.95) * 100);
            const hasPos = r.coll > 0 || r.debt > 0;
            const cardCls =
              r.debt > 0 && simHf < 1.15
                ? p.cardCrit
                : r.debt > 0 && simHf < 1.3
                  ? p.cardWarn
                  : hasPos
                    ? p.cardActive
                    : "";

            return (
              <section key={r.spec.id} className={`${p.card} ${cardCls} bevel`}>
                <div className={p.cHead}>
                  <Pair a={r.spec.collSymbol} b={r.spec.debtSymbol} size={36} />
                  <div>
                    <h3>{r.spec.pair}</h3>
                    <small>
                      {r.spec.category} · Max LTV {Math.round(r.spec.maxLtv * 100)}% · LT {Math.round(r.spec.liqThreshold * 100)}% · {(r.spec.apr * 100).toFixed(1)}% APR
                    </small>
                  </div>
                  <div className={p.tags}>
                    <em style={{ color: "var(--lime)", borderColor: "rgba(201,242,122,.4)" }}>
                      {r.isPoolLive ? "Live" : "Live · Open"}
                    </em>
                    {hasPos && (
                      <em className={tone(simHf)}>
                        {simHf === Infinity ? "Collateral Only" : simHf < 1 ? "Liquidatable" : simHf < 1.3 ? "Near LT" : "Healthy"}
                      </em>
                    )}
                  </div>
                </div>

                <div className={p.metrics}>
                  <div>
                    <span>Health Factor</span>
                    <b className={tone(simHf)}>{hfTxt(simHf)}</b>
                    <small>{r.debt > 0 ? `${r.dropToLiqPct.toFixed(1)}% drop buffer` : `LT ${Math.round(r.spec.liqThreshold * 100)}%`}</small>
                  </div>
                  <div>
                    <span>Liquidation Price</span>
                    <b>{r.liqPrice > 0 ? usd(r.liqPrice, digits) : "No debt"}</b>
                    <small>Oracle {usd(simPrice, digits)}{shockPct < 0 ? ` (${shockPct}%)` : ""}</small>
                  </div>
                  <div>
                    <span>Borrow Room Left</span>
                    <b className={simRoom > 0 ? s.ok : ""}>{usd(simRoom)}</b>
                    <small>Pool avail {usd(r.poolAvailable)}</small>
                  </div>
                  <div>
                    <span>Position (Coll / Debt)</span>
                    <b>{r.coll > 0 ? `${r.coll.toFixed(4)} ${r.spec.collSymbol}` : `0 ${r.spec.collSymbol}`}</b>
                    <small>{usd(simCollUsd)} · Debt {usd(r.debt)}</small>
                  </div>
                </div>

                <div className={p.gaugeWrap}>
                  <div className={p.gaugeTop}>
                    <span>
                      LTV: <b style={{ color: "var(--tx)" }}>{(simLtv * 100).toFixed(2)}%</b>
                    </span>
                    <span>
                      Max {Math.round(r.spec.maxLtv * 100)}% · Liq Threshold {Math.round(r.spec.liqThreshold * 100)}%
                    </span>
                  </div>
                  <div className={s.bar}>
                    <span className={s.zoneSafe} style={{ width: `${maxPct}%` }} />
                    <span className={s.zoneWarn} style={{ left: `${maxPct}%`, width: `${liqPct - maxPct}%` }} />
                    <span className={s.zoneLiq} style={{ left: `${liqPct}%` }} />
                    <i style={{ width: `${curPct}%` }} />
                    <em style={{ left: `${maxPct}%` }}>MAX {Math.round(r.spec.maxLtv * 100)}%</em>
                    <em style={{ left: `${liqPct}%` }} className={s.bad}>LT {Math.round(r.spec.liqThreshold * 100)}%</em>
                  </div>
                </div>

                <div className={p.cFoot}>
                  <span>
                    Wallet: {r.walletColl.toFixed(4)} {r.spec.collSymbol}
                    {r.lenderClaim > 0 ? ` · Supply claim ${usd(r.lenderClaim)}` : ""} ·{" "}
                    <a
                      href={addrUrl(r.spec.market ?? r.spec.collateral, P.net.mode)}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "var(--tx2)" }}
                    >
                      Contract ↗
                    </a>
                  </span>
                  <div className={p.actions}>
                    {!r.isPoolLive && (
                      <Link href={`/app?market=${r.spec.id}&mode=Lend`} className={p.actPrimary}>
                        Supply USDG →
                      </Link>
                    )}
                    <Link href={`/app?market=${r.spec.id}&act=Deposit`} className={r.isPoolLive && !hasPos ? p.actPrimary : ""}>
                      Deposit {r.spec.collSymbol}
                    </Link>
                    {r.isPoolLive && (
                      <Link href={`/app?market=${r.spec.id}&act=Borrow`}>
                        Borrow USDG
                      </Link>
                    )}
                    {r.debt > 0 && (
                      <>
                        <Link href={`/app?market=${r.spec.id}&act=Repay`} className={p.actPrimary}>
                          Repay
                        </Link>
                        <Link href={`/app/routes?preset=repay&mode=live&amt=${(r.debt * 1.005).toFixed(2)}`}>
                          Cross-Chain Repay ↗
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
