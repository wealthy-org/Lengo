"use client";
import { useState } from "react";
import s from "../trade.module.css";
import a from "./activity.module.css";
import { useActivity } from "@/lib/useActivity";
import { txUrl } from "@/lib/chain";

const group: Record<string, string> = {
  Borrow: "Lending",
  Deposit: "Lending",
  Approve: "Lending",
  Repay: "Lending",
  Withdraw: "Lending",
  Supply: "Lending",
  "Withdraw supply": "Lending",
  Liquidated: "Lending",
  Faucet: "Faucet",
  Quote: "Routes",
  Execute: "Routes",
};

export default function Activity() {
  const [f, setF] = useState("All");
  const A = useActivity();
  const isMainnet = A.net.mode === "mainnet";
  const filters = isMainnet ? ["All", "Lending", "Routes"] : ["All", "Lending", "Faucet", "Routes"];

  const rows = (A.rows ?? []).map((r, idx) => ({
    key: `${r.tx || "q"}:${r.type}:${r.logIndex}:${idx}`,
    type: r.type,
    amt: r.amt,
    tx: r.tx,
    block: r.block ? r.block.toLocaleString("en-US") : "1Click",
    time: r.timeLabel ?? `log ${r.logIndex}`,
    st: r.status,
  }));
  const list = rows.filter((r) => f === "All" || group[r.type] === f);
  const latestBlk = A.indexedTo ? BigInt(A.indexedTo).toLocaleString("en-US") : rows[0]?.block && rows[0].block !== "1Click" ? rows[0].block : "—";

  return (
    <>
      <div className={s.pageHead}>
        <div><h1>Activity</h1><p>Built from contract events, receipts, and 1Click routing logs. A refresh never erases proof.</p></div>
        <span>
          {A.loading
            ? "Loading events…"
            : A.error
              ? "RPC error · balances untouched"
              : A.scope === "account" && A.mine
                ? `Live · your events on ${A.net.chain.name}`
                : `Live · market & routing activity on ${A.net.chain.name}`}
        </span>
      </div>
      <div className={`${a.frame} bevel`}>
        <div className={s.stats} style={{ gridTemplateColumns: "repeat(5,1fr)" }}>
          <div><span>Records</span><b>{rows.length}</b></div>
          <div><span>Confirmed onchain</span><b className={s.ok}>{rows.filter((r) => r.st === "Confirmed").length}</b></div>
          <div><span>1Click routes</span><b className={s.warn}>{rows.filter((r) => r.st !== "Confirmed").length}</b></div>
          <div><span>Chain</span><b>RH {A.net.chain.id}</b></div>
          <div><span>Indexed block</span><b>{latestBlk}</b></div>
        </div>
        <div className={a.bar}>
          <div className={a.tabs}>{filters.map((x) => <button key={x} className={f === x ? a.on : ""} onClick={() => setF(x)}>{x}</button>)}</div>
          <span>Identity · txHash + logIndex + chainId</span>
        </div>
        <div className={a.table}>
          <div className={a.head}><span>Type</span><span>Amount / Route</span><span>Tx</span><span>Block</span><span>Ref</span><span>Status</span></div>
          {list.length === 0 ? (
            <div className={a.row} style={{ gridTemplateColumns: "1fr", color: "var(--tx3)" }}>
              <span>
                {f === "Lending"
                  ? `No Lending transactions recorded on ${A.net.chain.name} yet — supply ${A.net.debtSymbol} or deposit ${A.net.collSymbol} on Markets to record the first event.`
                  : `No ${f === "All" ? "" : f + " "}events recorded yet on ${A.net.chain.name}.`}
              </span>
            </div>
          ) : (
            list.map((r) => (
              <div key={r.key} className={a.row}>
                <span className={a.type}><i data-t={group[r.type]} />{r.type}</span>
                <span>{r.amt}</span>
                <span>{r.tx ? <a href={txUrl(r.tx, A.net.mode)} target="_blank" rel="noreferrer">{`${r.tx.slice(0, 6)}…${r.tx.slice(-4)}`} ↗</a> : <span className={a.dim}>offchain quote</span>}</span>
                <span className={a.dim}>{r.block}</span>
                <span className={a.dim}>{r.time}</span>
                <span><em className={r.st === "Confirmed" ? a.ok : r.st === "Live Intent" ? a.pend : a.prev}>{r.st}</em></span>
              </div>
            ))
          )}
        </div>
        <div className={s.footLine}>Pending past timeout stays pending/unknown with its hash. Writes are never retried automatically.</div>
      </div>
    </>
  );
}
