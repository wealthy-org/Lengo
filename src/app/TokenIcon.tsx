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
  NVDA: "/tokens/nvda.svg",
  TSLA: "/tokens/tsla.svg",
  AAPL: "/tokens/aapl.svg",
};

const BADGE_COLORS: Record<string, string> = {
  NVDA: "#76b900",
  TSLA: "#e82127",
  AAPL: "#3d4942",
  USDe: "#8ab4f8",
};

// Demo assets reuse the underlying logo and carry a TEST badge; Mainnet assets do not.
const TEST: Record<string, string> = { tBTC: "BTC", tUSDC: "USDC" };

function EquityIcon({ sym, size }: { sym: "NVDA" | "TSLA" | "AAPL"; size: number }) {
  if (sym === "NVDA") {
    return (
      <svg viewBox="0 0 48 48" width={size} height={size} style={{ display: "block", borderRadius: "50%" }}>
        <circle cx="24" cy="24" r="24" fill="#76b900" />
        <g transform="translate(10, 10) scale(1.16)">
          <path fill="#ffffff" d="M8.948 8.798v-1.43a6.7 6.7 0 0 1 .424-.018c3.922-.124 6.493 3.374 6.493 3.374s-2.774 3.851-5.75 3.851c-.398 0-.787-.062-1.158-.185v-4.346c1.528.185 1.837.857 2.747 2.385l2.04-1.714s-1.492-1.952-4-1.952a6.016 6.016 0 0 0-.796.035m0-4.735v2.138l.424-.027c5.45-.185 9.01 4.47 9.01 4.47s-4.08 4.964-8.33 4.964c-.37 0-.733-.035-1.095-.097v1.325c.3.035.61.062.91.062 3.957 0 6.82-2.023 9.593-4.408.459.371 2.34 1.263 2.73 1.652-2.633 2.208-8.772 3.984-12.253 3.984-.335 0-.653-.018-.971-.053v1.864H24V4.063zm0 10.326v1.131c-3.657-.654-4.673-4.46-4.673-4.46s1.758-1.944 4.673-2.262v1.237H8.94c-1.528-.186-2.73 1.245-2.73 1.245s.68 2.412 2.739 3.11M2.456 10.9s2.164-3.197 6.5-3.533V6.201C4.153 6.59 0 10.653 0 10.653s2.35 6.802 8.948 7.42v-1.237c-4.84-.6-6.492-5.936-6.492-5.936z"/>
        </g>
      </svg>
    );
  }
  if (sym === "TSLA") {
    return (
      <svg viewBox="0 0 48 48" width={size} height={size} style={{ display: "block", borderRadius: "50%" }}>
        <circle cx="24" cy="24" r="24" fill="#e82127" />
        <g transform="translate(11, 11) scale(1.08)">
          <path fill="#ffffff" d="M12 5.362l2.475-3.026s4.245.09 8.471 2.054c-1.082 1.636-3.231 2.438-3.231 2.438-.146-1.439-1.154-1.79-4.354-1.79L12 24 8.619 5.034c-3.18 0-4.188.354-4.335 1.792 0 0-2.146-.795-3.229-2.43C5.28 2.431 9.525 2.34 9.525 2.34L12 5.362l-.004.002H12v-.002zm0-3.899c3.415-.03 7.326.528 11.328 2.28.535-.968.672-1.395.672-1.395C19.625.612 15.528.015 12 0 8.472.015 4.375.61 0 2.349c0 0 .195.525.672 1.396C4.674 1.989 8.585 1.435 12 1.46v.003z"/>
        </g>
      </svg>
    );
  }
  if (sym === "AAPL") {
    return (
      <svg viewBox="0 0 48 48" width={size} height={size} style={{ display: "block", borderRadius: "50%" }}>
        <circle cx="24" cy="24" r="24" fill="#202723" stroke="#36423b" strokeWidth="1.5" />
        <g transform="translate(12, 11) scale(1.0)">
          <path fill="#f4f7ef" d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/>
        </g>
      </svg>
    );
  }
  return null;
}

export function TokenIcon({ sym, size = 30 }: { sym: string; size?: number }) {
  const base = TEST[sym] ?? sym;
  const isEquity = base === "NVDA" || base === "TSLA" || base === "AAPL";
  const src = LOGOS[base];
  const [err, setErr] = useState(false);

  return (
    <span
      className={s.icon}
      style={{ width: size, height: size, color: BADGE_COLORS[base] }}
      title={TEST[sym] ? `${sym} · testnet demo token, no value` : sym}
    >
      {isEquity ? (
        <EquityIcon sym={base as "NVDA" | "TSLA" | "AAPL"} size={size} />
      ) : src && !err ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={sym}
          width={size}
          height={size}
          loading="lazy"
          onError={() => setErr(true)}
        />
      ) : (
        <b style={{ fontSize: size * 0.36, color: BADGE_COLORS[base] || "var(--tx)" }}>
          {base.slice(0, 3)}
        </b>
      )}
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
