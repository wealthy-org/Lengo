"use client";
import { Pair } from "../../TokenIcon";
import { useEffect, useRef, useState } from "react";
import s from "../trade.module.css";
import r from "./routes.module.css";

type Tok = { assetId: string; decimals: number; blockchain: string; symbol: string; price?: number };
type Quote = { status: string; reason?: string; amountIn?: string; amountOut?: string; amountOutUsd?: string; amountInUsd?: string; minAmountOut?: string; timeEstimate?: number; fees?: { refundFee?: string; withdrawFee?: string; appFees?: { fee: number }[] }; deadline?: string; quotedAt?: string; destination?: { decimals: number } };
const chainKey: Record<string, string> = { Solana: "sol", Ethereum: "eth", Base: "base", Arbitrum: "arb", "Robinhood (hood)": "hood", Bitcoin: "btc", Zcash: "zec" };
const kinds = [
  { id: "payout", label: "Borrow payout", sub: "USDG hood → USDC", from: "USDG", fromChain: "Robinhood (hood)", to: "USDC", dests: ["Solana", "Ethereum", "Base", "Arbitrum"], note: "Debt stays USDG on Robinhood Chain. This previews converting the payout only.", c1: "#7fe0b4", c2: "#7fb6f2", t1: "G", t2: "$" },
  { id: "asset", label: "Asset routing", sub: "BTC → USDC · swap", from: "BTC", fromChain: "Bitcoin", to: "USDC", dests: ["Solana", "Base", "Robinhood (hood)"], note: "A swap quote. It does not lock BTC as collateral.", c1: "#f2a93b", c2: "#7fb6f2", t1: "₿", t2: "$" },
  { id: "zec", label: "Asset routing", sub: "ZEC → USDC · swap", from: "ZEC", fromChain: "Zcash", to: "USDC", dests: ["Solana", "Base"], note: "Transparent vs shielded support depends on the provider. Not assumed.", c1: "#e8c46b", c2: "#7fb6f2", t1: "Z", t2: "$" },
];

export default function Routes() {
  const [k, setK] = useState(kinds[0]);
  const [amt, setAmt] = useState("1000");
  const [dest, setDest] = useState(kinds[0].dests[0]);
  const [state, setState] = useState<"idle" | "loading" | "unavailable" | "ok">("idle");
  const [toks, setToks] = useState<Tok[] | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string>("");
  const [discErr, setDiscErr] = useState("");
  const [recipient, setRecipient] = useState("");
  const [refundTo, setRefundTo] = useState("");
  const [q, setQ] = useState<Quote | null>(null);
  const [now, setNow] = useState(Date.now());
  const reqId = useRef(0);
  const pick = (x: typeof kinds[number]) => { setK(x); setDest(x.dests[0]); setState("idle"); setQ(null); };

  useEffect(() => {
    fetch("/api/routes/tokens").then((r) => r.json()).then((j) => { if (j.tokens) { setToks(j.tokens); setFetchedAt(j.fetchedAt); } else setDiscErr(j.reason || "unavailable"); }).catch((e) => setDiscErr(String(e)));
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const find = (sym: string, chain: string) => toks?.find((t) => t.symbol === sym && t.blockchain === chainKey[chain]);
  const origin = find(k.from, k.fromChain);
  const destTok = find(k.to, dest);
  const available = k.dests.filter((d) => !!find(k.to, d));
  const expired = q?.deadline ? new Date(q.deadline).getTime() < now : false;

  async function getQuote() {
    if (!origin || !destTok) return;
    const id = ++reqId.current; // drop out-of-order responses
    setState("loading");
    try {
      const res = await fetch("/api/routes/quote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ originAsset: origin.assetId, destinationAsset: destTok.assetId, amount: amt, recipient, refundTo, slippageBps: 50 }) });
      const j: Quote = await res.json();
      if (id !== reqId.current) return;
      setQ(j); setState(j.status === "ok" ? "ok" : "unavailable");
    } catch (e) { if (id === reqId.current) { setQ({ status: "unavailable", reason: String(e) }); setState("unavailable"); } }
  }
  const fmtOut = (v?: string) => (v && q?.destination ? (Number(v) / 10 ** q.destination.decimals).toLocaleString("en-US", { maximumFractionDigits: 6 }) : "—");

  return (
    <>
      <div className={s.pageHead}>
        <div><h1>Routes</h1><p>NEAR Intents 1Click quotes with dry:true. Route preview · no funds moved.</p></div>
        <span>Mainnet quotes · separate from testnet balances</span>
      </div>

      <div className={`${s.frame} bevel`}>
        <aside className={s.list}>
          <div className={s.listHead}><span>Preview type</span><b>{kinds.length}</b></div>
          <div style={{ height: 14 }} />
          {kinds.map((x) => (
            <button key={x.sub} className={`${s.mkt} ${k.sub === x.sub ? s.mktOn : ""}`} onClick={() => pick(x)}>
              <Pair a={x.from} b={x.to} />
              <span><b>{x.label}</b><small>{x.sub}</small></span>
            </button>
          ))}
          <div className={r.journey}>
            <span className={s.k}>Native collateral journey</span>
            <em>Under development</em>
            {["Lock BTC on Bitcoin", "Proof to Lengo", "Borrow on RH", "Payout USDC Solana"].map((t, i) => <div key={t}><i>{i + 1}</i>{t}</div>)}
            <p>No deposit address is issued.</p>
          </div>
        </aside>

        <section className={s.center}>
          <div className={s.mHead}>
            <Pair a={k.from} b={k.to} size={42} />
            <div><h2>{k.from} → {k.to}</h2><p>{k.fromChain} → {dest}</p></div>
            <div className={s.badges}><span>Preview</span><span>dry:true</span></div>
          </div>
          <div className={s.stats} style={{ gridTemplateColumns: "repeat(5,1fr)" }}>
            <div><span>Provider</span><b>1Click</b></div>
            <div><span>Origin</span><b>{k.from} · {k.fromChain.split(" ")[0]}</b></div>
            <div><span>Destination</span><b>{k.to} · {dest.split(" ")[0]}</b></div>
            <div><span>Slippage</span><b>0.50%</b></div>
            <div><span>Status</span><b className={state === "unavailable" || expired ? s.warn : state === "ok" ? s.ok : ""}>{state === "idle" ? "Not requested" : state === "loading" ? "Requesting" : state === "ok" ? (expired ? "Expired" : "Quote valid") : "Unavailable"}</b></div>
          </div>
          <div className={s.strip}><span>{toks ? `Discovery · ${toks.length} tokens · ${new Date(fetchedAt).toLocaleTimeString()}` : discErr ? "Discovery unavailable" : "Loading discovery…"}</span><span>{origin ? origin.assetId.slice(0, 34) + "…" : "origin not in catalog"}</span><span className={s.amberT}>No real deposit address</span></div>

          <div className={s.viewBody}>
            <div className={r.route}>
              <div className={r.node}><span>From</span><b>{amt || "0"} {k.from}</b><small>{k.fromChain}</small></div>
              <div className={r.wire}><i /><em>NEAR Intents · 1Click</em></div>
              <div className={r.node}><span>Solver network</span><b>Quote</b><small>dry:true · no execution</small></div>
              <div className={r.wire}><i /><em>settle</em></div>
              <div className={`${r.node} ${r.dst}`}><span>To</span><b>{state === "ok" ? q?.amountOut : "—"} {k.to}</b><small>{dest}</small></div>
            </div>
            <p className={r.note}>{k.note}</p>
            <div className={s.kv} style={{ marginTop: 22 }}>
              <div><span>Amount out</span><b>{state === "ok" ? `${q?.amountOut} ${k.to}` : "—"}</b><small>{state === "ok" ? `≈ $${Number(q?.amountOutUsd).toFixed(2)}` : "after quote"}</small></div>
              <div><span>Minimum received</span><b>{state === "ok" ? `${fmtOut(q?.minAmountOut)} ${k.to}` : "—"}</b><small>0.5% slippage bound</small></div>
              <div><span>Known fees</span><b>{state === "ok" ? `${(q?.fees?.appFees ?? []).reduce((a, f) => a + f.fee, 0) / 100}% app` : "—"}</b><small>{state === "ok" ? `withdraw ${fmtOut(q?.fees?.withdrawFee)} ${k.to}` : "provider + app"}</small></div>
              <div><span>Est. duration</span><b>{state === "ok" ? `${q?.timeEstimate}s` : "—"}</b><small>provider estimate</small></div>
              <div><span>Quote time</span><b>{state === "ok" && q?.quotedAt ? new Date(q.quotedAt).toLocaleTimeString() : "—"}</b><small>provider timestamp</small></div>
              <div><span>Expiry</span><b className={expired ? s.warn : ""}>{state === "ok" && q?.deadline ? (expired ? "Expired" : `${Math.max(0, Math.round((new Date(q.deadline).getTime() - now) / 1000))}s`) : "—"}</b><small>{expired ? "request a new quote" : "deadline"}</small></div>
            </div>
          </div>
          <div className={s.footLine}>GET /v0/tokens · POST /v0/quote · via server proxy</div>
        </section>

        <aside className={s.action}>
          <div className={s.mode}><button className={s.mOn}>⇄ Quote</button><button disabled style={{ opacity: .4 }}>◈ Execute</button></div>
          <div className={s.aBody}>
            <span className={s.k}>Route preview · no funds moved</span>
            <h3>Get quote</h3>
            <div className={s.field}>
              <div className={s.fTop}><span>You send</span><span>Hypothetical</span></div>
              <div className={s.fRow}><input inputMode="decimal" value={amt} aria-label="Amount in" onChange={(e) => { setAmt(e.target.value.replace(/[^0-9.]/g, "")); setState("idle"); setQ(null); reqId.current++; }} /><span className={s.tok}>{k.from}</span></div>
            </div>
            <div className={r.swap}>↓</div>
            <div className={s.field}>
              <div className={s.fTop}><span>You receive (quote)</span>
                <select value={dest} onChange={(e) => { setDest(e.target.value); setState("idle"); setQ(null); }} aria-label="Destination chain" className={r.sel}>
                  {k.dests.map((d) => <option key={d} disabled={!!toks && !find(k.to, d)}>{d}{toks && !find(k.to, d) ? " · not in catalog" : ""}</option>)}
                </select>
              </div>
              <div className={s.fRow}><input value={state === "ok" ? q?.amountOut ?? "—" : "—"} readOnly aria-label="Amount out" /><span className={s.tok}>{k.to}</span></div>
            </div>
            <label className={s.field}><div className={s.fTop}><span>Recipient · {dest}</span><span>required by schema</span></div><input className={r.addr} placeholder={`${chainKey[dest] ?? ""} address`} value={recipient} onChange={(e) => setRecipient(e.target.value)} /></label>
            <label className={s.field}><div className={s.fTop}><span>Refund · {k.fromChain}</span><span>origin chain</span></div><input className={r.addr} placeholder={`${chainKey[k.fromChain] ?? ""} address`} value={refundTo} onChange={(e) => setRefundTo(e.target.value)} /></label>
            <div className={s.sim}><div><span>Slippage limit</span><b>0.5%</b></div><div><span>Mode</span><b>dry:true</b></div></div>
            {state === "unavailable" && <p className={`${s.note} ${s.warn}`}>{q?.reason ?? "Unavailable"}. No placeholder result is shown.</p>}
            {toks && !available.length && <p className={`${s.note} ${s.warn}`}>No destination for {k.to} found in current discovery.</p>}
            <button className={s.cta} disabled={state === "loading" || !parseFloat(amt) || !origin || !destTok} onClick={getQuote}>{state === "loading" ? "Requesting…" : state === "ok" ? (expired ? "Refresh quote" : "Requote") : !toks ? "Loading catalog…" : !origin || !destTok ? "Route not in catalog" : "Get quote"}</button>
            <p className={s.note}>Mainnet market estimate · not your balance</p>
          </div>
        </aside>
      </div>
    </>
  );
}
