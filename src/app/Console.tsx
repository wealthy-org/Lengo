"use client";
import { TokenIcon } from "./TokenIcon";
import { useEffect, useState } from "react";
import s from "./console.module.css";

const assets = [
  { sym: "WETH", name: "WETH / USDG", st: "LIVE", note: "Crypto · 60% LTV", c: "#627eea" },
  { sym: "cbBTC", name: "cbBTC / USDG", st: "LIVE", note: "Crypto · 65% LTV", c: "#f2a93b" },
  { sym: "WBTC", name: "WBTC / USDG", st: "LIVE", note: "Crypto · 65% LTV", c: "#f2a93b" },
  { sym: "USDe", name: "USDe / USDG", st: "LIVE", note: "Ethena · 80% LTV", c: "#8ab4f8" },
  { sym: "NVDA", name: "NVDA / USDG", st: "LIVE", note: "RH Stock · 24/7", c: "#76b900" },
  { sym: "TSLA", name: "TSLA / USDG", st: "LIVE", note: "RH Stock · 24/7", c: "#e82127" },
  { sym: "AAPL", name: "AAPL / USDG", st: "LIVE", note: "RH Stock · Mkt Hrs", c: "#d4d8dc" },
  { sym: "USDG", name: "USDG → USDC", st: "LIVE", note: "1Click · 14+ Chains", c: "#7fe0b4" },
];

export function MarketList() {
  return (
    <div className={`${s.panel} bevel`}>
      <div className={s.head}><span>COLLATERAL &amp; ROUTES</span><span>7 MARKETS SEEDED · LIVE</span></div>
      {assets.map((a) => (
        <div key={a.name} className={s.asset}>
          <TokenIcon sym={a.sym} size={24} />
          <div><b>{a.name}</b><small>{a.note}</small></div>
          <em className={a.st === "ACTIVE" || a.st === "LIVE" ? s.on : ""}>{a.st}</em>
        </div>
      ))}
      <div className={s.foot}><span className="dot" /> CHAINLINK · 7200S HEARTBEAT</div>
    </div>
  );
}

const EXPLORER_TX = "https://robinhoodchain.blockscout.com/tx/";

const verifiedProofs = [
  { k: "PAYOUT",     b: "124,802,422", h: "0x7c8e…9a99", full: "0x7c8e7d1659ad551de05b57b19abedb85b8aa367b237dfb0085fc61b0fc379a99", amt: "0.15 USDG → POL", tag: "1CLICK ↗" },
  { k: "PAYOUT",     b: "124,802,385", h: "0x8794…01fd", full: "0x879485a80206d2a005e312d9bfb1ff3257ad40261548f7b146abf0d06abb01fd", amt: "0.15 USDG → BNB", tag: "1CLICK ↗" },
  { k: "PAYOUT",     b: "124,802,355", h: "0x832a…ade9", full: "0x832a5e0007347a459b47a1ab56a3dfdb0f9712d09a5802a4d7ef2d1c4118ade9", amt: "0.15 USDG → ARB", tag: "1CLICK ↗" },
  { k: "SEED·USDe",  b: "124,065,694", h: "0xb035…8b63", full: "0xb035a9c29b5ac2906007f2a05cf6822d3845de29e92e145d78d5f2db15748b63", amt: "0.01 USDG → USDe", tag: "TX ↗" },
  { k: "SEED·WBTC",  b: "124,065,612", h: "0x5d55…b81f", full: "0x5d55c1ad35e0986b3e7db7b0e648f037823b0eac714faa3376af039f7cc1b81f", amt: "0.01 USDG → WBTC", tag: "TX ↗" },
  { k: "SEED·cbBTC", b: "124,065,539", h: "0xdb80…e0fa", full: "0xdb808435bd3f9dac585e9658ba6c0cc331902b9e515f29a605e574de9853e0fa", amt: "0.01 USDG → cbBTC", tag: "TX ↗" },
  { k: "WITHDRAW", b: "123,542,369", h: "0x563d…b41f", full: "0x563d35bd6f8dbb8e56c1029e04dda04f164b2ba1bdd893e216d22195b6aab41f", amt: "0.0010 WETH EXIT", tag: "TX ↗" },
  { k: "REPAY",    b: "123,537,392", h: "0x88a0…44c8", full: "0x88a0e4bfdfa2b444d205b3f8b125afab714346d86a864451e5a36aa8e55844c8", amt: "0.005 USDG FULL", tag: "TX ↗" },
  { k: "PAYOUT",   b: "123,532,715", h: "0xa484…a7f0", full: "0xa484f312f7419d09f0d64fd85bcaff29394ed072d53603c510f2d523cf77a7f0", amt: "0.30 USDG → BASE", tag: "1CLICK ↗" },
  { k: "RWA·AAPL", b: "123,528,546", h: "0xefce…5ec7", full: "0xefce4d41320bf3d7175043d6dbfbe0720c7f18390bd3b36db2b08922bed05ec7", amt: "0.01 USDG → AAPL", tag: "TX ↗" },
  { k: "RWA·TSLA", b: "123,528,282", h: "0x3ba9…352b", full: "0x3ba93b6139f3be8c253c9b3a678bfaa2f084dbbb617bfa01980aeec24f24352b", amt: "0.01 USDG → TSLA", tag: "TX ↗" },
  { k: "RWA·NVDA", b: "123,528,008", h: "0xef3a…8cfe", full: "0xef3a519afa18f8c11b68ff13348a11bbbffe3dd2255f83cdaa96d6befed58cfe", amt: "0.01 USDG → NVDA", tag: "TX ↗" },
  { k: "PAYOUT",   b: "123,473,713", h: "0xc668…9644", full: "0xc6684d3643a3d0378129c7b2ed80de1f44851e8ae71d4dcbb520b52016d09644", amt: "1.00 USDG → SOL", tag: "1CLICK ↗" },
  { k: "SUPPLY",   b: "123,423,315", h: "0xc183…115d", full: "0xc183664bdcbcf7ea5eb6b638407e79f3285e210f34f9f5927c5ccf69571c115d", amt: "2.00 USDG", tag: "TX ↗" },
  { k: "WITHDRAW", b: "122,705,887", h: "0x1123…a2f7", full: "0x1123391fe9d0a87e5c2146b2cb577573b022bc48dbc31f1f37ff625e0416a2f7", amt: "0.0001 WETH", tag: "TX ↗" },
  { k: "REPAY",    b: "122,705,471", h: "0xabdb…5bcb", full: "0xabdb082cf3c0fd5fd1875f616b0b4fa3b71bd7f3ac811157edffd4ad32725bcb", amt: "0.05 USDG", tag: "TX ↗" },
  { k: "BORROW",   b: "122,705,021", h: "0x5735…5f4d", full: "0x57356f96ef1e9bebc9345de9530628c919faf2f9348c082f83b62cb240435f4d", amt: "0.005 USDG", tag: "TX ↗" },
  { k: "DEPOSIT",  b: "122,704,649", h: "0x4ff7…6b98", full: "0x4ff7f8d8c6c72ede29a11b76ffddca948c662f57d4eb220a8e34654fde9d6b98", amt: "0.0001 WETH", tag: "TX ↗" },
  { k: "SUPPLY",   b: "122,693,997", h: "0x0488…f0d7", full: "0x04887e2dd03391090f3f90eb170bba562955d76122e24bdafb2fbf73f715f0d7", amt: "2.00 USDG", tag: "TX ↗" },
  { k: "DEPOSIT",  b: "122,371,051", h: "0x3fe6…7244", full: "0x3fe623a150a3b1a6462a4c2d5ff8a7508fad4584ccfeabbbcc091ab3e6a77244", amt: "0.0010 WETH", tag: "TX ↗" },
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
