"use client";
import { useEffect, useState } from "react";
import s from "./bento.module.css";

function useTick(ms: number) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setT((x) => x + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
  return t;
}
const rnd = (seed: number) => { const x = Math.sin(seed * 9301 + 49297) * 233280; return x - Math.floor(x); };

function Pixels() {
  const t = useTick(220);
  return (
    <div className={s.pixels}>
      {Array.from({ length: 96 }, (_, i) => {
        const v = rnd(i * 7 + t);
        return <i key={i} style={{ opacity: v > 0.82 ? 1 : v > 0.6 ? 0.35 : 0.08 }} />;
      })}
    </div>
  );
}
function Hist() {
  const t = useTick(900);
  return (
    <div className={s.hist}>
      {Array.from({ length: 22 }, (_, i) => {
        const base = Math.exp(-((i - 11) ** 2) / 30);
        const h = Math.round(12 + base * 80 + rnd(i + t * 3) * 14);
        return <i key={i} style={{ height: `${h}%`, backgroundColor: i < 4 ? "var(--red)" : i < 7 ? "var(--amber)" : "var(--tx2)" }} />;
      })}
    </div>
  );
}
function Matrix() {
  const t = useTick(140);
  const col = t % 14;
  return (
    <div className={s.matrix}>
      {Array.from({ length: 14 * 9 }, (_, i) => {
        const c = i % 14;
        const d = Math.abs(c - col);
        return <i key={i} style={{ opacity: d === 0 ? 1 : d === 1 ? 0.45 : rnd(i) > 0.7 ? 0.18 : 0.06 }} />;
      })}
    </div>
  );
}
function Block() {
  const t = useTick(2000);
  return <b className={s.big}>{(18204117 + t).toLocaleString("en-US")}</b>;
}

const quotes = [["USDG→USDC", "solana", "dry"], ["BTC→USDC", "base", "dry"], ["ZEC→USDC", "arbitrum", "n/a"], ["SOL→USDG", "hood", "dry"], ["USDG→USDC", "ethereum", "dry"]];

export default function Bento() {
  const t = useTick(1400);
  return (
    <div className={`${s.wrap} bevel`}>
      <div className={s.top}><span>LENGO / LENDING TERMINAL</span><span className={s.live}><i />LIVE · SIMULATED</span></div>
      <div className={s.grid}>
        <section className={`${s.cell} ${s.a}`}>
          <h4>Incoming intents</h4>
          <Pixels />
          <ul className={s.list}>
            {["deposit 0.1000 tBTC", "borrow 4,000 tUSDC", "quote BTC→USDC", "topup 0.0200 tBTC"].map((x, i) => (
              <li key={x} className={i === t % 4 ? s.hot : ""}><span>INTENT</span>{x}</li>
            ))}
          </ul>
        </section>
        <section className={`${s.cell} ${s.b}`}>
          <h4>Payout router · 1click</h4>
          <ul className={s.list}>
            {quotes.map(([p, c, m], i) => (
              <li key={p + c} className={i === t % 5 ? s.hot : ""}><span>{m.toUpperCase()}</span>{p}<em>{c}</em></li>
            ))}
          </ul>
          <p className={s.foot}>Route preview · no funds moved</p>
        </section>
        <section className={`${s.cell} ${s.c}`}>
          <h4>Health factor distribution</h4>
          <Hist />
          <div className={s.axis}><span>&lt;1.0</span><span>1.3</span><span>2.0</span><span>3.0+</span></div>
        </section>
        <section className={`${s.cell} ${s.d}`}>
          <h4>Risk guard</h4>
          {[["Max LTV 60%", "ENFORCED"], ["Oracle ≤ 300s", "FRESH"], ["Pool liquidity", "OK"], ["Close factor 50%", "ARMED"]].map(([k, v]) => (
            <div key={k} className={s.check}><span>{k}</span><em>{v}</em></div>
          ))}
          <div className={s.count}><span>Checks</span><b>4</b></div>
        </section>
        <section className={`${s.cell} ${s.e}`}>
          <h4>Liquidation engine</h4>
          <Matrix />
          <p className={s.foot}>Scanning positions · HF &lt; 1 eligible</p>
        </section>
        <section className={`${s.cell} ${s.f}`}>
          <h4>Robinhood chain · ledger</h4>
          <span className={s.k}>Block</span>
          <Block />
          <div className={s.kv}>
            <span>Chain</span><b>46630</b>
            <span>Market</span><b>tBTC/tUSDC</b>
            <span>Debt index</span><b>1.000{(t % 90).toString().padStart(2, "0")}</b>
            <span>APR</span><b>8.00%</b>
          </div>
        </section>
      </div>
      <div className={s.bottom}><span>INTENT / ROUTE / LEND</span><span>RISK / LIQUIDATE</span><span>SETTLE ON RH</span></div>
    </div>
  );
}
