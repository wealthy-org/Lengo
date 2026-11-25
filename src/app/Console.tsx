"use client";
import { TokenIcon } from "./TokenIcon";
import { useEffect, useState } from "react";
import s from "./console.module.css";

const assets = [
  { sym: "WETH", name: "WETH / USDG", st: "ACTIVE", note: "Crypto · 60% LTV", c: "#627eea" },
  { sym: "cbBTC", name: "cbBTC / USDG", st: "SEEDING", note: "Crypto · 65% LTV", c: "#f2a93b" },
  { sym: "WBTC", name: "WBTC / USDG", st: "SEEDING", note: "Crypto · 65% LTV", c: "#f2a93b" },
  { sym: "USDe", name: "USDe / USDG", st: "SEEDING", note: "Ethena · 80% LTV", c: "#8ab4f8" },
  { sym: "NVDA", name: "NVDA / USDG", st: "SEEDING", note: "RH Stock · 24/7", c: "#76b900" },
  { sym: "TSLA", name: "TSLA / USDG", st: "SEEDING", note: "RH Stock · 24/7", c: "#e82127" },
  { sym: "AAPL", name: "AAPL / USDG", st: "SEEDING", note: "RH Stock · Equity", c: "#d4d8dc" },
  { sym: "USDG", name: "USDG → USDC", st: "PREVIEW", note: "1Click · v1 Rollout", c: "#7fe0b4" },
];

export function MarketList() {
  return (
    <div className={`${s.panel} bevel`}>
      <div className={s.head}><span>COLLATERAL &amp; ROUTES</span><span>{assets.length} DEPLOYED</span></div>
      {assets.map((a) => (
        <div key={a.name} className={s.asset}>
          <TokenIcon sym={a.sym} size={24} />
          <div><b>{a.name}</b><small>{a.note}</small></div>
          <em className={a.st === "ACTIVE" ? s.on : ""}>{a.st}</em>
        </div>
      ))}
      <div className={s.foot}><span className="dot" /> CHAINLINK · 7200S HEARTBEAT</div>
    </div>
  );
}

const EXPLORER_TX = "https://robinhoodchain.blockscout.com/tx/";

const verifiedProofs = [
  { k: "WITHDRAW", b: "122,705,887", h: "0x1123…a2f7", full: "0x1123391fe9d0a87e5c2146b2cb577573b022bc48dbc31f1f37ff625e0416a2f7", amt: "0.0007 WETH", tag: "TX ↗" },
  { k: "REPAY",    b: "122,705,471", h: "0xabdb…5bcb", full: "0xabdb082cf3c0fd5fd1875f616b0b4fa3b71bd7f3ac811157edffd4ad32725bcb", amt: "0.50 USDG", tag: "TX ↗" },
  { k: "BORROW",   b: "122,705,021", h: "0x5735…5f4d", full: "0x57356f96ef1e9bebc9345de9530628c919faf2f9348c082f83b62cb240435f4d", amt: "0.50 USDG", tag: "TX ↗" },
  { k: "DEPOSIT",  b: "122,704,649", h: "0x4ff7…6b98", full: "0x4ff7f8d8c6c72ede29a11b76ffddca948c662f57d4eb220a8e34654fde9d6b98", amt: "0.0007 WETH", tag: "TX ↗" },
  { k: "SUPPLY",   b: "122,693,997", h: "0x0488…f0d7", full: "0x04887e2dd03391090f3f90eb170bba562955d76122e24bdafb2fbf73f715f0d7", amt: "2.00 USDG", tag: "TX ↗" },
  { k: "DEPOSIT",  b: "122,371,051", h: "0x3fe6…7244", full: "0x3fe623a1df58f27027d14fe409074092b3bc9197cbeafc558c4c7980ee987244", amt: "0.0010 WETH", tag: "TX ↗" },
  { k: "ROUTE",    b: "122,728,673", h: "0x9932…409c", full: "0x9932efbe8bcacc06c39536a5413d3dc755e7834ab4bd45ee6780b3098c02409c", amt: "1Click deposit", tag: "1CLICK ↗" },
];

export function EventStream() {
  const [hot, setHot] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setHot((x) => (x + 1) % verifiedProofs.length), 2400);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={`${s.panel} bevel`}>
      <div className={s.head}><span>ONCHAIN PROOFS</span><span className={s.on}>● MAINNET BETA</span></div>
      {verifiedProofs.map((e, i) => (
        <a
          key={e.full}
          href={`${EXPLORER_TX}${e.full}`}
          target="_blank"
          rel="noreferrer"
          className={`${s.ev} ${i === hot ? s.evHot : ""}`}
          title={`Verify ${e.k} (${e.h}) on Blockscout`}
        >
          <span className={s.blk}>{e.b}</span>
          <div><b>{e.k}</b><small>{e.h} · {e.amt}</small></div>
          <em className={i === hot ? s.on : ""}>{e.tag}</em>
        </a>
      ))}
      <div className={s.foot}>CHAIN 4663 · VERIFIED BLOCKSCOUT</div>
    </div>
  );
}
