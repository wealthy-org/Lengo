"use client";
import { Pair } from "../../TokenIcon";
import { useEffect, useRef, useState } from "react";
import { type Address } from "viem";
import { useAccount, useSendTransaction, useSwitchChain, useWriteContract } from "wagmi";
import s from "../trade.module.css";
import r from "./routes.module.css";
import { tokenAbi } from "@/lib/abi";
import { rhMainnet, txUrl } from "@/lib/chain";
import { ensureWalletChain } from "@/lib/walletChain";
import { useToast } from "../../Toaster";

type Tok = { assetId: string; decimals: number; blockchain: string; symbol: string; price?: number; contractAddress?: string };
type Quote = {
  status: string;
  reason?: string;
  dry?: boolean;
  depositAddress?: string;
  depositMemo?: string;
  amountInUnits?: string;
  amountIn?: string;
  amountOut?: string;
  amountOutUsd?: string;
  amountInUsd?: string;
  minAmountOut?: string;
  timeEstimate?: number;
  fees?: { refundFee?: string; withdrawFee?: string; appFees?: { fee: number }[] };
  deadline?: string;
  quotedAt?: string;
  origin?: { symbol: string; chain: string; decimals: number; contractAddress?: string };
  destination?: { symbol: string; chain: string; decimals: number };
};

const chainKey: Record<string, string> = { Solana: "sol", Ethereum: "eth", Base: "base", Arbitrum: "arb", "Robinhood (hood)": "hood", Bitcoin: "btc", Zcash: "zec" };
const isEvmLabel = (label: string) => ["Ethereum", "Base", "Arbitrum", "Robinhood (hood)"].includes(label);
const kinds = [
  { id: "payout", label: "Borrow payout", sub: "USDG hood → USDC", from: "USDG", fromChain: "Robinhood (hood)", to: "USDC", dests: ["Solana", "Base", "Arbitrum", "Ethereum"], defaultAmt: "100", note: "Convert borrowed USDG on Robinhood Chain to USDC on your target chain via NEAR Intents 1Click." },
  { id: "sol-inflow", label: "Solana bridge", sub: "SOL → WETH hood", from: "SOL", fromChain: "Solana", to: "WETH", dests: ["Robinhood (hood)"], defaultAmt: "1", note: "Bridge SOL from Solana directly into WETH collateral on Robinhood Chain Mainnet." },
  { id: "inflow", label: "EVM inflow", sub: "USDC Base → WETH hood", from: "USDC", fromChain: "Base", to: "WETH", dests: ["Robinhood (hood)"], defaultAmt: "100", note: "Route USDC from Base directly into WETH on Robinhood Chain Mainnet to deposit as collateral." },
  { id: "asset", label: "Asset routing", sub: "BTC → USDC · swap", from: "BTC", fromChain: "Bitcoin", to: "USDC", dests: ["Solana", "Base"], defaultAmt: "0.01", note: "A cross-chain swap quote via NEAR Intents. Does not lock native BTC as lending collateral." },
  { id: "zec", label: "Asset routing", sub: "ZEC → USDC · swap", from: "ZEC", fromChain: "Zcash", to: "USDC", dests: ["Solana", "Base"], defaultAmt: "1", note: "Transparent t-address routing via NEAR Intents 1Click." },
];

export default function Routes() {
  const { address, isConnected, chainId, connector } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const { sendTransactionAsync } = useSendTransaction();
  const toast = useToast();

  const [execMode, setExecMode] = useState(false); // false = Preview (dry:true), true = Live Execute (dry:false)
  const [k, setK] = useState(kinds[0]);
  const [amt, setAmt] = useState("100");
  const [dest, setDest] = useState(kinds[0].dests[0]);
  const [state, setState] = useState<"idle" | "loading" | "unavailable" | "ok">("idle");
  const [toks, setToks] = useState<Tok[] | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string>("");
  const [discErr, setDiscErr] = useState("");
  const [recipient, setRecipient] = useState("");
  const [refundTo, setRefundTo] = useState("");
  const [q, setQ] = useState<Quote | null>(null);
  const [swapStatus, setSwapStatus] = useState<string | null>(null);
  const [depositTx, setDepositTx] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [copiedDep, setCopiedDep] = useState(false);
  const [now, setNow] = useState(Date.now());
  const reqId = useRef(0);

  const pick = (x: typeof kinds[number]) => {
    const nextDest = x.dests[0];
    setK(x);
    setAmt(x.defaultAmt);
    setDest(nextDest);
    setState("idle");
    setQ(null);
    setSwapStatus(null);
    setDepositTx(null);
    setRefundTo(isEvmLabel(x.fromChain) && address ? address : "");
    setRecipient(isEvmLabel(nextDest) && address ? address : "");
  };

  // Sync EVM wallet address ONLY onto EVM origin/destination fields, clearing mismatched 0x addresses on non-EVM chains
  useEffect(() => {
    if (isEvmLabel(k.fromChain)) {
      if (address && !refundTo) setRefundTo(address);
    } else if (refundTo.startsWith("0x")) {
      setRefundTo("");
    }
    if (isEvmLabel(dest)) {
      if (address && !recipient) setRecipient(address);
    } else if (recipient.startsWith("0x")) {
      setRecipient("");
    }
  }, [address, k.fromChain, dest, refundTo, recipient]);

  useEffect(() => {
    fetch("/api/routes/tokens")
      .then((r) => r.json())
      .then((j) => {
        if (j.tokens) {
          setToks(j.tokens);
          setFetchedAt(j.fetchedAt);
        } else setDiscErr(j.reason || "unavailable");
      })
      .catch((e) => setDiscErr(String(e)));
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Poll live 1Click status when an executable quote has issued a depositAddress
  useEffect(() => {
    const dep = q?.depositAddress;
    if (!dep || q?.dry !== false) return;
    let stop = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/routes/status?depositAddress=${encodeURIComponent(dep)}`);
        if (!res.ok) return;
        const j = await res.json();
        if (!stop && j.status) {
          setSwapStatus(j.status);
          if (j.status === "SUCCESS" || j.status === "REFUNDED" || j.status === "FAILED") {
            stop = true;
          }
        }
      } catch {
        /* ignore transient network errors */
      }
    };
    poll();
    const iv = setInterval(poll, 5000);
    return () => {
      stop = true;
      clearInterval(iv);
    };
  }, [q?.depositAddress, q?.dry]);

  const find = (sym: string, chain: string) => toks?.find((t) => t.symbol === sym && t.blockchain === chainKey[chain]);
  const origin = find(k.from, k.fromChain);
  const destTok = find(k.to, dest);
  const available = k.dests.filter((d) => !!find(k.to, d));
  const expired = q?.deadline ? new Date(q.deadline).getTime() < now : false;

  async function getQuote() {
    if (!origin || !destTok) return;
    const id = ++reqId.current;
    setState("loading");
    setSwapStatus(null);
    setDepositTx(null);
    try {
      const res = await fetch("/api/routes/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          originAsset: origin.assetId,
          destinationAsset: destTok.assetId,
          amount: amt,
          recipient,
          refundTo,
          slippageBps: 50,
          execute: execMode,
        }),
      });
      const j: Quote = await res.json();
      if (id !== reqId.current) return;
      setQ(j);
      setState(j.status === "ok" ? "ok" : "unavailable");
      if (j.status === "ok" && execMode && j.depositAddress) {
        setSwapStatus("PENDING_DEPOSIT");
      }
    } catch (e) {
      if (id === reqId.current) {
        setQ({ status: "unavailable", reason: String(e) });
        setState("unavailable");
      }
    }
  }

  async function sendFromHoodWallet() {
    if (!q?.depositAddress || !q.amountInUnits || !origin) return;
    setSending(true);
    try {
      if (chainId !== rhMainnet.id) {
        const ok = await ensureWalletChain(rhMainnet, connector, switchChainAsync);
        if (!ok) throw new Error("Switch wallet to Robinhood Chain Mainnet (4663) to send");
      }
      const dep = q.depositAddress as Address;
      const units = BigInt(q.amountInUnits);
      const hash = origin.contractAddress
        ? await writeContractAsync({
            address: origin.contractAddress as Address,
            abi: tokenAbi,
            functionName: "transfer",
            args: [dep, units],
            chainId: rhMainnet.id,
          })
        : await sendTransactionAsync({
            to: dep,
            value: units,
            chainId: rhMainnet.id,
          });
      setDepositTx(hash);
      toast.push({ kind: "ok", title: `Sent ${amt} ${k.from} to 1Click`, detail: "Notifying solver network…", hash });
      await fetch("/api/routes/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ txHash: hash, depositAddress: q.depositAddress }),
      });
      setSwapStatus("KNOWN_DEPOSIT_TX");
    } catch (e) {
      const m = (e as Error).message || "Transfer failed";
      toast.push({ kind: "err", title: /rejected|denied/i.test(m) ? "Rejected in wallet" : "Send failed", detail: m.split("\n")[0].slice(0, 120) });
    } finally {
      setSending(false);
    }
  }

  const fmtOut = (v?: string) => (v && q?.destination ? (Number(v) / 10 ** q.destination.decimals).toLocaleString("en-US", { maximumFractionDigits: 6 }) : "—");
  const canSendDirect = execMode && state === "ok" && !!q?.depositAddress && !expired && k.fromChain === "Robinhood (hood)" && isConnected;

  return (
    <>
      <div className={s.pageHead}>
        <div>
          <h1>Routes</h1>
          <p>
            NEAR Intents 1Click cross-chain routing — toggle between <b>Quote Preview</b> (<code>dry:true</code>) and <b>Live Execute</b> (<code>dry:false</code>).
          </p>
        </div>
        <span>{execMode ? "Live Mainnet Execution · real deposit address" : "Preview Mode · no funds moved"}</span>
      </div>

      <div className={`${s.frame} bevel`}>
        <aside className={s.list}>
          <div className={s.listHead}><span>Route presets</span><b>{kinds.length}</b></div>
          <div style={{ height: 14 }} />
          {kinds.map((x) => (
            <button key={x.sub} className={`${s.mkt} ${k.sub === x.sub ? s.mktOn : ""}`} onClick={() => pick(x)}>
              <Pair a={x.from} b={x.to} />
              <span><b>{x.label}</b><small>{x.sub}</small></span>
            </button>
          ))}
          <div className={r.journey}>
            <span className={s.k}>Cross-chain lending flow</span>
            <em>Preview · v1 Payout Rollout</em>
            {["Deposit WETH on RH", "Borrow USDG on RH", "Execute 1Click route", "Receive USDC on target chain"].map((t, i) => <div key={t}><i>{i + 1}</i>{t}</div>)}
          </div>
        </aside>

        <section className={s.center}>
          <div className={s.mHead}>
            <Pair a={k.from} b={k.to} size={42} />
            <div><h2>{k.from} → {k.to}</h2><p>{k.fromChain} → {dest}</p></div>
            <div className={s.badges}>
              <span className={execMode ? s.active : ""}>{execMode ? "Live Execute" : "Preview"}</span>
              <span>{execMode ? "dry:false" : "dry:true"}</span>
            </div>
          </div>
          <div className={s.stats} style={{ gridTemplateColumns: "repeat(5,1fr)" }}>
            <div><span>Provider</span><b>1Click</b></div>
            <div><span>Origin</span><b>{k.from} · {k.fromChain.split(" ")[0]}</b></div>
            <div><span>Destination</span><b>{k.to} · {dest.split(" ")[0]}</b></div>
            <div><span>Slippage</span><b>0.50%</b></div>
            <div>
              <span>Status</span>
              <b className={state === "unavailable" || expired ? s.warn : state === "ok" ? s.ok : ""}>
                {swapStatus ? swapStatus : state === "idle" ? "Not requested" : state === "loading" ? "Requesting" : state === "ok" ? (expired ? "Expired" : "Quote valid") : "Unavailable"}
              </b>
            </div>
          </div>
          <div className={s.strip}>
            <span>{toks ? `Discovery · ${toks.length} tokens · ${new Date(fetchedAt).toLocaleTimeString()}` : discErr ? "Discovery unavailable" : "Loading discovery…"}</span>
            <span>{origin ? origin.assetId.slice(0, 34) + "…" : "origin not in catalog"}</span>
            <span className={execMode && q?.depositAddress ? s.ok : s.amberT}>
              {execMode && q?.depositAddress ? `Deposit ${q.depositAddress.slice(0, 8)}…${q.depositAddress.slice(-6)}` : "No deposit address (preview)"}
            </span>
          </div>

          <div className={s.viewBody}>
            <div className={r.route}>
              <div className={r.node}><span>From</span><b>{amt || "0"} {k.from}</b><small>{k.fromChain}</small></div>
              <div className={r.wire}><i /><em>NEAR Intents · 1Click</em></div>
              <div className={r.node}><span>Solver network</span><b>{execMode ? (swapStatus ?? "Live Intent") : "Quote"}</b><small>{execMode ? "real settlement" : "dry:true · preview"}</small></div>
              <div className={r.wire}><i /><em>settle</em></div>
              <div className={`${r.node} ${r.dst}`}><span>To</span><b>{state === "ok" ? q?.amountOut : "—"} {k.to}</b><small>{dest}</small></div>
            </div>
            <p className={r.note}>{k.note}</p>

            {execMode && state === "ok" && q?.depositAddress && (
              <div className={`${s.sim} bevel`} style={{ marginTop: 18, padding: 14, border: "1px solid var(--lime)" }}>
                <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <span style={{ display: "block", fontSize: 10, color: "var(--tx3)" }}>1CLICK DEPOSIT ADDRESS ({k.fromChain.toUpperCase()})</span>
                    <code style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--lime)", wordBreak: "break-all" }}>{q.depositAddress}</code>
                    {q.depositMemo && <small style={{ display: "block", color: "var(--amber)" }}>Memo required: {q.depositMemo}</small>}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        navigator.clipboard?.writeText(q.depositAddress!);
                        setCopiedDep(true);
                        setTimeout(() => setCopiedDep(false), 1600);
                      }}
                    >
                      {copiedDep ? "Copied ✓" : "Copy address"}
                    </button>
                    {canSendDirect && !depositTx && (
                      <button type="button" className="btn btn-primary" disabled={sending} onClick={sendFromHoodWallet}>
                        {sending ? "Sending…" : `Send ${amt} ${k.from} from Wallet →`}
                      </button>
                    )}
                  </div>
                </div>
                {depositTx && (
                  <div style={{ gridColumn: "1 / -1", fontSize: 11, fontFamily: "var(--mono)", color: "var(--tx2)" }}>
                    Deposit tx submitted: <a href={txUrl(depositTx, "mainnet")} target="_blank" rel="noreferrer">{depositTx.slice(0, 10)}…{depositTx.slice(-6)} ↗</a> · Solver status: <b style={{ color: "var(--lime)" }}>{swapStatus}</b>
                  </div>
                )}
              </div>
            )}

            <div className={s.kv} style={{ marginTop: 22 }}>
              <div><span>Amount out</span><b>{state === "ok" ? `${q?.amountOut} ${k.to}` : "—"}</b><small>{state === "ok" ? `≈ $${Number(q?.amountOutUsd).toFixed(2)}` : "after quote"}</small></div>
              <div><span>Minimum received</span><b>{state === "ok" ? `${fmtOut(q?.minAmountOut)} ${k.to}` : "—"}</b><small>0.5% slippage bound</small></div>
              <div><span>Known fees</span><b>{state === "ok" ? `${(q?.fees?.appFees ?? []).reduce((a, f) => a + f.fee, 0) / 100}% app` : "—"}</b><small>{state === "ok" ? `withdraw ${fmtOut(q?.fees?.withdrawFee)} ${k.to}` : "provider + app"}</small></div>
              <div><span>Est. duration</span><b>{state === "ok" ? `${q?.timeEstimate}s` : "—"}</b><small>provider estimate</small></div>
              <div><span>Quote time</span><b>{state === "ok" && q?.quotedAt ? new Date(q.quotedAt).toLocaleTimeString() : "—"}</b><small>provider timestamp</small></div>
              <div><span>Expiry</span><b className={expired ? s.warn : ""}>{state === "ok" && q?.deadline ? (expired ? "Expired" : `${Math.max(0, Math.round((new Date(q.deadline).getTime() - now) / 1000))}s`) : "—"}</b><small>{expired ? "request a new quote" : "deadline"}</small></div>
            </div>
          </div>
          <div className={s.footLine}>GET /v0/tokens · POST /v0/quote · GET /v0/status · via server proxy</div>
        </section>

        <aside className={s.action}>
          <div className={s.mode}>
            <button className={!execMode ? s.mOn : ""} onClick={() => { setExecMode(false); setState("idle"); setQ(null); setSwapStatus(null); }}>⇄ Quote</button>
            <button className={execMode ? s.mOn : ""} onClick={() => { setExecMode(true); setState("idle"); setQ(null); setSwapStatus(null); }}>◈ Execute</button>
          </div>
          <div className={s.aBody}>
            <span className={s.k}>{execMode ? "Live Mainnet execution · real funds" : "Route preview · no funds moved"}</span>
            <h3>{execMode ? "Execute cross-chain route" : "Get quote"}</h3>
            <div className={s.field}>
              <div className={s.fTop}><span>You send</span><span>{execMode ? "Exact input" : "Hypothetical"}</span></div>
              <div className={s.fRow}><input inputMode="decimal" value={amt} aria-label="Amount in" onChange={(e) => { setAmt(e.target.value.replace(/[^0-9.]/g, "")); setState("idle"); setQ(null); reqId.current++; }} /><span className={s.tok}>{k.from}</span></div>
            </div>
            <div className={r.swap}>↓</div>
            <div className={s.field}>
              <div className={s.fTop}><span>You receive ({execMode ? "live" : "quote"})</span>
                <select value={dest} onChange={(e) => { setDest(e.target.value); setState("idle"); setQ(null); }} aria-label="Destination chain" className={r.sel}>
                  {k.dests.map((d) => <option key={d} disabled={!!toks && !find(k.to, d)}>{d}{toks && !find(k.to, d) ? " · not in catalog" : ""}</option>)}
                </select>
              </div>
              <div className={s.fRow}><input value={state === "ok" ? q?.amountOut ?? "—" : "—"} readOnly aria-label="Amount out" /><span className={s.tok}>{k.to}</span></div>
            </div>
            <label className={s.field}><div className={s.fTop}><span>Recipient · {dest}</span><span>{execMode ? "required (live)" : "optional in preview"}</span></div><input className={r.addr} placeholder={execMode ? `Your ${dest} address` : `Optional (${dest} preview)`} value={recipient} onChange={(e) => setRecipient(e.target.value)} /></label>
            <label className={s.field}><div className={s.fTop}><span>Refund · {k.fromChain}</span><span>{execMode ? "required (live)" : "optional in preview"}</span></div><input className={r.addr} placeholder={execMode ? `Your ${k.fromChain} address` : `Optional (${k.fromChain} preview)`} value={refundTo} onChange={(e) => setRefundTo(e.target.value)} /></label>
            <div className={s.sim}><div><span>Slippage limit</span><b>0.5%</b></div><div><span>Mode</span><b>{execMode ? "dry:false (LIVE)" : "dry:true"}</b></div></div>
            {state === "unavailable" && <p className={`${s.note} ${s.warn}`}>{q?.reason ?? "Unavailable"}.</p>}
            {toks && !available.length && <p className={`${s.note} ${s.warn}`}>No destination for {k.to} found in current discovery.</p>}
            <button className={s.cta} disabled={state === "loading" || !parseFloat(amt) || !origin || !destTok} onClick={getQuote}>
              {state === "loading" ? "Requesting…" : state === "ok" ? (expired ? "Refresh quote" : execMode ? "Refresh live quote" : "Requote") : !toks ? "Loading catalog…" : !origin || !destTok ? "Route not in catalog" : execMode ? "Get live deposit address" : "Get quote"}
            </button>
            <p className={s.note}>{execMode ? "Issues a real 1Click deposit address & tracks live settlement" : "Mainnet market estimate · no deposit address issued"}</p>
          </div>
        </aside>
      </div>
    </>
  );
}
