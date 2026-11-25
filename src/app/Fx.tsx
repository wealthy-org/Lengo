"use client";
import { useEffect, useState } from "react";
import s from "./fx.module.css";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Hero word that cycles with a scramble, like zkblast LIQUIDITY → NOTES */
export function CycleWord({ words }: { words: string[] }) {
  const [i, setI] = useState(0);
  const [txt, setTxt] = useState(words[0]);
  useEffect(() => {
    if (reduced()) return;
    const id = setInterval(() => setI((x) => (x + 1) % words.length), 2600);
    return () => clearInterval(id);
  }, [words.length]);
  useEffect(() => {
    const target = words[i];
    if (reduced()) { setTxt(target); return; }
    const chars = "01#$%/<>_ABCDEFXYZ";
    let f = 0;
    const id = setInterval(() => {
      f++;
      setTxt(target.split("").map((c, k) => (k < f / 2 ? c : chars[(Math.random() * chars.length) | 0])).join(""));
      if (f / 2 >= target.length) clearInterval(id);
    }, 35);
    return () => clearInterval(id);
  }, [i, words]);
  return <strong className={s.cycle} aria-label={words[i]}>{txt}</strong>;
}

/* Infinite market ticker strip */
export function Ticker({ items }: { items: string[][] }) {
  const row = items.map(([pair, a, b], k) => (
    <span key={k} className={s.tItem}><b>{pair}</b>{a}<em>{b}</em></span>
  ));
  return (
    <div className={s.ticker} aria-label="Market ticker">
      <div className={s.track}>{row}{row}</div>
    </div>
  );
}

/* Binary column stream */
export function Binary({ rows = 22, cols = 30 }: { rows?: number; cols?: number }) {
  const gen = () => Array.from({ length: rows }, () => Array.from({ length: cols }, () => (Math.random() > 0.5 ? "1" : "0")).join(""));
  const [lines, setLines] = useState<string[]>(() => Array(rows).fill("0".repeat(cols)));
  useEffect(() => {
    setLines(gen());
    if (reduced()) return;
    const id = setInterval(() => setLines((l) => [gen()[0], ...l.slice(0, -1)]), 120);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <pre className={s.binary} aria-hidden>{lines.join("\n")}</pre>;
}

/* Pipeline terminal: intent → route → lend → settle */
const stages = [
  { k: "INTENT", t: "Collateral intent received", d: "origin BTC · bitcoin" },
  { k: "ROUTE", t: "1Click quote · Route preview", d: "near intents · hood" },
  { k: "LEND", t: "Position recorded", d: "robinhood chain · 46630" },
  { k: "HEALTH", t: "HF guard active", d: "liq < 1.00 · ltv 60/75" },
  { k: "SETTLE", t: "Payout route ready", d: "USDC · solana" },
];
export function Pipeline() {
  const [on, setOn] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  useEffect(() => {
    if (reduced()) { setOn(stages.length - 1); return; }
    const id = setInterval(() => {
      setOn((x) => {
        const n = (x + 1) % stages.length;
        const hash = "0x" + Math.random().toString(16).slice(2, 6) + "…" + Math.random().toString(16).slice(2, 6);
        setLog((l) => [`[${new Date().toLocaleTimeString("en-GB")}] ${stages[n].k.padEnd(6)} ${hash} ok`, ...l].slice(0, 6));
        return n;
      });
    }, 1400);
    return () => clearInterval(id);
  }, []);
  return (
    <div className={`${s.term} corner`}>
      <div className={s.termHead}>
        <span>LENGO / PIPELINE TERMINAL</span>
        <span className={s.live}><i />MAINNET BETA · 4663</span>
      </div>
      <div className={s.termBody}>
        <div className={s.stages}>
          {stages.map((st, k) => (
            <div key={st.k} className={`${s.stage} ${k === on ? s.stageOn : k < on ? s.stageDone : ""}`}>
              <span className={s.stageK}>{st.k}</span>
              <div><b>{st.t}</b><small>{st.d}</small></div>
              <span className={s.stageS}>{k < on ? "OK" : k === on ? "RUN" : "WAIT"}</span>
            </div>
          ))}
        </div>
        <div className={s.side}>
          <Binary rows={14} cols={22} />
          <div className={s.log}>{log.map((l, k) => <div key={k} style={{ opacity: 1 - k * 0.15 }}>{l}</div>)}</div>
        </div>
      </div>
    </div>
  );
}

/* Index markers 00..15 along hero edge */
export function Ruler() {
  return (
    <div className={s.ruler} aria-hidden>
      {Array.from({ length: 16 }, (_, k) => <span key={k}>{String(k).padStart(2, "0")}</span>)}
    </div>
  );
}
