"use client";
import { Pair } from "../TokenIcon";
import { useMemo, useState } from "react";
import s from "./trade.module.css";
import HealthAlert from "./HealthAlert";
import { useLengo, useLengoTx } from "@/lib/useLengo";
import { isDeployed, txUrl, addrUrl, deployment } from "@/lib/chain";

const SIM_PRICE = 100_000, MAX_LTV = 0.6, LIQ = 0.75, APR = 0.08;
type Act = "Deposit" | "Borrow" | "Repay" | "Withdraw";
const usd = (n: number, d = 2) => "$" + n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
const hfTxt = (h: number) => (h === Infinity ? "No debt" : h.toFixed(2));

const markets = [
  { pair: "tBTC/tUSDC", sub: "Isolated · 8% APR", c1: "#f2a93b", c2: "#7fb6f2", t1: "₿", t2: "$", live: true },
  { pair: "BTC/USDC", sub: "Native BTC · spike", c1: "#f2a93b", c2: "#7fb6f2", t1: "₿", t2: "$" },
  { pair: "ZEC/USDG", sub: "Research", c1: "#e8c46b", c2: "#7fe0b4", t1: "Z", t2: "G" },
  { pair: "SOL/USDG", sub: "Research", c1: "#9b8cf2", c2: "#7fe0b4", t1: "S", t2: "G" },
];

// deterministic demo price path
const path = Array.from({ length: 60 }, (_, i) => SIM_PRICE * (1 + 0.035 * Math.sin(i / 6) + 0.015 * Math.sin(i / 2.3) - 0.0004 * (60 - i)));

export default function Markets() {
  const L = useLengo();
  const tx2 = useLengoTx(() => L.refetch());
  const [simColl, setColl] = useState(0.1);
  const [simDebt, setDebt] = useState(4000);
  const [simWallet, setWallet] = useState({ tBTC: 0.25, tUSDC: 1500 });
  const [supplyAmt, setSupplyAmt] = useState("");
  const D = L.data;
  const live = !!D;
  const coll = D ? D.coll : simColl;
  const debt = D ? D.debt : simDebt;
  const wallet = D ? { tBTC: D.tBTC, tUSDC: D.tUSDC } : simWallet;
  const PRICE = D ? D.price : SIM_PRICE;
  const priceAge = D ? Math.max(0, Math.floor(Date.now() / 1000) - D.priceAt) : 12;
  const stale = D ? priceAge > D.maxAge : false;
  const hfOf = (c: number, d: number) => (d <= 0 ? Infinity : (c * PRICE * LIQ) / d);
  const [mode, setMode] = useState<"Borrow" | "Lend">("Borrow");
  const [act, setAct] = useState<Act>("Borrow");
  const [view, setView] = useState("Chart");
  const [amt, setAmt] = useState("");
  const [q, setQ] = useState("");
  const [tx, setTx] = useState<null | { label: string; step: number }>(null);
  const pool = D ? { supplied: D.supplied, borrowed: D.borrowed } : { supplied: 250_000, borrowed: 118_400 };

  const a = parseFloat(amt) || 0;
  const C = coll * PRICE;
  const cap = Math.max(0, C * MAX_LTV - debt);
  const maxFor: Record<Act, number> = {
    Deposit: wallet.tBTC, Borrow: Math.min(cap, pool.supplied - pool.borrowed),
    Repay: Math.min(debt, wallet.tUSDC), Withdraw: debt === 0 ? coll : Math.max(0, coll - debt / (PRICE * MAX_LTV)),
  };
  const next = useMemo(() => {
    let c = coll, d = debt;
    if (act === "Deposit") c += a; if (act === "Withdraw") c -= a; if (act === "Borrow") d += a; if (act === "Repay") d -= a;
    return { c, d };
  }, [a, act, coll, debt]);
  const over = a > maxFor[act] + 1e-9;
  const blocked = stale && (act === "Borrow" || (act === "Withdraw" && debt > 0));
  const unit = act === "Deposit" || act === "Withdraw" ? "tBTC" : "tUSDC";
  const ltv = C ? debt / C : 0;
  const hf = hfOf(coll, debt), nhf = hfOf(next.c, next.d);
  const liqP = debt > 0 ? debt / (coll * LIQ) : 0;
  const tone = (h: number) => (h === Infinity || h >= 1.3 ? s.ok : h >= 1.15 ? s.warn : s.bad);

  function submit() {
    if (!a || over) return;
    if (live) { tx2.run(act, amt, { all: act === "Repay" && a >= debt - 1e-6, debt }); setAmt(""); return; }
    const approve = act === "Deposit" || act === "Repay";
    let st = approve ? 0 : 1;
    setTx({ label: `${act} ${a} ${unit}`, step: st });
    const iv = setInterval(() => {
      st++; setTx((t) => (t ? { ...t, step: st } : t));
      if (st >= 4) {
        clearInterval(iv); setColl(next.c); setDebt(next.d);
        setWallet((w) => ({ tBTC: w.tBTC + (act === "Withdraw" ? a : act === "Deposit" ? -a : 0), tUSDC: w.tUSDC + (act === "Borrow" ? a : act === "Repay" ? -a : 0) }));
        setAmt("");
      }
    }, 850);
  }

  // chart geometry
  const W = 1000, H = 300, lo = 45_000, hi = 110_000;
  const y = (p: number) => H - ((p - lo) / (hi - lo)) * H;
  const line = path.map((p, i) => `${(i / (path.length - 1)) * W},${y(p).toFixed(1)}`).join(" ");

  return (
    <>
      <div className={s.pageHead}>
        <div><h1>Markets</h1><p>Isolated lending on Robinhood Chain. Payout routes via NEAR Intents.</p></div>
        <span>Testnet · Robinhood Chain · 46630</span>
      </div>

      <HealthAlert hf={hf} live={live} />
      <div className={`${s.frame} bevel`}>
        {/* LEFT: markets */}
        <aside className={s.list}>
          <div className={s.listHead}><span>Markets</span><b>{markets.length}</b></div>
          <label className={s.search}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
            <input placeholder="Search markets" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          {markets.filter((m) => m.pair.toLowerCase().includes(q.toLowerCase())).map((m) => (
            <button key={m.pair} className={`${s.mkt} ${m.live ? s.mktOn : ""}`} disabled={!m.live}>
              <Pair a={m.pair.split("/")[0]} b={m.pair.split("/")[1]} />
              <span><b>{m.pair}</b><small>{m.sub}</small></span>
              {!m.live && <em>Soon</em>}
            </button>
          ))}
        </aside>

        {/* CENTER */}
        <section className={s.center}>
          <div className={s.mHead}>
            <Pair a="tBTC" b="tUSDC" size={42} />
            <div><h2>tBTC / tUSDC</h2><p>Isolated market · fixed 8% APR</p></div>
            <div className={s.badges}><span className={s.active}>Active</span><a href={deployment.market ? addrUrl(deployment.market) : "https://explorer.testnet.chain.robinhood.com"} target="_blank" rel="noreferrer">Explorer ↗</a></div>
          </div>
          <div className={s.stats}>
            <div><span>Oracle price</span><b>{usd(PRICE, 0)}</b></div>
            <div><span>Borrow APR</span><b>8.00%</b></div>
            <div><span>Supplied</span><b>{usd(pool.supplied, 0)}</b></div>
            <div><span>Borrowed</span><b>{usd(pool.borrowed, 0)}</b></div>
            <div><span>Available</span><b>{usd(pool.supplied - pool.borrowed, 0)}</b></div>
            <div><span>Utilization</span><b>{((pool.borrowed / pool.supplied) * 100).toFixed(1)}%</b></div>
            <div><span>Max LTV / Liq.</span><b>60% / 75%</b></div>
          </div>
          <div className={s.strip}>
            <span className={stale ? s.bad : ""}>Oracle · DemoOracle · {stale ? `stale ${priceAge}s` : `fresh ${priceAge}s`}</span>
            <span className={s.ok}>HF {hfTxt(hf)}</span>
            <span className={live ? s.ok : s.amberT}>{live ? "Live · read from RH testnet" : !isDeployed ? "Demo mode · contracts not deployed yet" : "Demo data · connect wallet on RH testnet"}</span>
          </div>
          <div className={s.views}>
            {["Chart", "Position", "Risk"].map((v) => <button key={v} className={view === v ? s.vOn : ""} onClick={() => setView(v)}>{v}</button>)}
          </div>

          <div className={s.viewBody}>
            {view === "Chart" && (
              <>
                <div className={s.chartHead}><div><span>tBTC oracle price</span><b>{usd(PRICE, 0)}</b><small>Demo feed · not a market price</small></div><div className={s.legend}><i className={s.lgP} />Price<i className={s.lgL} />Your liq. price</div></div>
                <svg viewBox={`0 0 ${W} ${H}`} className={s.chart} preserveAspectRatio="none">
                  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c9f27a" stopOpacity=".18" /><stop offset="1" stopColor="#c9f27a" stopOpacity="0" /></linearGradient></defs>
                  {[0.25, 0.5, 0.75].map((f) => <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="var(--line)" />)}
                  <polygon points={`0,${H} ${line} ${W},${H}`} fill="url(#g)" />
                  <polyline points={line} fill="none" stroke="var(--lime)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
                  {liqP > lo && <><line x1="0" x2={W} y1={y(liqP)} y2={y(liqP)} stroke="var(--red)" strokeDasharray="6 6" vectorEffect="non-scaling-stroke" /><text x={W - 8} y={y(liqP) - 8} textAnchor="end" fill="var(--red)" fontSize="13" fontFamily="var(--mono)">LIQ {usd(liqP, 0)}</text></>}
                </svg>
              </>
            )}
            {view === "Position" && (
              <div className={s.kv}>
                <div><span>Collateral</span><b>{coll.toFixed(4)} tBTC</b><small>{usd(C)}</small></div>
                <div><span>Debt incl. interest</span><b>{usd(debt)}</b><small>8% APR</small></div>
                <div><span>Borrow capacity</span><b>{usd(cap)}</b><small>at 60% LTV</small></div>
                <div><span>Health factor</span><b className={tone(hf)}>{hfTxt(hf)}</b><small>liq. below 1.00</small></div>
                <div><span>Current LTV</span><b>{(ltv * 100).toFixed(2)}%</b><small>max 60%</small></div>
                <div><span>Est. liq. price</span><b>{liqP ? usd(liqP) : "No debt"}</b><small>tBTC / USD</small></div>
              </div>
            )}
            {view === "Risk" && (
              <div className={s.risk}>
                <div className={s.bar}>
                  <i style={{ width: `${Math.min(100, (ltv / 0.9) * 100)}%` }} />
                  <em style={{ left: `${(0.6 / 0.9) * 100}%` }}>MAX 60%</em>
                  <em style={{ left: `${(0.75 / 0.9) * 100}%` }} className={s.bad}>LIQ 75%</em>
                </div>
                <pre>{`LTV           = ${usd(debt)} / ${usd(C)} = ${(ltv * 100).toFixed(2)}%
Health factor = (C × 0.75) / D = ${hfTxt(hf)}
Liq. price    = D / (qty × 0.75) = ${liqP ? usd(liqP) : "No debt"}`}</pre>
                <p>Alerts at HF 1.30 and 1.15. Liquidator bonus 5%, close factor 50%.</p>
              </div>
            )}
          </div>
          <div className={s.footLine}>{deployment.market ? `Market ${deployment.market}` : "Market not deployed · demo data"} · {live ? "chain is the source of truth" : "simulated"}</div>
        </section>

        {/* RIGHT: action */}
        <aside className={s.action}>
          <div className={s.mode}>
            {(["Borrow", "Lend"] as const).map((m) => (
              <button key={m} className={mode === m ? s.mOn : ""} onClick={() => { setMode(m); setAct(m === "Borrow" ? "Borrow" : "Deposit"); setAmt(""); }}>
                {m === "Borrow" ? "⇄" : "◈"} {m}
              </button>
            ))}
          </div>
          {mode === "Borrow" ? (
            <div className={s.acts}>
              {(["Deposit", "Borrow", "Repay", "Withdraw"] as Act[]).map((t) => (
                <button key={t} className={act === t ? s.aOn : ""} onClick={() => { setAct(t); setAmt(""); }}>{t}</button>
              ))}
            </div>
          ) : <div className={s.acts}><button className={s.aOn}>Supply</button><button>Withdraw</button></div>}

          <div className={s.aBody}>
            <span className={s.k}>{mode === "Borrow" ? "Collateralized borrowing" : "Lend tUSDC"}</span>
            <h3>{mode === "Borrow" ? act : "Supply"}</h3>
            {mode === "Borrow" ? (
              <>
                <div className={s.field}>
                  <div className={s.fTop}><span>Amount</span><span>Max {maxFor[act].toLocaleString("en-US", { maximumFractionDigits: unit === "tBTC" ? 6 : 2 })}</span></div>
                  <div className={s.fRow}>
                    <input inputMode="decimal" placeholder="0.0" value={amt} aria-label="Amount" onChange={(e) => setAmt(e.target.value.replace(/[^0-9.]/g, ""))} />
                    <button onClick={() => setAmt(String(+maxFor[act].toFixed(unit === "tBTC" ? 8 : 6)))}>Max</button>
                    <span className={s.tok}>{unit}</span>
                  </div>
                </div>
                <div className={s.sim}>
                  <div><span>Health factor</span><b><em className={tone(hf)}>{hfTxt(hf)}</em> → <em className={tone(nhf)}>{hfTxt(nhf)}</em></b></div>
                  <div><span>LTV</span><b>{(ltv * 100).toFixed(1)}% → {next.c ? ((next.d / (next.c * PRICE)) * 100).toFixed(1) : "0.0"}%</b></div>
                  <div><span>Debt</span><b>{usd(debt)} → {usd(Math.max(0, next.d))}</b></div>
                  <div><span>Receive on</span><b>RH Testnet</b></div>
                </div>
                {over && <p className={`${s.note} ${s.bad}`}>Exceeds the allowed maximum.</p>}
                {blocked && <p className={`${s.note} ${s.bad}`}>Oracle price is stale. Borrow and collateral withdrawal with debt are paused; repay and debt-free exit still work.</p>}
                {pool.supplied - pool.borrowed <= 0 && act === "Borrow" && <p className={`${s.note} ${s.warn}`}>No liquidity in the pool right now.</p>}
                <button className={s.cta} disabled={!a || over || blocked || tx2.busy} onClick={submit}>{tx2.busy ? "Waiting for wallet…" : !a ? "Enter amount" : over ? "Exceeds max" : act === "Repay" && a >= debt - 1e-6 ? "Repay all" : `${act} ${unit}`}</button>
              </>
            ) : (
              <>
                <div className={s.field}><div className={s.fTop}><span>You supply</span><span>Balance {wallet.tUSDC.toFixed(2)}</span></div><div className={s.fRow}><input placeholder="0.0" aria-label="Supply amount" value={supplyAmt} onChange={(e) => setSupplyAmt(e.target.value.replace(/[^0-9.]/g, ""))} /><span className={s.tok}>tUSDC</span></div></div>
                <div className={s.sim}>
                  <div><span>Supply APY (est.)</span><b>{((pool.borrowed / pool.supplied) * APR * 100).toFixed(2)}%</b></div>
                  <div><span>Idle liquidity</span><b>{usd(pool.supplied - pool.borrowed, 0)}</b></div>
                  <div><span>Interest source</span><b>Borrowers</b></div>
                  <div><span>Your claim</span><b>{usd(D ? D.claim : 0)}</b></div>
                </div>
                <button className={s.cta} disabled={!live || !parseFloat(supplyAmt) || parseFloat(supplyAmt) > wallet.tUSDC || tx2.busy}
                  onClick={() => { tx2.run("Supply", supplyAmt); setSupplyAmt(""); }}>{!live ? "Connect on RH testnet" : !parseFloat(supplyAmt) ? "Enter amount" : "Supply tUSDC"}</button>
                <button className="btn" disabled={!live || !parseFloat(supplyAmt) || tx2.busy} onClick={() => { tx2.run("WithdrawSupply", supplyAmt); setSupplyAmt(""); }}>Withdraw supply</button>
              </>
            )}
            <p className={s.note}>Wallet · {wallet.tBTC.toFixed(4)} tBTC · {wallet.tUSDC.toFixed(2)} tUSDC · {live ? "testnet demo assets, no value" : "simulated"}</p>
          </div>
        </aside>
      </div>

      {tx2.steps && (
        <div className={s.modalWrap} role="dialog" aria-modal="true" aria-label="Transaction">
          <div className={`${s.modal} bevel`}>
            <span className={s.k}>Transaction · RH testnet</span>
            <h3>{act}</h3>
            <div className={s.steps}>
              {tx2.steps.map((st, i) => (
                <div key={i} className={st.state === "done" ? s.sDone : st.state === "sign" || st.state === "pending" ? s.sNow : ""} style={st.state === "failed" ? { color: "var(--red)" } : undefined}>
                  <i>{st.state === "done" ? "✓" : st.state === "failed" ? "×" : i + 1}</i>{st.label}
                  {st.hash && <a href={txUrl(st.hash)} target="_blank" rel="noreferrer" style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 10, color: "var(--tx2)" }}>tx ↗</a>}
                </div>
              ))}
            </div>
            <div className={s.mBtns}><button className="btn btn-primary" disabled={tx2.busy} onClick={tx2.close}>{tx2.busy ? "Working…" : "Close"}</button></div>
          </div>
        </div>
      )}
      {tx && (
        <div className={s.modalWrap} role="dialog" aria-modal="true" aria-label="Transaction">
          <div className={`${s.modal} bevel`}>
            <span className={s.k}>Transaction · testnet</span>
            <h3>{tx.label}</h3>
            <div className={s.steps}>
              {["Approve token", "Confirm in wallet", "Pending onchain", "Confirmed"].map((l, i) => {
                const done = tx.step > i || tx.step >= 4;
                return <div key={l} className={done ? s.sDone : tx.step === i ? s.sNow : ""}><i>{done ? "✓" : i + 1}</i>{l}</div>;
              })}
            </div>
            {tx.step >= 4 ? (
              <div className={s.mBtns}><a className="btn" href="https://explorer.testnet.chain.robinhood.com" target="_blank" rel="noreferrer">Explorer ↗</a><button className="btn btn-primary" onClick={() => setTx(null)}>Done</button></div>
            ) : <p className={s.note}>Simulated flow · UI preview</p>}
          </div>
        </div>
      )}
    </>
  );
}
