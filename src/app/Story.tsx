"use client";
import { useEffect, useRef, useState } from "react";
import s from "./story.module.css";

const steps = [
  { k: "DEPOSIT", t: "Deposit", d: "Approve the exact amount to the market contract, then lock tBTC. The contract reads the balance it actually received.", pub: "Your address, the asset and the amount are public.", big: "0.1000", unit: "tBTC", from: "connected wallet", to: "LengoMarket", meta: "allowance: exact amount" },
  { k: "BORROW", t: "Borrow", d: "Pick an amount inside 60% max LTV. HF, LTV, interest and liquidation price update before you sign.", pub: "tUSDC lands in your wallet on Robinhood Chain Testnet.", big: "4,000", unit: "tUSDC", from: "pool liquidity", to: "your wallet", meta: "HF 1.875 · LTV 40%" },
  { k: "ROUTE", t: "Route", d: "Preview what the payout would look like on another chain through NEAR Intents 1Click route simulation.", pub: "Quote preview only. No funds move, no deposit address.", big: "≈ USDC", unit: "Solana", from: "USDG · hood", to: "USDC · solana", meta: "status: preview" },
  { k: "REPAY", t: "Repay & exit", d: "Repay part or Repay All with accrued interest and zero dust. Then withdraw every tBTC that is still yours.", pub: "Debt to zero, collateral back, all on the explorer.", big: "0.00", unit: "debt", from: "your wallet", to: "LengoMarket", meta: "withdraw all · unlocked" },
];

export default function Story() {
  const [i, setI] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) setI(Number((e.target as HTMLElement).dataset.i)); }), { rootMargin: "-45% 0px -45% 0px" });
    refs.current.forEach((r) => r && io.observe(r));
    let id: ReturnType<typeof setInterval> | undefined;
    if (window.innerWidth <= 900) id = setInterval(() => setI((x) => (x + 1) % steps.length), 3200);
    return () => { io.disconnect(); if (id) clearInterval(id); };
  }, []);
  const st = steps[i];
  return (
    <div className={s.wrap}>
      <div className={s.sticky}>
        <div className={s.head}><h3>How a loan moves</h3><span>{String(i + 1).padStart(2, "0")} / 04</span></div>
        <div className={s.body}>
          <div className={s.copy}>
            <div className={s.tabs}>{steps.map((x, k) => <span key={x.k} className={k === i ? s.on : ""}>{x.k}</span>)}</div>
            <h4 key={st.t} className={s.swap}>{st.t}</h4>
            <p key={st.d} className={s.swap}>{st.d}</p>
            <small>{st.pub}</small>
          </div>
          <div className={`${s.card} bevel`} key={st.k}>
            <div className={s.row}><span>from {st.from}</span><span>testnet</span></div>
            <div className={s.amt}><b>{st.big}</b><span>{st.unit}</span></div>
            <div className={s.rail}>{steps.map((_, k) => <i key={k} className={k <= i ? s.lit : ""} />)}</div>
            <div className={s.row}><span>{st.meta}</span><span>→ {st.to}</span></div>
          </div>
        </div>
      </div>
      <div className={s.triggers}>{steps.map((_, k) => <div key={k} data-i={k} ref={(el) => { refs.current[k] = el; }} />)}</div>
    </div>
  );
}
