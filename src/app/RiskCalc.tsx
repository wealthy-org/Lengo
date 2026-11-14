"use client";
import { useState } from "react";
import s from "./landing.module.css";

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

export default function RiskCalc() {
  const [c, setC] = useState(10000);
  const [d, setD] = useState(4000);
  const ltv = d / c;
  const hf = d ? (c * 0.75) / d : Infinity;
  const cap = Math.max(0, c * 0.6 - d);
  const qty = c / 100000;
  const liq = d ? d / (qty * 0.75) : null;
  const tone = hf === Infinity || hf >= 1.3 ? "var(--lime)" : hf >= 1.15 ? "var(--amber)" : "var(--red)";
  return (
    <div className={s.calc}>
      <div className={s.calcIn}>
        <label>
          <span>Collateral value <b>{usd(c)}</b></span>
          <input type="range" min={1000} max={20000} step={100} value={c} onChange={(e) => setC(+e.target.value)} />
        </label>
        <label>
          <span>Debt incl. interest <b>{usd(d)}</b></span>
          <input type="range" min={0} max={15000} step={100} value={d} onChange={(e) => setD(+e.target.value)} />
        </label>
        <p>Fixture from the brief: $10,000 collateral, $4,000 debt. Drag to see where liquidation starts.</p>
      </div>
      <div className={s.calcOut}>
        <div><span>LTV</span><b>{(ltv * 100).toFixed(1)}%</b></div>
        <div><span>Health factor</span><b style={{ color: tone }}>{hf === Infinity ? "No debt" : hf.toFixed(3)}</b></div>
        <div><span>Extra borrow capacity</span><b>{usd(cap)}</b></div>
        <div><span>Est. liquidation price</span><b>{liq ? usd(liq) : "No debt"}</b></div>
        <div className={s.calcState} style={{ color: tone }}>
          {hf === Infinity ? "No debt, nothing to liquidate" : hf < 1 ? "Eligible for liquidation" : hf < 1.15 ? "Danger zone, top up or repay" : hf < 1.3 ? "Warning zone" : "Healthy"}
        </div>
      </div>
    </div>
  );
}
