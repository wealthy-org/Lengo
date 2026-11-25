"use client";
import { TokenIcon } from "./TokenIcon";
import { useEffect, useRef, useState } from "react";
import s from "./console.module.css";

const assets = [
  { sym: "WETH", name: "WETH / USDG", st: "ACTIVE", note: "Crypto · 60% LTV", c: "#627eea" },
  { sym: "cbBTC", name: "cbBTC / USDG", st: "ACTIVE", note: "Crypto · 65% LTV", c: "#f2a93b" },
  { sym: "WBTC", name: "WBTC / USDG", st: "ACTIVE", note: "Crypto · 65% LTV", c: "#f2a93b" },
  { sym: "USDe", name: "USDe / USDG", st: "ACTIVE", note: "Ethena · 80% LTV", c: "#8ab4f8" },
  { sym: "NVDA", name: "NVDA / USDG", st: "ACTIVE", note: "RH Stock · 24/7", c: "#76b900" },
  { sym: "TSLA", name: "TSLA / USDG", st: "ACTIVE", note: "RH Stock · 24/7", c: "#e82127" },
  { sym: "AAPL", name: "AAPL / USDG", st: "ACTIVE", note: "RH Stock · Equity", c: "#d4d8dc" },
  { sym: "USDG", name: "USDG → USDC", st: "LIVE", note: "1Click Cross-Chain", c: "#7fe0b4" },
];
export function MarketList() {
  return (
    <div className={`${s.panel} bevel`}>
      <div className={s.head}><span>COLLATERAL & ROUTES</span><span>{assets.length} TRACKED</span></div>
      {assets.map((a) => (
        <div key={a.name} className={s.asset}>
          <TokenIcon sym={a.sym} size={24} />
          <div><b>{a.name}</b><small>{a.note}</small></div>
          <em className={a.st === "ACTIVE" || a.st === "LIVE" ? s.on : ""}>{a.st}</em>
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
      return { id: n.current++, k, h: hex(), b: 122321000 + n.current, amt: k === "DEPOSIT" || k === "TOPUP" || k === "WITHDRAW" ? (Math.random() * 1.5 + 0.05).toFixed(3) + " WETH" : k === "QUOTE" ? "USDG → USDC" : (Math.random() * 2000 + 50).toFixed(0) + " USDG" };
    };
    setEvs(Array.from({ length: 7 }, mk));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setEvs((e) => [mk(), ...e].slice(0, 7)), 1800);
    return () => clearInterval(id);
  }, []);
  return (
    <div className={`${s.panel} bevel`}>
      <div className={s.head}><span>EVENT STREAM</span><span className={s.on}>● MAINNET BETA</span></div>
      {evs.map((e, i) => (
        <div key={e.id} className={`${s.ev} ${i === 0 ? s.evNew : ""}`}>
          <span className={s.blk}>{e.b}</span>
          <div><b>{e.k}</b><small>{e.h} · {e.amt}</small></div>
          <em>{e.k === "QUOTE" ? "1CLICK" : "OK"}</em>
        </div>
      ))}
      <div className={s.foot}>CHAIN 4663 · ROBINHOOD MAINNET</div>
    </div>
  );
}
