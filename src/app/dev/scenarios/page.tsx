"use client";
import { useCallback, useEffect, useState } from "react";
import { formatUnits, maxUint256, parseUnits, type Address } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import s from "../../app/trade.module.css";
import d from "./scenarios.module.css";
import { marketAbi, oracleAbi, tokenAbi } from "@/lib/abi";
import { deployment, isDeployed, rhTestnet, txUrl, addrUrl } from "@/lib/chain";
import { useNetwork } from "@/lib/useNetwork";
import { useToast } from "../../Toaster";

type Pos = { account: Address; coll: number; debt: number; hf: number };
type Proof = { label: string; hash: string; before?: Pos; after?: Pos; liqBefore?: { tBTC: number; tUSDC: number }; liqAfter?: { tBTC: number; tUSDC: number } };

const presets = [100_000, 80_000, 70_000, 60_000, 50_000, 30_000];
const fmtHf = (h: number) => (h === Infinity ? "No debt" : h.toFixed(3));
const usd = (n: number) => "$" + n.toLocaleString("en-US", { maximumFractionDigits: 2 });

export default function Scenarios() {
  const net = useNetwork();
  const { address, isConnected, chainId } = useAccount();
  const client = usePublicClient({ chainId: rhTestnet.id });
  const { writeContractAsync } = useWriteContract();
  const onChain = isConnected && chainId === rhTestnet.id;

  const [owner, setOwner] = useState<Address | null>(null);
  const [price, setPrice] = useState<{ p: number; at: number } | null>(null);
  const [custom, setCustom] = useState("");
  const [positions, setPositions] = useState<Pos[] | null>(null);
  const [acct, setAcct] = useState<null | { supplied: number; idle: number; debt: number; marketBal: number; shares: bigint }>(null);
  const [liqs, setLiqs] = useState<{ hash: string; borrower: string; repaid: number; seized: number; block: bigint }[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const toast = useToast();

  const readPos = useCallback(async (a: Address): Promise<Pos> => {
    const r = await client!.readContract({ address: deployment.market!, abi: marketAbi, functionName: "getPosition", args: [a] }) as readonly bigint[];
    return { account: a, coll: Number(formatUnits(r[0], 8)), debt: Number(formatUnits(r[1], 6)), hf: r[2] === maxUint256 ? Infinity : Number(formatUnits(r[2], 18)) };
  }, [client]);

  const bal = useCallback(async (a: Address) => {
    const [b, u] = await Promise.all([
      client!.readContract({ address: deployment.tBTC!, abi: tokenAbi, functionName: "balanceOf", args: [a] }) as Promise<bigint>,
      client!.readContract({ address: deployment.tUSDC!, abi: tokenAbi, functionName: "balanceOf", args: [a] }) as Promise<bigint>,
    ]);
    return { tBTC: Number(formatUnits(b, 8)), tUSDC: Number(formatUnits(u, 6)) };
  }, [client]);

  const load = useCallback(async () => {
    if (!client || !isDeployed) return;
    const m = { address: deployment.market!, abi: marketAbi } as const;
    const [own, pr, idle, supplied, debt, shares, mbal] = await Promise.all([
      client.readContract({ address: deployment.oracle!, abi: oracleAbi, functionName: "owner" }) as Promise<Address>,
      client.readContract({ address: deployment.oracle!, abi: oracleAbi, functionName: "getPrice", args: [deployment.tBTC!] }) as Promise<readonly bigint[]>,
      client.readContract({ ...m, functionName: "idle" }) as Promise<bigint>,
      client.readContract({ ...m, functionName: "totalSupplyAssets" }) as Promise<bigint>,
      client.readContract({ ...m, functionName: "totalDebt" }) as Promise<bigint>,
      client.readContract({ ...m, functionName: "totalSupplyShares" }) as Promise<bigint>,
      client.readContract({ address: deployment.tUSDC!, abi: tokenAbi, functionName: "balanceOf", args: [deployment.market!] }) as Promise<bigint>,
    ]);
    setOwner(own);
    setPrice({ p: Number(formatUnits(pr[0], 8)), at: Number(pr[1]) });
    setAcct({ idle: Number(formatUnits(idle, 6)), supplied: Number(formatUnits(supplied, 6)), debt: Number(formatUnits(debt, 6)), marketBal: Number(formatUnits(mbal, 6)), shares });

    const borrowed = await client.getContractEvents({ address: deployment.market!, abi: marketAbi, eventName: "Borrowed", fromBlock: deployment.startBlock, toBlock: "latest" });
    const accounts = [...new Set(borrowed.map((l) => (l.args as { account: Address }).account))];
    const ps = await Promise.all(accounts.map(readPos));
    setPositions(ps.filter((p) => p.debt > 0).sort((a, b) => a.hf - b.hf));

    const ev = await client.getContractEvents({ address: deployment.market!, abi: marketAbi, eventName: "Liquidated", fromBlock: deployment.startBlock, toBlock: "latest" });
    setLiqs(ev.map((l) => {
      const a = l.args as { borrower: string; repaid: bigint; seized: bigint };
      return { hash: l.transactionHash, borrower: a.borrower, repaid: Number(formatUnits(a.repaid, 6)), seized: Number(formatUnits(a.seized, 8)), block: l.blockNumber };
    }).reverse());
  }, [client, readPos]);

  useEffect(() => { load(); const id = setInterval(() => { setNow(Math.floor(Date.now() / 1000)); }, 1000); const r = setInterval(load, 15_000); return () => { clearInterval(id); clearInterval(r); }; }, [load]);

  const isOwner = !!owner && !!address && owner.toLowerCase() === address.toLowerCase();
  const age = price ? now - price.at : 0;

  async function send(label: string, fn: () => Promise<`0x${string}`>) {
    setBusy(label); setMsg("Confirm in wallet");
    try {
      const h = await fn();
      setMsg("Pending onchain");
      const rc = await client!.waitForTransactionReceipt({ hash: h, timeout: 120_000 });
      if (rc.status !== "success") throw new Error("reverted");
      setMsg(""); toast.push({ kind: "ok", title: `${label === "oracle" ? "Oracle update" : label === "approve" ? "Approval" : "Liquidation"} confirmed`, hash: h }); return h;
    } catch (e) {
      const m = (e as Error).message;
      const why = /rejected|denied/i.test(m) ? "Rejected in wallet" : /timed out/i.test(m) ? "Unknown status · check explorer" : "Failed: " + m.split("\n")[0].slice(0, 120);
      setMsg(why); toast.push({ kind: /timed out/i.test(m) ? "info" : "err", title: why });
      return null;
    } finally { setBusy(null); }
  }

  async function setOracle(p: number, demo: boolean) {
    const h = await send("oracle", () => writeContractAsync({ address: deployment.oracle!, abi: oracleAbi, functionName: "setPrice", args: [deployment.tBTC!, parseUnits(String(p), 8), demo], chainId: rhTestnet.id }));
    if (!h) return;
    setProofs((x) => [{ label: `${demo ? "Demo price override" : "Price refresh"} · tBTC ${usd(p)}`, hash: h }, ...x]);
    // liquidation and borrow price BOTH assets, so keep the debt-asset baseline fresh too
    const h2 = await send("oracle", () => writeContractAsync({ address: deployment.oracle!, abi: oracleAbi, functionName: "setPrice", args: [deployment.tUSDC!, parseUnits("1", 8), false], chainId: rhTestnet.id }));
    if (h2) setProofs((x) => [{ label: "Price refresh · tUSDC $1", hash: h2 }, ...x]);
    load();
  }

  async function liquidate(p: Pos) {
    if (!address) return;
    const before = await readPos(p.account);
    const liqBefore = await bal(address);
    const repay = Math.ceil(before.debt * 0.5 * 1e6 + 10) / 1e6; // close factor 50% + rounding buffer
    const ok = await send("approve", () => writeContractAsync({ address: deployment.tUSDC!, abi: tokenAbi, functionName: "approve", args: [deployment.market!, parseUnits(repay.toFixed(6), 6)], chainId: rhTestnet.id }));
    if (!ok) return;
    const h = await send("liquidate", () => writeContractAsync({ address: deployment.market!, abi: marketAbi, functionName: "liquidate", args: [p.account, maxUint256], chainId: rhTestnet.id }));
    if (!h) return;
    const after = await readPos(p.account);
    const liqAfter = await bal(address);
    setProofs((x) => [{ label: `Liquidation · ${p.account.slice(0, 8)}…`, hash: h, before, after, liqBefore, liqAfter }, ...x]);
    load();
  }

  const supplyGap = acct ? Math.abs(acct.supplied - (acct.idle + acct.debt)) : 0;
  const balGap = acct ? acct.marketBal - acct.idle : 0;

  if (net.mode === "mainnet") {
    return (
      <>
        <div className={s.pageHead}>
          <div><h1>Dev · Scenarios (Disabled on Mainnet)</h1><p>Mainnet uses PriceOracle without demoOverride — manual scenario overrides do not exist on Mainnet.</p></div>
          <span className={d.warnTag}>Testnet-only tool</span>
        </div>
        <p className={d.banner}>Switch back to Robinhood Chain Testnet (46630) if you want to run the two-wallet DemoOracle liquidation scenario.</p>
      </>
    );
  }

  return (
    <>
      <div className={s.pageHead}>
        <div><h1>Dev · Scenarios</h1><p>Authorized testnet panel for the liquidation demo. Not part of normal navigation.</p></div>
        <span className={d.warnTag}>Testnet operator only · demo prices are not market prices</span>
      </div>

      {!isDeployed && <p className={d.banner}>Contracts not deployed.</p>}
      {isDeployed && !onChain && <p className={d.banner}>Connect a wallet on Robinhood Chain Testnet. Price controls need the oracle owner; liquidation needs a second wallet with tUSDC.</p>}

      <div className={d.grid}>
        {/* ORACLE */}
        <section className={`${d.card} bevel`}>
          <div className={d.head}><span className={s.k}>01 · DemoOracle</span>{owner && <a href={addrUrl(deployment.oracle!)} target="_blank" rel="noreferrer">owner {owner.slice(0, 6)}…{owner.slice(-4)} ↗</a>}</div>
          <div className={d.big}><b>{price ? usd(price.p) : "—"}</b><span>tBTC / USD</span></div>
          <div className={d.row}><span>Updated</span><b className={age > 300 ? s.bad : s.ok}>{price ? `${age}s ago · ${age > 300 ? "stale" : "fresh"} (max 300s)` : "—"}</b></div>
          <div className={d.presets}>
            {presets.map((p) => (
              <button key={p} className="btn" disabled={!isOwner || !!busy} onClick={() => setOracle(p, p !== 100_000)}>{usd(p)}</button>
            ))}
          </div>
          <div className={d.customRow}>
            <input placeholder="Custom USD price" value={custom} onChange={(e) => setCustom(e.target.value.replace(/[^0-9.]/g, ""))} aria-label="Custom price" />
            <button className="btn" disabled={!isOwner || !parseFloat(custom) || !!busy} onClick={() => setOracle(parseFloat(custom), true)}>Override</button>
            <button className="btn" disabled={!isOwner || !price || !!busy} onClick={() => price && setOracle(price.p, false)}>Refresh</button>
          </div>
          <p className={d.note}>{isOwner ? "Every change emits PriceUpdated onchain. Any price other than the $100,000 baseline is sent with demoOverride = true." : onChain ? "Connected wallet is not the oracle owner. Controls are read-only." : "Read-only until the oracle owner connects."}</p>
        </section>

        {/* ACCOUNTING */}
        <section className={`${d.card} bevel`}>
          <div className={d.head}><span className={s.k}>02 · Accounting checks</span><button className={d.link} onClick={load}>Reload</button></div>
          {acct ? (
            <>
              <div className={d.row}><span>Supplier claims (total)</span><b>{usd(acct.supplied)}</b></div>
              <div className={d.row}><span>Idle liquidity</span><b>{usd(acct.idle)}</b></div>
              <div className={d.row}><span>Outstanding debt</span><b>{usd(acct.debt)}</b></div>
              <div className={d.row}><span>tUSDC held by market</span><b>{usd(acct.marketBal)}</b></div>
              <div className={d.checks}>
                <div className={supplyGap < 0.01 ? d.pass : d.fail}><i>{supplyGap < 0.01 ? "✓" : "×"}</i>Claims = idle + debt <em>Δ {supplyGap.toFixed(6)}</em></div>
                <div className={balGap >= -0.000001 ? d.pass : d.fail}><i>{balGap >= -0.000001 ? "✓" : "×"}</i>Market balance ≥ idle <em>{balGap > 0.000001 ? `donation ${balGap.toFixed(6)}` : "exact"}</em></div>
                <div className={d.pass}><i>✓</i>Collateral is not lender cash <em>separate token</em></div>
              </div>
            </>
          ) : <p className={d.note}>Loading…</p>}
        </section>

        {/* POSITIONS */}
        <section className={`${d.card} ${d.wide} bevel`}>
          <div className={d.head}><span className={s.k}>03 · Open positions</span><span className={d.dim}>{positions ? `${positions.length} with debt · from Borrowed events` : "Scanning events…"}</span></div>
          <div className={d.table}>
            <div className={d.th}><span>Borrower</span><span>Collateral</span><span>Debt</span><span>Health factor</span><span>Status</span><span /></div>
            {positions?.length === 0 && <div className={d.empty}>No open debt yet. Borrow from /app with one wallet, then come back with another.</div>}
            {positions?.map((p) => {
              const elig = p.hf < 1;
              const self = address?.toLowerCase() === p.account.toLowerCase();
              return (
                <div key={p.account} className={d.tr}>
                  <span><a href={addrUrl(p.account)} target="_blank" rel="noreferrer">{p.account.slice(0, 8)}…{p.account.slice(-6)}</a>{self && <em className={d.you}>you</em>}</span>
                  <span>{p.coll.toFixed(6)} tBTC</span>
                  <span>{p.debt.toFixed(2)} tUSDC</span>
                  <span className={p.hf < 1 ? s.bad : p.hf < 1.15 ? s.warn : p.hf < 1.3 ? s.amberT : s.ok}>{fmtHf(p.hf)}</span>
                  <span>{elig ? <em className={d.elig}>Eligible</em> : p.hf < 1.3 ? <em className={d.warnB}>Warning</em> : <em>Healthy</em>}</span>
                  <span><button className="btn" disabled={!elig || !onChain || self || !!busy} title={self ? "Use a different wallet to liquidate" : ""} onClick={() => liquidate(p)}>{busy === "approve" || busy === "liquidate" ? "Working…" : "Liquidate ≤ 50%"}</button></span>
                </div>
              );
            })}
          </div>
          {msg && <p className={d.msg}>{msg}</p>}
        </section>

        {/* PROOF */}
        <section className={`${d.card} ${d.wide} bevel`}>
          <div className={d.head}><span className={s.k}>04 · Proof index</span><span className={d.dim}>this session + onchain Liquidated events</span></div>
          {proofs.map((p) => (
            <div key={p.hash} className={d.proof}>
              <div className={d.proofHead}><b>{p.label}</b><a href={txUrl(p.hash)} target="_blank" rel="noreferrer">{p.hash.slice(0, 10)}…{p.hash.slice(-6)} ↗</a></div>
              {p.before && p.after && (
                <div className={d.ba}>
                  <div><span>Borrower before</span>{p.before.coll.toFixed(6)} tBTC · {p.before.debt.toFixed(2)} tUSDC · HF {fmtHf(p.before.hf)}</div>
                  <div><span>Borrower after</span>{p.after.coll.toFixed(6)} tBTC · {p.after.debt.toFixed(2)} tUSDC · HF {fmtHf(p.after.hf)}</div>
                  <div><span>Liquidator Δ</span>+{(p.liqAfter!.tBTC - p.liqBefore!.tBTC).toFixed(8)} tBTC · {(p.liqAfter!.tUSDC - p.liqBefore!.tUSDC).toFixed(2)} tUSDC</div>
                </div>
              )}
            </div>
          ))}
          {liqs.map((l) => (
            <div key={l.hash} className={d.proof}>
              <div className={d.proofHead}><b>Liquidated · {l.borrower.slice(0, 8)}… · repaid {l.repaid.toFixed(2)} tUSDC · seized {l.seized.toFixed(8)} tBTC</b><a href={txUrl(l.hash)} target="_blank" rel="noreferrer">block {l.block.toString()} ↗</a></div>
            </div>
          ))}
          {!proofs.length && !liqs.length && <p className={d.note}>No oracle overrides or liquidations recorded yet.</p>}
        </section>
      </div>
    </>
  );
}
