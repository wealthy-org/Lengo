"use client";
import { Pair } from "../TokenIcon";
import { useEffect, useMemo, useState } from "react";
import { useConnect } from "wagmi";
import { injected } from "wagmi/connectors";
import s from "./trade.module.css";
import HealthAlert from "./HealthAlert";
import { useToast } from "../Toaster";
import { useLengo, useLengoTx } from "@/lib/useLengo";
import { MAINNET_MARKETS, TESTNET_MARKET, type MarketSpec } from "@/lib/markets";
import { txUrl, addrUrl } from "@/lib/chain";
import { useNetwork } from "@/lib/useNetwork";

type Act = "Deposit" | "Borrow" | "Repay" | "Withdraw";
const usd = (n: number, d = 2) => "$" + n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
const hfTxt = (h: number) => (h === Infinity ? "No debt" : h.toFixed(2));

export default function Markets() {
  const net = useNetwork();
  const isMainnet = net.mode === "mainnet";
  const marketList: MarketSpec[] = isMainnet ? MAINNET_MARKETS : [TESTNET_MARKET];

  const [selectedId, setSelectedId] = useState<string>(marketList[0].id);
  const spec = marketList.find((m) => m.id === selectedId) ?? marketList[0];

  const MAX_LTV = spec.maxLtv;
  const LIQ = spec.liqThreshold;
  const APR = spec.apr;

  const L = useLengo(spec);
  const { connectAsync } = useConnect();
  const tx2 = useLengoTx(() => L.refetch(), spec);

  const collSym = spec.collSymbol;
  const debtSym = spec.debtSymbol;
  const pairLabel = `${collSym} / ${debtSym}`;

  const [supplyAmt, setSupplyAmt] = useState("");
  const [lendTab, setLendTab] = useState<"Supply" | "WithdrawSupply">("Supply");
  const [hist, setHist] = useState<null | { source: string; closes: number[]; high: number; low: number; latest: number; changePct: number }>(null);

  // Fetch real 48h hourly price history for the selected market's collateral asset
  useEffect(() => {
    let cancelled = false;
    setHist(null);
    const sym = isMainnet ? spec.collSymbol : "BTC";
    fetch(`/api/prices/history?symbol=${encodeURIComponent(sym)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d && Array.isArray(d.closes) && d.closes.length >= 2) setHist(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isMainnet, spec.collSymbol]);

  const D = L.data;
  const P = L.pool;
  const coll = D ? D.coll : 0;
  const debt = D ? D.debt : 0;
  const wallet = D ? { coll: D.collBal, debt: D.debtBal } : { coll: 0, debt: 0 };
  const PRICE = P ? P.price : hist ? hist.latest : spec.fallbackPrice;
  const nowS = Math.floor(Date.now() / 1000);
  const priceAge = P && P.priceAt > 0 ? Math.max(0, nowS - P.priceAt, nowS - P.debtPriceAt) : 0;
  const stale = P ? priceAge > P.maxAge : false;
  const paused = Boolean(P?.paused || D?.paused);
  const toast = useToast();
  const [refreshing, setRefreshing] = useState(false);

  async function requestRefresh() {
    setRefreshing(true);
    try {
      const r = await fetch("/api/oracle/refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: net.mode }),
      });
      const j = await r.json();
      if (j.ok && j.sent) {
        Object.entries(j.sent as Record<string, string>).forEach(([k, h]) =>
          toast.push({ kind: "ok", title: `Oracle refreshed · ${k}`, detail: "Baseline price re-posted by keeper", hash: h })
        );
      } else if (j.ok) toast.push({ kind: "info", title: "Prices are already fresh" });
      else toast.push({ kind: "err", title: "Refresh unavailable", detail: j.reason });
      L.refetch();
    } catch (e) {
      toast.push({ kind: "err", title: "Refresh failed", detail: String(e) });
    } finally {
      setRefreshing(false);
    }
  }

  const hfOf = (c: number, d: number) => (d <= 0 ? Infinity : (c * PRICE * LIQ) / d);
  const [mode, setMode] = useState<"Borrow" | "Lend">("Borrow");
  const [act, setAct] = useState<Act>("Borrow");
  const [view, setView] = useState("Chart");
  const [amt, setAmt] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && tx2.steps && !tx2.busy) tx2.close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const pool = P ? { supplied: P.supplied, borrowed: P.borrowed } : { supplied: 0, borrowed: 0 };
  const avail = Math.max(0, pool.supplied - pool.borrowed);

  const a = parseFloat(amt) || 0;
  const C = coll * PRICE;
  const cap = Math.max(0, C * MAX_LTV - debt);
  const maxFor: Record<Act, number> = {
    Deposit: wallet.coll,
    Borrow: Math.min(cap, avail),
    Repay: Math.min(debt, wallet.debt),
    Withdraw: debt === 0 ? coll : Math.max(0, coll - debt / (PRICE * MAX_LTV)),
  };
  const next = useMemo(() => {
    let c = coll, d = debt;
    if (act === "Deposit") c += a;
    if (act === "Withdraw") c -= a;
    if (act === "Borrow") d += a;
    if (act === "Repay") d -= a;
    return { c, d };
  }, [a, act, coll, debt]);

  const isCollAct = act === "Deposit" || act === "Withdraw";
  const unit = isCollAct ? collSym : debtSym;
  const over = a > maxFor[act] + 1e-9;
  const blockedByStale = stale && (act === "Borrow" || (act === "Withdraw" && debt > 0));
  const blockedByPause = paused && (act === "Deposit" || act === "Borrow");
  const blocked = blockedByStale || blockedByPause || !L.marketDeployed;
  const ltv = C ? debt / C : 0;
  const hf = hfOf(coll, debt), nhf = hfOf(next.c, next.d);
  const liqP = debt > 0 && coll > 0 ? debt / (coll * LIQ) : 0;
  const tone = (h: number) => (h === Infinity || h >= 1.3 ? s.ok : h >= 1.15 ? s.warn : s.bad);

  async function submit() {
    if (!a || over || !L.marketDeployed) return;
    if (!L.isConnected) {
      try {
        await connectAsync({ connector: injected(), chainId: net.chain.id });
      } catch {
        return;
      }
    }
    tx2.run(act, amt, { all: act === "Repay" && a >= debt - 1e-6, debt });
    setAmt("");
  }

  const W = 1000, H = 300;
  const path = useMemo(() => {
    if (hist && hist.closes.length >= 2) {
      if (!isMainnet && P && hist.latest > 0) {
        const scale = P.price / hist.latest;
        return hist.closes.map((c) => c * scale);
      }
      return hist.closes;
    }
    return Array.from({ length: 48 }, (_, i) => PRICE * (1 + 0.015 * Math.sin(i / 5)));
  }, [hist, isMainnet, P, PRICE]);
  const minP = Math.min(...path, liqP > 0 ? liqP : Infinity);
  const maxP = Math.max(...path, PRICE);
  const lo = minP * 0.96, hi = maxP * 1.04;
  const y = (p: number) => H - ((p - lo) / Math.max(0.0001, hi - lo)) * H;
  const line = path.map((p, i) => `${(i / (path.length - 1)) * W},${y(p).toFixed(1)}`).join(" ");
  const priceDigits = PRICE >= 1000 ? 0 : PRICE >= 2 ? 2 : 4;

  return (
    <>
      <div className={s.pageHead}>
        <div><h1>Markets</h1><p>Isolated crypto &amp; Robinhood stock-token lending on Robinhood Chain. Payout routes via NEAR Intents.</p></div>
        <span>{isMainnet ? `Mainnet · ${marketList.length} Markets · 4663` : "Testnet · Robinhood Chain · 46630"}</span>
      </div>

      <HealthAlert hf={hf} live={L.live} />
      <div className={`${s.frame} bevel`}>
        <aside className={s.list}>
          <div className={s.listHead}><span>Markets</span><b>{marketList.length}</b></div>
          <label className={s.search}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
            <input placeholder="Search WETH, cbBTC, NVDA, TSLA…" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          {marketList
            .filter((m) => m.pair.toLowerCase().includes(q.toLowerCase()) || m.category.toLowerCase().includes(q.toLowerCase()))
            .map((m) => {
              const active = m.id === spec.id;
              return (
                <button
                  key={m.id}
                  className={`${s.mkt} ${active ? s.mktOn : ""}`}
                  onClick={() => {
                    setSelectedId(m.id);
                    setAmt("");
                    setSupplyAmt("");
                  }}
                >
                  <Pair a={m.collSymbol} b={m.debtSymbol} />
                  <span><b>{m.pair}</b><small>{m.sub}</small></span>
                  {!m.market && <em>Deploy</em>}
                </button>
              );
            })}
        </aside>

        <section className={s.center}>
          <div className={s.mHead}>
            <Pair a={collSym} b={debtSym} size={42} />
            <div>
              <h2>{pairLabel}</h2>
              <p>{spec.category} isolated market · fixed {(APR * 100).toFixed(1)}% APR · {net.chain.name}</p>
            </div>
            <div className={s.badges}>
              <span className={L.marketDeployed ? s.active : ""}>{L.marketDeployed ? "Active" : "Oracle Live"}</span>
              <a href={addrUrl(spec.market ?? spec.chainlinkFeed ?? spec.collateral, net.mode)} target="_blank" rel="noreferrer">Explorer ↗</a>
            </div>
          </div>
          <div className={s.stats}>
            <div><span>Oracle price</span><b>{usd(PRICE, priceDigits)}</b></div>
            <div><span>Borrow APR</span><b>{(APR * 100).toFixed(2)}%</b></div>
            <div><span>Supplied</span><b>{usd(pool.supplied, 0)}</b></div>
            <div><span>Borrowed</span><b>{usd(pool.borrowed, 0)}</b></div>
            <div><span>Available</span><b>{usd(avail, 0)}</b></div>
            <div><span>Utilization</span><b>{pool.supplied > 0 ? ((pool.borrowed / pool.supplied) * 100).toFixed(1) : "0.0"}%</b></div>
            <div><span>Max LTV / Liq.</span><b>{Math.round(MAX_LTV * 100)}% / {Math.round(LIQ * 100)}%</b></div>
          </div>
          <div className={s.strip}>
            <span className={stale ? s.bad : ""}>Oracle · {net.oracleLabel} · {stale ? `stale ${priceAge}s` : `fresh ${priceAge}s`}</span>
            <span className={s.ok}>HF {hfTxt(hf)}</span>
            <span className={L.marketDeployed ? s.ok : s.amberT}>
              {paused
                ? "Market paused (exits & repayments open)"
                : L.marketDeployed
                  ? `Live · read from ${net.chain.name}`
                  : `Live Chainlink feed · run deploy-extra-markets.sh to open ${pairLabel} pool`}
            </span>
          </div>
          <div className={s.views} role="tablist" aria-label="Market view">
            {["Chart", "Position", "Risk"].map((v) => <button key={v} role="tab" aria-selected={view === v} className={view === v ? s.vOn : ""} onClick={() => setView(v)}>{v}</button>)}
          </div>

          <div className={s.viewBody}>
            {view === "Chart" && (
              <>
                <div className={s.chartHead}>
                  <div>
                    <span>{collSym} price · {hist?.source === "pyth-pro" ? "Pyth Pro 48h" : "Market 48h"}</span>
                    <b>{usd(PRICE, priceDigits)}</b>
                    <small>
                      {hist
                        ? `${hist.source === "pyth-pro" ? "Live Pyth Pro candles" : "Live market candles"} · 48h ${hist.changePct >= 0 ? "+" : ""}${hist.changePct.toFixed(2)}%`
                        : `Chainlink ${collSym}/USD onchain feed`}
                    </small>
                  </div>
                  <div className={s.legend}><i className={s.lgP} />Price<i className={s.lgL} />Your liq. price</div>
                </div>
                <svg viewBox={`0 0 ${W} ${H}`} className={s.chart} preserveAspectRatio="none">
                  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c9f27a" stopOpacity=".18" /><stop offset="1" stopColor="#c9f27a" stopOpacity="0" /></linearGradient></defs>
                  {[0.25, 0.5, 0.75].map((f) => <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="var(--line)" />)}
                  <polygon points={`0,${H} ${line} ${W},${H}`} fill="url(#g)" />
                  <polyline points={line} fill="none" stroke="var(--lime)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
                  {liqP > lo && liqP < hi && <><line x1="0" x2={W} y1={y(liqP)} y2={y(liqP)} stroke="var(--red)" strokeDasharray="6 6" vectorEffect="non-scaling-stroke" /><text x={W - 8} y={y(liqP) - 8} textAnchor="end" fill="var(--red)" fontSize="13" fontFamily="var(--mono)">LIQ {usd(liqP, priceDigits)}</text></>}
                </svg>
              </>
            )}
            {view === "Position" && (
              <div className={s.kv}>
                <div><span>Collateral</span><b>{coll.toFixed(4)} {collSym}</b><small>{usd(C)}</small></div>
                <div><span>Debt incl. interest</span><b>{usd(debt)}</b><small>{(APR * 100).toFixed(1)}% APR · {debtSym}</small></div>
                <div><span>Borrow capacity</span><b>{usd(cap)}</b><small>at {Math.round(MAX_LTV * 100)}% LTV</small></div>
                <div><span>Health factor</span><b className={tone(hf)}>{hfTxt(hf)}</b><small>liq. below 1.00</small></div>
                <div><span>Current LTV</span><b>{(ltv * 100).toFixed(2)}%</b><small>max {Math.round(MAX_LTV * 100)}%</small></div>
                <div><span>Est. liq. price</span><b>{liqP ? usd(liqP, priceDigits) : "No debt"}</b><small>{collSym} / USD</small></div>
              </div>
            )}
            {view === "Risk" && (
              <div className={s.risk}>
                <div className={s.bar}>
                  <i style={{ width: `${Math.min(100, (ltv / 0.95) * 100)}%` }} />
                  <em style={{ left: `${(MAX_LTV / 0.95) * 100}%` }}>MAX {Math.round(MAX_LTV * 100)}%</em>
                  <em style={{ left: `${(LIQ / 0.95) * 100}%` }} className={s.bad}>LIQ {Math.round(LIQ * 100)}%</em>
                </div>
                <pre>{`LTV           = ${usd(debt)} / ${usd(C)} = ${(ltv * 100).toFixed(2)}%
Health factor = (C × ${LIQ.toFixed(2)}) / D = ${hfTxt(hf)}
Liq. price    = D / (qty × ${LIQ.toFixed(2)}) = ${liqP ? usd(liqP, priceDigits) : "No debt"}`}</pre>
                <p>Alerts at HF 1.30 and 1.15. Liquidator bonus 5%, close factor 50%.</p>
              </div>
            )}
          </div>
          <div className={s.footLine}>
            {spec.market ? `Market ${spec.market}` : `Token ${spec.collateral} · Chainlink ${spec.chainlinkFeed}`} · chain is the source of truth
          </div>
        </section>

        <aside className={s.action}>
          <div className={s.mode}>
            {(["Borrow", "Lend"] as const).map((m) => (
              <button key={m} className={mode === m ? s.mOn : ""} onClick={() => { setMode(m); setAct(m === "Borrow" ? "Borrow" : "Deposit"); setAmt(""); }}>
                {m === "Borrow" ? "⇄" : "◈"} {m}
              </button>
            ))}
          </div>
          {mode === "Borrow" ? (
            <div className={s.acts} role="tablist" aria-label="Action">
              {(["Deposit", "Borrow", "Repay", "Withdraw"] as Act[]).map((t) => (
                <button key={t} role="tab" aria-selected={act === t} className={act === t ? s.aOn : ""} onClick={() => { setAct(t); setAmt(""); }}>{t}</button>
              ))}
            </div>
          ) : (
            <div className={s.acts}>
              <button className={lendTab === "Supply" ? s.aOn : ""} onClick={() => setLendTab("Supply")}>Supply</button>
              <button className={lendTab === "WithdrawSupply" ? s.aOn : ""} onClick={() => setLendTab("WithdrawSupply")}>Withdraw</button>
            </div>
          )}

          <div className={s.aBody}>
            <span className={s.k}>{mode === "Borrow" ? `${spec.category} collateralized borrowing` : `Lend ${debtSym} to ${pairLabel}`}</span>
            <h3>{mode === "Borrow" ? act : lendTab === "Supply" ? "Supply" : "Withdraw supply"}</h3>
            {mode === "Borrow" ? (
              <>
                <div className={s.field}>
                  <div className={s.fTop}><span>Amount</span><span>Max {maxFor[act].toLocaleString("en-US", { maximumFractionDigits: isCollAct ? 6 : 2 })}</span></div>
                  <div className={s.fRow}>
                    <input inputMode="decimal" placeholder="0.0" value={amt} aria-label="Amount" onChange={(e) => setAmt(e.target.value.replace(/[^0-9.]/g, ""))} />
                    <button onClick={() => setAmt(String(+maxFor[act].toFixed(6)))}>Max</button>
                    <span className={s.tok}>{unit}</span>
                  </div>
                </div>
                <div className={s.sim}>
                  <div><span>Health factor</span><b><em className={tone(hf)}>{hfTxt(hf)}</em> → <em className={tone(nhf)}>{hfTxt(nhf)}</em></b></div>
                  <div><span>LTV</span><b>{(ltv * 100).toFixed(1)}% → {next.c ? ((next.d / (next.c * PRICE)) * 100).toFixed(1) : "0.0"}%</b></div>
                  <div><span>Debt</span><b>{usd(debt)} → {usd(Math.max(0, next.d))}</b></div>
                  <div><span>Settle on</span><b>{isMainnet ? "RH Mainnet" : "RH Testnet"}</b></div>
                </div>
                {over && <p className={`${s.note} ${s.bad}`}>Exceeds the allowed maximum.</p>}
                {blockedByPause && <p className={`${s.note} ${s.bad}`}>Market is paused for new deposits/borrows. Repay and Withdraw remain open.</p>}
                {blockedByStale && !isMainnet && <p className={`${s.note} ${s.bad}`}>Oracle price is stale. <button className={s.inlineBtn} disabled={refreshing} onClick={requestRefresh}>{refreshing ? "Refreshing…" : "Request price refresh"}</button></p>}
                {L.marketDeployed && avail <= 0 && act === "Borrow" && <p className={`${s.note} ${s.warn}`}>No liquidity in this isolated pool yet — supply {debtSym} first.</p>}
                <button className={s.cta} disabled={!a || over || blocked || tx2.busy} onClick={submit}>
                  {!L.marketDeployed
                    ? `Deploy ${pairLabel} contract first`
                    : tx2.busy
                      ? "Waiting for wallet…"
                      : !a
                        ? "Enter amount"
                        : over
                          ? "Exceeds max"
                          : act === "Repay" && a >= debt - 1e-6
                            ? "Repay all"
                            : `${act} ${unit}`}
                </button>
              </>
            ) : (
              <>
                <div className={s.field}>
                  <div className={s.fTop}>
                    <span>{lendTab === "Supply" ? "You supply" : "You withdraw"}</span>
                    <span>{lendTab === "Supply" ? `Balance ${wallet.debt.toFixed(2)}` : `Claim ${(D ? D.claim : 0).toFixed(2)}`}</span>
                  </div>
                  <div className={s.fRow}>
                    <input placeholder="0.0" aria-label="Lend amount" value={supplyAmt} onChange={(e) => setSupplyAmt(e.target.value.replace(/[^0-9.]/g, ""))} />
                    <span className={s.tok}>{debtSym}</span>
                  </div>
                </div>
                <div className={s.sim}>
                  <div><span>Supply APY (est.)</span><b>{pool.supplied > 0 ? ((pool.borrowed / pool.supplied) * APR * 100).toFixed(2) : "0.00"}%</b></div>
                  <div><span>Idle liquidity</span><b>{usd(avail, 0)}</b></div>
                  <div><span>Interest source</span><b>Borrowers</b></div>
                  <div><span>Your claim</span><b>{usd(D ? D.claim : 0)}</b></div>
                </div>
                <button
                  className={s.cta}
                  disabled={!L.marketDeployed || !parseFloat(supplyAmt) || (lendTab === "Supply" && (paused || parseFloat(supplyAmt) > wallet.debt)) || tx2.busy}
                  onClick={async () => {
                    if (!L.isConnected) {
                      try { await connectAsync({ connector: injected(), chainId: net.chain.id }); } catch { return; }
                    }
                    tx2.run(lendTab, supplyAmt);
                    setSupplyAmt("");
                  }}
                >
                  {!L.marketDeployed ? `Deploy ${pairLabel} contract first` : !parseFloat(supplyAmt) ? "Enter amount" : lendTab === "Supply" ? `Supply ${debtSym}` : `Withdraw ${debtSym}`}
                </button>
              </>
            )}
            <p className={s.note}>
              Wallet · {wallet.coll.toFixed(4)} {collSym} · {wallet.debt.toFixed(2)} {debtSym} · {net.chain.name}
            </p>
          </div>
        </aside>
      </div>

      {tx2.steps && (
        <div className={s.modalWrap} role="dialog" aria-modal="true" aria-label="Transaction">
          <div className={`${s.modal} bevel`}>
            <span className={s.k}>Transaction · {pairLabel} · {net.chain.name}</span>
            <h3>{mode === "Borrow" ? act : lendTab}</h3>
            <div className={s.steps}>
              {tx2.steps.map((st, i) => (
                <div key={i} className={st.state === "done" ? s.sDone : st.state === "sign" || st.state === "pending" ? s.sNow : ""} style={st.state === "failed" ? { color: "var(--red)" } : undefined}>
                  <i>{st.state === "done" ? "✓" : st.state === "failed" ? "×" : i + 1}</i>{st.label}
                  {st.hash && <a href={txUrl(st.hash, net.mode)} target="_blank" rel="noreferrer" style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 10, color: "var(--tx2)" }}>tx ↗</a>}
                </div>
              ))}
            </div>
            <div className={s.mBtns}><button className="btn btn-primary" autoFocus disabled={tx2.busy} onClick={tx2.close}>{tx2.busy ? "Working…" : "Close"}</button></div>
          </div>
        </div>
      )}
    </>
  );
}
