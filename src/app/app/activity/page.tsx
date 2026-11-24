"use client";
import { useState } from "react";
import s from "../trade.module.css";
import a from "./activity.module.css";
import { useActivity } from "@/lib/useActivity";
import { txUrl } from "@/lib/chain";

const sample = [
  { type: "Borrow", amt: "4,000.00 tUSDC", tx: "0x9c1f…2ab4", block: "18,204,117", time: "2m ago", st: "Confirmed" },
  { type: "Deposit", amt: "0.1000 tBTC", tx: "0x51ee…7d09", block: "18,203,980", time: "6m ago", st: "Confirmed" },
  { type: "Approve", amt: "tBTC → LengoMarket", tx: "0x0b4a…e113", block: "18,203,975", time: "6m ago", st: "Confirmed" },
  { type: "Quote", amt: "USDG → USDC · Solana", tx: "—", block: "—", time: "9m ago", st: "Preview" },
  { type: "Faucet", amt: "0.35 tBTC · 5,500 tUSDC", tx: "0xd27c…4f80", block: "18,203,410", time: "14m ago", st: "Confirmed" },
  { type: "Repay", amt: "250.00 tUSDC", tx: "0x77a0…c3d1", block: "—", time: "just now", st: "Pending" },
];
const filters = ["All", "Lending", "Faucet", "Routes"];
const group: Record<string, string> = { Borrow: "Lending", Deposit: "Lending", Approve: "Lending", Repay: "Lending", Withdraw: "Lending", Supply: "Lending", "Withdraw supply": "Lending", Liquidated: "Lending", Faucet: "Faucet", Quote: "Routes" };

export default function Activity() {
  const [f, setF] = useState("All");
  const A = useActivity();
  const rows = A.live
    ? (A.rows ?? []).map((r) => ({ type: r.type, amt: r.amt, tx: r.tx, txFull: r.tx, block: r.block.toLocaleString("en-US"), time: `log ${r.logIndex}`, st: "Confirmed" }))
    : sample.map((r) => ({ ...r, txFull: "" }));
  const list = rows.filter((r) => f === "All" || group[r.type] === f);
  return (
    <>
      <div className={s.pageHead}>
        <div><h1>Activity</h1><p>Built from contract events and receipts. A refresh never erases proof.</p></div>
        <span>{A.live ? (A.loading ? "Loading events…" : A.error ? "RPC error · balances untouched" : A.mine ? `Live · your events on ${A.net.chain.name}` : `Live · recent market events on ${A.net.chain.name}`) : `Sample data · contracts not yet deployed on ${A.net.chain.name}`}</span>
      </div>
      <div className={`${a.frame} bevel`}>
        <div className={s.stats} style={{ gridTemplateColumns: "repeat(5,1fr)" }}>
          <div><span>Transactions</span><b>{rows.length}</b></div>
          <div><span>Confirmed</span><b className={s.ok}>{rows.filter((r) => r.st === "Confirmed").length}</b></div>
          <div><span>Pending</span><b className={s.warn}>{rows.filter((r) => r.st === "Pending").length}</b></div>
          <div><span>Chain</span><b>RH {A.net.chain.id}</b></div>
          <div><span>Latest block</span><b>{A.live && rows[0] ? rows[0].block : "—"}</b></div>
        </div>
        <div className={a.bar}>
          <div className={a.tabs}>{filters.map((x) => <button key={x} className={f === x ? a.on : ""} onClick={() => setF(x)}>{x}</button>)}</div>
          <span>Identity · txHash + logIndex + chainId</span>
        </div>
        <div className={a.table}>
          <div className={a.head}><span>Type</span><span>Amount</span><span>Tx</span><span>Block</span><span>Time</span><span>Status</span></div>
          {list.map((r) => (
            <div key={r.tx + r.type + r.time} className={a.row}>
              <span className={a.type}><i data-t={group[r.type]} />{r.type}</span>
              <span>{r.amt}</span>
              <span>{r.txFull ? <a href={txUrl(r.txFull, A.net.mode)} target="_blank" rel="noreferrer">{`${r.tx.slice(0, 6)}…${r.tx.slice(-4)}`} ↗</a> : <span className={a.dim}>{r.tx}</span>}</span>
              <span className={a.dim}>{r.block}</span>
              <span className={a.dim}>{r.time}</span>
              <span><em className={r.st === "Confirmed" ? a.ok : r.st === "Pending" ? a.pend : a.prev}>{r.st}</em></span>
            </div>
          ))}
        </div>
        <div className={s.footLine}>Pending past timeout stays pending/unknown with its hash. Writes are never retried automatically.</div>
      </div>
    </>
  );
}
