"use client";
import { Pair } from "../../TokenIcon";
import { useEffect, useRef, useState } from "react";
import { formatUnits, type Address } from "viem";
import { useAccount, useReadContracts, useSendTransaction, useSwitchChain, useWriteContract } from "wagmi";
import s from "../trade.module.css";
import r from "./routes.module.css";
import { tokenAbi } from "@/lib/abi";
import { DEPLOYMENTS, rhMainnet, txUrl } from "@/lib/chain";
import { ensureWalletChain } from "@/lib/walletChain";
import { useToast } from "../../Toaster";

type Tok = { assetId: string; decimals: number; blockchain: string; symbol: string; price?: number; contractAddress?: string };
type SwapTxRef = { hash: string; explorerUrl?: string } | string;
type SwapDetails = {
  depositedAmountFormatted?: string | null;
  amountOutFormatted?: string | null;
  originChainTxHashes?: SwapTxRef[];
  destinationChainTxHashes?: SwapTxRef[];
};
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
  origin?: { assetId?: string; symbol: string; chain: string; decimals: number; contractAddress?: string };
  destination?: { assetId?: string; symbol: string; chain: string; decimals: number; contractAddress?: string };
};

function fmtDuration(totalSec: number): string {
  const sec = Math.max(0, Math.round(totalSec));
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) {
    const m = Math.floor(sec / 60);
    const rem = sec % 60;
    return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
  }
  if (sec < 86400) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  return h > 0 ? `${d}d ${h}h` : `${d}d`;
}

function fmtQuoteClock(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function fmtAgo(iso: string, nowMs: number): string {
  const diff = Math.max(0, Math.round((nowMs - new Date(iso).getTime()) / 1000));
  if (diff < 5) return "just now";
  return `${fmtDuration(diff)} ago`;
}

function fmtSwapStatus(st: string | null): string {
  if (!st) return "";
  switch (st) {
    case "PENDING_DEPOSIT":
      return "Awaiting deposit";
    case "KNOWN_DEPOSIT_TX":
      return "Deposit submitted";
    case "PROCESSING":
      return "Swapping";
    case "SUCCESS":
      return "Settled ✓";
    case "INCOMPLETE_DEPOSIT":
      return "Incomplete deposit";
    case "REFUNDED":
      return "Refunded";
    case "FAILED":
      return "Failed";
    default:
      return st;
  }
}

function destExplorerTxUrl(chainLabel: string, ref: SwapTxRef): { hash: string; url: string } | null {
  const hash = typeof ref === "string" ? ref : ref?.hash;
  if (!hash) return null;
  const provided = typeof ref === "object" ? ref?.explorerUrl : undefined;
  if (provided) return { hash, url: provided };
  if (chainLabel === "Solana") return { hash, url: `https://solscan.io/tx/${hash}` };
  if (chainLabel === "Base") return { hash, url: `https://basescan.org/tx/${hash}` };
  if (chainLabel === "Arbitrum") return { hash, url: `https://arbiscan.io/tx/${hash}` };
  if (chainLabel === "Ethereum") return { hash, url: `https://etherscan.io/tx/${hash}` };
  if (chainLabel === "Robinhood (hood)") return { hash, url: `https://robinhoodchain.blockscout.com/tx/${hash}` };
  return { hash, url: `https://explorer.near-intents.org/transactions/${hash}` };
}

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

  const [execMode, setExecMode] = useState(false); // false = Preview, true = Live
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
  const [swapDetails, setSwapDetails] = useState<SwapDetails | null>(null);
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
    setSwapDetails(null);
    setDepositTx(null);
    setRefundTo(isEvmLabel(x.fromChain) && address ? address : "");
    setRecipient(isEvmLabel(nextDest) && address ? address : "");
  };

  // Sync EVM wallet address onto EVM origin/destination fields, and update when user switches active wallet
  const prevAddrRef = useRef<string | undefined>(address);
  useEffect(() => {
    const addrChanged = prevAddrRef.current !== address;
    prevAddrRef.current = address;

    if (isEvmLabel(k.fromChain)) {
      if (address && (!refundTo || addrChanged)) setRefundTo(address);
    } else if (refundTo.startsWith("0x")) {
      setRefundTo("");
    }
    if (isEvmLabel(dest)) {
      if (address && (!recipient || addrChanged)) setRecipient(address);
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
          if (j.swapDetails) setSwapDetails(j.swapDetails);
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

  const isHoodOrigin = k.fromChain === "Robinhood (hood)";
  const originErc20 = (
    origin?.contractAddress ||
    origin?.assetId.match(/0x[a-fA-F0-9]{40}/)?.[0] ||
    (isHoodOrigin && k.from === "USDG" ? DEPLOYMENTS.mainnet.debtAsset : undefined)
  ) as Address | undefined;

  const hoodBalQuery = useReadContracts({
    allowFailure: true,
    query: { enabled: !!address && isHoodOrigin && !!originErc20 },
    contracts: originErc20 && address
      ? [{ address: originErc20, abi: tokenAbi, functionName: "balanceOf", args: [address], chainId: rhMainnet.id }]
      : [],
  });
  const hoodDec = origin?.decimals ?? (k.from === "USDG" ? 6 : 18);
  const rawHoodBal = hoodBalQuery.data?.[0]?.result;
  const hoodBal = typeof rawHoodBal === "bigint" ? Number(formatUnits(rawHoodBal, hoodDec)) : 0;
  const overHoodBal = execMode && isHoodOrigin && isConnected && (parseFloat(amt) || 0) > hoodBal + 1e-6;

  async function getQuote() {
    if (!origin || !destTok) return;
    const id = ++reqId.current;
    setState("loading");
    setSwapStatus(null);
    setSwapDetails(null);
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
    if (!q?.depositAddress || !q.amountInUnits || !q.origin || !origin) return;
    setSending(true);
    try {
      // 1. Validate selected token strictly matches quoted 1Click origin asset
      if (
        q.origin.chain !== "hood" ||
        q.origin.symbol !== origin.symbol ||
        q.origin.decimals !== origin.decimals ||
        (q.origin.assetId && q.origin.assetId !== origin.assetId)
      ) {
        throw new Error("Selected asset does not match active 1Click quote — please refresh quote");
      }

      if (chainId !== rhMainnet.id) {
        const ok = await ensureWalletChain(rhMainnet, connector, switchChainAsync);
        if (!ok) throw new Error("Switch wallet to Robinhood Chain Mainnet (4663) to send");
      }

      const dep = q.depositAddress as Address;
      if (!/^0x[a-fA-F0-9]{40}$/.test(dep)) {
        throw new Error("Invalid EVM deposit address returned by quote");
      }

      const units = BigInt(q.amountInUnits);
      if (units <= 0n) throw new Error("Quoted transfer amount must be greater than zero");

      const isNativeEth =
        q.origin.symbol === "ETH" &&
        (q.origin.assetId === "nep141:hood.omft.near" || (!q.origin.contractAddress && !origin.contractAddress));

      let hash: `0x${string}`;
      if (isNativeEth) {
        hash = await sendTransactionAsync({
          to: dep,
          value: units,
          chainId: rhMainnet.id,
        });
      } else {
        const quotedAddr = (
          q.origin.contractAddress ||
          q.origin.assetId?.match(/0x[a-fA-F0-9]{40}/)?.[0] ||
          origin.contractAddress ||
          origin.assetId.match(/0x[a-fA-F0-9]{40}/)?.[0]
        ) as Address | undefined;

        if (!quotedAddr || !/^0x[a-fA-F0-9]{40}$/.test(quotedAddr)) {
          throw new Error(`Cannot resolve verified ERC-20 contract address for ${q.origin.symbol}`);
        }
        if (
          q.origin.symbol === "USDG" &&
          DEPLOYMENTS.mainnet.debtAsset &&
          quotedAddr.toLowerCase() !== DEPLOYMENTS.mainnet.debtAsset.toLowerCase()
        ) {
          throw new Error("Quoted USDG contract does not match canonical Robinhood Chain USDG");
        }

        hash = await writeContractAsync({
          address: quotedAddr,
          abi: tokenAbi,
          functionName: "transfer",
          args: [dep, units],
          chainId: rhMainnet.id,
        });
      }

      setDepositTx(hash);
      toast.push({ kind: "ok", title: `Sent ${amt} ${q.origin.symbol} to 1Click`, detail: "Submitting txHash to solver network…", hash });
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
  const canSendDirect = execMode && state === "ok" && !!q?.depositAddress && !expired && isHoodOrigin && isConnected && !overHoodBal;
  const destTxs = (swapDetails?.destinationChainTxHashes ?? [])
    .map((ref) => destExplorerTxUrl(dest, ref))
    .filter((x): x is { hash: string; url: string } => !!x);
  const expiryRemSec = q?.deadline ? Math.max(0, Math.round((new Date(q.deadline).getTime() - now) / 1000)) : 0;

  return (
    <>
      <div className={s.pageHead}>
        <div>
          <h1>Routes</h1>
          <p>
            NEAR Intents 1Click cross-chain routing — switch between <b>Preview</b> (read-only quote) and <b>Live</b> (executable settlement).
          </p>
        </div>
        <span>{execMode ? "Live Mode · dedicated deposit address" : "Preview Mode · no funds moved"}</span>
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
            <em>Preview &amp; Live Payout</em>
            {["Deposit WETH on RH", "Borrow USDG on RH", "Execute 1Click route", "Receive USDC on target chain"].map((t, i) => <div key={t}><i>{i + 1}</i>{t}</div>)}
          </div>
        </aside>

        <section className={s.center}>
          <div className={s.mHead}>
            <Pair a={k.from} b={k.to} size={42} />
            <div><h2>{k.from} → {k.to}</h2><p>{k.fromChain} → {dest}</p></div>
            <div className={s.badges}>
              <span className={execMode ? s.active : ""}>{execMode ? "Live" : "Preview"}</span>
              <span>{execMode ? "Executable" : "Read-only"}</span>
            </div>
          </div>
          <div className={s.stats} style={{ gridTemplateColumns: "repeat(5,1fr)" }}>
            <div><span>Provider</span><b>1Click</b></div>
            <div><span>Origin</span><b>{k.from} · {k.fromChain.split(" ")[0]}</b></div>
            <div><span>Destination</span><b>{k.to} · {dest.split(" ")[0]}</b></div>
            <div><span>Slippage</span><b>0.50%</b></div>
            <div>
              <span>Status</span>
              <b className={state === "unavailable" || expired || swapStatus === "FAILED" ? s.warn : state === "ok" ? s.ok : ""}>
                {swapStatus ? fmtSwapStatus(swapStatus) : state === "idle" ? "Not requested" : state === "loading" ? "Requesting" : state === "ok" ? (expired ? "Expired" : "Quote valid") : "Unavailable"}
              </b>
            </div>
          </div>
          <div className={s.strip}>
            <span>{toks ? `Discovery · ${toks.length} tokens · ${fmtQuoteClock(fetchedAt)}` : discErr ? "Discovery unavailable" : "Loading discovery…"}</span>
            <span>{origin ? origin.assetId.slice(0, 34) + "…" : "origin not in catalog"}</span>
            <span className={execMode && q?.depositAddress ? s.ok : s.amberT}>
              {execMode && q?.depositAddress ? `Deposit ${q.depositAddress.slice(0, 8)}…${q.depositAddress.slice(-6)}` : "Preview mode (no deposit address)"}
            </span>
          </div>

          <div className={s.viewBody}>
            <div className={r.route}>
              <div className={r.node}><span>From</span><b>{amt || "0"} {k.from}</b><small>{k.fromChain}</small></div>
              <div className={r.wire}><i /><em>NEAR Intents · 1Click</em></div>
              <div className={r.node}><span>Solver network</span><b>{execMode ? (swapStatus ? fmtSwapStatus(swapStatus) : "Live Intent") : "Preview"}</b><small>{execMode ? "live settlement" : "preview · no funds moved"}</small></div>
              <div className={r.wire}><i /><em>settle</em></div>
              <div className={`${r.node} ${r.dst}`}><span>To</span><b>{state === "ok" ? q?.amountOut : "—"} {k.to}</b><small>{dest}</small></div>
            </div>
            <p className={r.note}>{k.note}</p>

            {execMode && state === "ok" && q?.depositAddress && (
              <div className={`${s.sim} bevel`} style={{ marginTop: 18, padding: 14, border: "1px solid var(--lime)" }}>
                <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
                    <span style={{ fontSize: 10, letterSpacing: "0.08em", color: "var(--tx3)" }}>
                      1CLICK DEPOSIT ADDRESS · ROBINHOOD · SEND ONLY {q.origin?.symbol ?? k.from}
                    </span>
                    <code style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--lime)", wordBreak: "break-all" }}>{q.depositAddress}</code>
                    {q.depositMemo && <small style={{ display: "block", color: "var(--amber)" }}>Memo required: {q.depositMemo}</small>}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
                    <a
                      className="btn"
                      href={`https://explorer.near-intents.org/transactions/${q.depositAddress}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Intents Explorer ↗
                    </a>
                    {canSendDirect && !depositTx && (
                      <button type="button" className="btn btn-primary" disabled={sending} onClick={sendFromHoodWallet}>
                        {sending ? "Sending…" : `Send ${amt} ${k.from} from Wallet →`}
                      </button>
                    )}
                  </div>
                </div>
                {(depositTx || destTxs.length > 0) && (
                  <div style={{ gridColumn: "1 / -1", display: "flex", flexWrap: "wrap", gap: 14, fontSize: 11, fontFamily: "var(--mono)", color: "var(--tx2)", marginTop: 6 }}>
                    {depositTx && (
                      <span>
                        Origin {q.origin?.symbol ?? k.from} tx:{" "}
                        <a href={txUrl(depositTx, "mainnet")} target="_blank" rel="noreferrer">
                          {depositTx.slice(0, 10)}…{depositTx.slice(-6)} ↗
                        </a>
                      </span>
                    )}
                    <span>
                      Solver status: <b style={{ color: "var(--lime)" }}>{fmtSwapStatus(swapStatus)}</b>
                    </span>
                    {destTxs.map((tx) => (
                      <span key={tx.hash}>
                        {dest} payout tx:{" "}
                        <a href={tx.url} target="_blank" rel="noreferrer">
                          {tx.hash.slice(0, 8)}…{tx.hash.slice(-6)} ↗
                        </a>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className={s.kv} style={{ marginTop: 22 }}>
              <div><span>Amount out</span><b>{state === "ok" ? `${q?.amountOut} ${k.to}` : "—"}</b><small>{state === "ok" ? `≈ $${Number(q?.amountOutUsd).toFixed(2)}` : "after quote"}</small></div>
              <div><span>Minimum received</span><b>{state === "ok" ? `${fmtOut(q?.minAmountOut)} ${k.to}` : "—"}</b><small>0.5% slippage bound</small></div>
              <div><span>Known fees</span><b>{state === "ok" ? `${(q?.fees?.appFees ?? []).reduce((a, f) => a + f.fee, 0) / 100}% app` : "—"}</b><small>{state === "ok" ? `withdraw ${fmtOut(q?.fees?.withdrawFee)} ${k.to}` : "provider + app"}</small></div>
              <div><span>Est. duration</span><b>{state === "ok" && typeof q?.timeEstimate === "number" ? `~${fmtDuration(q.timeEstimate)}` : "—"}</b><small>provider estimate</small></div>
              <div><span>Quote time</span><b>{state === "ok" && q?.quotedAt ? fmtQuoteClock(q.quotedAt) : "—"}</b><small>{state === "ok" && q?.quotedAt ? fmtAgo(q.quotedAt, now) : "provider timestamp"}</small></div>
              <div><span>Expiry</span><b className={expired ? s.warn : ""}>{state === "ok" && q?.deadline ? (expired ? "Expired" : fmtDuration(expiryRemSec)) : "—"}</b><small>{expired ? "request a new quote" : state === "ok" && q?.deadline ? `until ${fmtQuoteClock(q.deadline)}` : "quote window"}</small></div>
            </div>
          </div>
          <div className={s.footLine}>GET /v0/tokens · POST /v0/quote · POST /v0/deposit/submit · GET /v0/status</div>
        </section>

        <aside className={s.action}>
          <div className={s.mode}>
            <button className={!execMode ? s.mOn : ""} onClick={() => { setExecMode(false); setState("idle"); setQ(null); setSwapStatus(null); setSwapDetails(null); }}>⇄ Preview</button>
            <button className={execMode ? s.mOn : ""} onClick={() => { setExecMode(true); setState("idle"); setQ(null); setSwapStatus(null); setSwapDetails(null); }}>◈ Live</button>
          </div>
          <div className={s.aBody}>
            <span className={s.k}>{execMode ? "Live execution · real funds" : "Preview · no funds moved"}</span>
            <h3>{execMode ? "Execute live route" : "Preview quote"}</h3>
            <div className={s.field}>
              <div className={s.fTop}>
                <span>You send</span>
                <span>
                  {isHoodOrigin && isConnected
                    ? `Balance ${hoodBal.toFixed(hoodDec === 6 ? 2 : 4)} ${k.from}`
                    : execMode
                      ? "Exact input"
                      : "Hypothetical"}
                </span>
              </div>
              <div className={s.fRow}>
                <input
                  inputMode="decimal"
                  value={amt}
                  aria-label="Amount in"
                  onChange={(e) => {
                    setAmt(e.target.value.replace(/[^0-9.]/g, ""));
                    setState("idle");
                    setQ(null);
                    reqId.current++;
                  }}
                />
                {isHoodOrigin && isConnected && hoodBal > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setAmt(String(+hoodBal.toFixed(hoodDec)));
                      setState("idle");
                      setQ(null);
                      reqId.current++;
                    }}
                  >
                    Max
                  </button>
                )}
                <span className={s.tok}>{k.from}</span>
              </div>
            </div>
            <div className={r.swap}>↓</div>
            <div className={s.field}>
              <div className={s.fTop}><span>You receive ({execMode ? "live" : "preview"})</span>
                <select value={dest} onChange={(e) => { setDest(e.target.value); setState("idle"); setQ(null); }} aria-label="Destination chain" className={r.sel}>
                  {k.dests.map((d) => <option key={d} disabled={!!toks && !find(k.to, d)}>{d}{toks && !find(k.to, d) ? " · not in catalog" : ""}</option>)}
                </select>
              </div>
              <div className={s.fRow}><input value={state === "ok" ? q?.amountOut ?? "—" : "—"} readOnly aria-label="Amount out" /><span className={s.tok}>{k.to}</span></div>
            </div>
            <label className={s.field}><div className={s.fTop}><span>Recipient · {dest}</span><span>{execMode ? "required (live)" : "optional in preview"}</span></div><input className={r.addr} placeholder={execMode ? `Your ${dest} address` : `Optional (${dest} preview)`} value={recipient} onChange={(e) => setRecipient(e.target.value)} /></label>
            <label className={s.field}><div className={s.fTop}><span>Refund · {k.fromChain}</span><span>{execMode ? "required (live)" : "optional in preview"}</span></div><input className={r.addr} placeholder={execMode ? `Your ${k.fromChain} address` : `Optional (${k.fromChain} preview)`} value={refundTo} onChange={(e) => setRefundTo(e.target.value)} /></label>
            <div className={s.sim}><div><span>Slippage limit</span><b>0.5%</b></div><div><span>Mode</span><b>{execMode ? "Live" : "Preview"}</b></div></div>
            {overHoodBal && <p className={`${s.note} ${s.warn}`}>Input exceeds your Robinhood Chain balance ({hoodBal.toFixed(2)} {k.from}) — you can still request a deposit address or lower the amount.</p>}
            {state === "unavailable" && <p className={`${s.note} ${s.warn}`}>{q?.reason ?? "Unavailable"}.</p>}
            {toks && !available.length && <p className={`${s.note} ${s.warn}`}>No destination for {k.to} found in current discovery.</p>}
            <button className={s.cta} disabled={state === "loading" || !parseFloat(amt) || !origin || !destTok} onClick={getQuote}>
              {state === "loading" ? "Requesting…" : state === "ok" ? (expired ? "Refresh quote" : execMode ? "Refresh live quote" : "Requote") : !toks ? "Loading catalog…" : !origin || !destTok ? "Route not in catalog" : execMode ? "Get live deposit address" : "Preview quote"}
            </button>
            <p className={s.note}>{execMode ? "Issues a dedicated 1Click deposit address & tracks live settlement" : "Market estimate · no deposit address issued"}</p>
          </div>
        </aside>
      </div>
    </>
  );
}
