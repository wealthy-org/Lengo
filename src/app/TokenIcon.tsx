"use client";
import { useState } from "react";
import s from "./token.module.css";

const CG = "https://coin-images.coingecko.com/coins/images";
const LOGOS: Record<string, string> = {
  BTC: `${CG}/1/large/bitcoin.png`,
  cbBTC: `${CG}/40143/large/cbbtc.webp`,
  WBTC: `${CG}/7598/large/wrapped_bitcoin_wbtc.png`,
  USDC: `${CG}/6319/large/USDC.png`,
  USDe: `${CG}/33613/large/usde.png`,
  ZEC: `${CG}/486/large/Brandmark-Yellow_%281%29.png`,
  SOL: `${CG}/4128/large/solana.png`,
  USDG: `${CG}/51281/large/GDN_USDG_Token_200x200.png`,
  HYPE: "/tokens/hype.svg",
  ETH: `${CG}/279/large/ethereum.png`,
  WETH: `${CG}/279/large/ethereum.png`,
  NEAR: `${CG}/10365/large/near.png`,
  NVDA: "https://logo.clearbit.com/nvidia.com",
  TSLA: "https://logo.clearbit.com/tesla.com",
  AAPL: "https://logo.clearbit.com/apple.com",
};
const BADGE_COLORS: Record<string, string> = {
  NVDA: "#76b900",
  TSLA: "#e82127",
  AAPL: "#d4d8dc",
  USDe: "#8ab4f8",
};
// Demo assets reuse the underlying logo and carry a TEST badge; Mainnet assets do not.
const TEST: Record<string, string> = { tBTC: "BTC", tUSDC: "USDC" };

export function TokenIcon({ sym, size = 30 }: { sym: string; size?: number }) {
  const base = TEST[sym] ?? sym;
  const src = LOGOS[base];
  const [err, setErr] = useState(false);
  return (
    <span
      className={s.icon}
      style={{ width: size, height: size, color: BADGE_COLORS[base] }}
      title={TEST[sym] ? `${sym} · testnet demo token, no value` : sym}
    >
      {src && !err
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={src} alt={sym} width={size} height={size} loading="lazy" onError={() => setErr(true)} />
        : <b style={{ fontSize: size * 0.36 }}>{base.slice(0, 3)}</b>}
      {TEST[sym] && <em className={s.test}>T</em>}
    </span>
  );
}

export function Pair({ a, b, size = 30 }: { a: string; b?: string; size?: number }) {
  return (
    <span className={s.pair}>
      <TokenIcon sym={a} size={size} />
      {b && <TokenIcon sym={b} size={size} />}
    </span>
  );
}
