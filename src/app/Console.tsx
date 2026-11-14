"use client";
import { TokenIcon } from "./TokenIcon";
import { useEffect, useRef, useState } from "react";
import s from "./console.module.css";

const assets = [
  { sym: "tBTC", name: "tBTC / tUSDC", st: "ACTIVE", note: "testnet", c: "#f2a93b" },
  { sym: "BTC", name: "BTC · Bitcoin", st: "SPIKE", note: "M5", c: "#f2a93b" },
  { sym: "ZEC", name: "ZEC · Zcash", st: "RESEARCH", note: "next", c: "#e8c46b" },
  { sym: "SOL", name: "SOL · Solana", st: "RESEARCH", note: "next", c: "#9b8cf2" },
  { sym: "USDG", name: "USDG · hood", st: "PREVIEW", note: "payout", c: "#7fe0b4" },
  { sym: "USDC", name: "USDC · Solana", st: "PREVIEW", note: "payout", c: "#7fb6f2" },
];
export function MarketList() {
  return (
    <div className={`${s.panel} bevel`}>
      <div className={s.head}><span>COLLATERAL</span><span>6 TRACKED</span></div>
      {assets.map((a) => (
        <div key={a.name} className={s.asset}>
          <TokenIcon sym={a.sym} size={24} />
          <div><b>{a.name}</b><small>{a.note}</small></div>
          <em className={a.st === "ACTIVE" ? s.on : ""}>{a.st}</em>
        </div>
      ))}
      <div className={s.foot}><span className="dot" /> ORACLE FRESH · 300S WINDOW</div>
    </div>
  );
}

const kinds = ["DEPOSIT", "BORROW", "REPAY", "QUOTE", "TOPUP", "WITHDRAW"];
const hex = () => "0x" + Math.random().toString(16).slice(2, 6) + "…" + Math.random().toString(16).slice(2, 6);
type Ev = { id: number; k: string; h: string; b: number; amt: string };
export function EventStream() {
  const [evs, setEvs] = useState<Ev[]>([]);
  const n = useRef(0);
  useEffect(() => {
    const mk = (): Ev => {
      const k = kinds[(Math.random() * kinds.length) | 0];
      return { id: n.current++, k, h: hex(), b: 18204117 + n.current, amt: k === "DEPOSIT" || k === "TOPUP" || k === "WITHDRAW" ? (Math.random() * 0.3).toFixed(4) + " tBTC" : k === "QUOTE" ? "dry:true" : (Math.random() * 5000).toFixed(0) + " tUSDC" };
    };
    setEvs(Array.from({ length: 7 }, mk));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setEvs((e) => [mk(), ...e].slice(0, 7)), 1800);
    return () => clearInterval(id);
  }, []);
  return (
    <div className={`${s.panel} bevel`}>
      <div className={s.head}><span>EVENT STREAM</span><span className={s.on}>● SIMULATED</span></div>
      {evs.map((e, i) => (
        <div key={e.id} className={`${s.ev} ${i === 0 ? s.evNew : ""}`}>
          <span className={s.blk}>{e.b}</span>
          <div><b>{e.k}</b><small>{e.h} · {e.amt}</small></div>
          <em>{e.k === "QUOTE" ? "PREVIEW" : "OK"}</em>
        </div>
      ))}
      <div className={s.foot}>CHAIN 46630 · RH TESTNET</div>
    </div>
  );
}
