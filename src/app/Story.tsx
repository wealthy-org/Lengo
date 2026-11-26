"use client";
import { useEffect, useRef, useState } from "react";
import s from "./story.module.css";

const steps = [
  { k: "DEPOSIT", t: "Deposit", d: "Approve the exact amount to LengoMarket, then lock WETH collateral on Robinhood Chain Mainnet.", pub: "Your address, collateral, and tx hash are verifiable on Blockscout.", big: "2.0000", unit: "WETH", from: "connected wallet", to: "LengoMarket", meta: "allowance: exact amount" },
  { k: "BORROW", t: "Borrow", d: "Pick an amount inside 60% max LTV. Health Factor, LTV, interest, and liquidation price update before you sign.", pub: "USDG lands directly in your wallet on Robinhood Chain (4663).", big: "1,360", unit: "USDG", from: "pool liquidity", to: "your wallet", meta: "HF 1.875 · LTV 40%" },
  { k: "ROUTE", t: "Route", d: "Route borrowed USDG on Robinhood Chain directly into USDC on Solana or Base via NEAR Intents 1Click.", pub: "Live end-to-end settlement verified on Robinhood Chain & Solana Mainnet.", big: "USDC", unit: "Solana", from: "USDG · hood", to: "USDC · solana", meta: "status: live" },
  { k: "REPAY", t: "Repay & exit", d: "Repay part or Repay All with accrued interest and zero dust. Then withdraw every WETH that is yours.", pub: "Debt to zero, collateral back, all verified on the explorer.", big: "0.00", unit: "debt", from: "your wallet", to: "LengoMarket", meta: "withdraw all · unlocked" },
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
            <div className={s.row}><span>from {st.from}</span><span>mainnet · 4663</span></div>
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
