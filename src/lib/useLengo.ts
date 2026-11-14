"use client";
import { useCallback, useState } from "react";
import { formatUnits, maxUint256, parseUnits, type Address } from "viem";
import { useAccount, useReadContracts, useWriteContract, usePublicClient } from "wagmi";
import { marketAbi, oracleAbi, tokenAbi } from "./abi";
import { deployment, isDeployed, rhTestnet } from "./chain";
import { useToast } from "@/app/Toaster";

export type Act = "Deposit" | "Borrow" | "Repay" | "Withdraw" | "Supply" | "WithdrawSupply";
export type TxStep = { label: string; hash?: string; state: "wait" | "sign" | "pending" | "done" | "failed" };

const n = (v: unknown, d: number) => (typeof v === "bigint" ? Number(formatUnits(v, d)) : 0);

/** Reads the position, market and wallet state straight from the RH testnet contracts. */
export function useLengo() {
  const { address, isConnected, chainId } = useAccount();
  const live = isDeployed && isConnected && chainId === rhTestnet.id && !!address;
  const m = { address: deployment.market!, abi: marketAbi } as const;
  const acct = (address ?? "0x0000000000000000000000000000000000000000") as Address;

  const q = useReadContracts({
    allowFailure: true,
    query: { enabled: live },
    contracts: [
      { ...m, functionName: "getPosition", args: [acct] },
      { ...m, functionName: "getMarketState" },
      { ...m, functionName: "claimOf", args: [acct] },
      { address: deployment.tBTC!, abi: tokenAbi, functionName: "balanceOf", args: [acct] },
      { address: deployment.tUSDC!, abi: tokenAbi, functionName: "balanceOf", args: [acct] },
      { ...m, functionName: "maxOracleAge" },
    ],
  });

  const r = q.data;
  const pos = r?.[0]?.result as readonly bigint[] | undefined;
  const mkt = r?.[1]?.result as readonly bigint[] | undefined;
  const data = live && pos && mkt ? {
    coll: n(pos[0], 8), debt: n(pos[1], 6),
    hf: pos[2] === maxUint256 ? Infinity : n(pos[2], 18),
    supplied: n(mkt[0], 6), borrowed: n(mkt[1], 6), available: n(mkt[2], 6),
    price: n(mkt[4], 8), priceAt: Number(mkt[5] ?? 0n),
    claim: n(r?.[2]?.result, 6),
    tBTC: n(r?.[3]?.result, 8), tUSDC: n(r?.[4]?.result, 6),
    maxAge: Number((r?.[5]?.result as bigint | undefined) ?? 300n),
  } : null;

  // Pool state is public: read it even without a wallet so /app never shows demo numbers once deployed.
  const pq = useReadContracts({
    allowFailure: true,
    query: { enabled: isDeployed },
    contracts: [
      { ...m, functionName: "getMarketState", chainId: rhTestnet.id },
      { ...m, functionName: "maxOracleAge", chainId: rhTestnet.id },
      { address: deployment.oracle!, abi: oracleAbi, functionName: "getPrice", args: [deployment.tUSDC!], chainId: rhTestnet.id },
    ],
  });
  const pm = pq.data?.[0]?.result as readonly bigint[] | undefined;
  const du = pq.data?.[2]?.result as readonly bigint[] | undefined;
  const pool = pm ? {
    supplied: n(pm[0], 6), borrowed: n(pm[1], 6), available: n(pm[2], 6),
    price: n(pm[4], 8), priceAt: Number(pm[5] ?? 0n),
    debtPriceAt: Number(du?.[1] ?? 0n),
    maxAge: Number((pq.data?.[1]?.result as bigint | undefined) ?? 300n),
  } : null;

  const refetch = () => { pq.refetch(); return q.refetch(); };
  return { live, address, data, pool, loading: live && q.isLoading, error: q.error, refetch };
}

/** Runs approve → write → receipt for one action and reports each step for the modal. */
export function useLengoTx(onDone: () => void) {
  const { writeContractAsync } = useWriteContract();
  const client = usePublicClient({ chainId: rhTestnet.id });
  const toast = useToast();
  const [steps, setSteps] = useState<TxStep[] | null>(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async (act: Act, amount: string, opts: { all?: boolean; debt?: number } = {}) => {
    if (busy || !client) return;
    const isColl = act === "Deposit" || act === "Withdraw";
    const dec = isColl ? 8 : 6;
    const token = isColl ? deployment.tBTC! : deployment.tUSDC!;
    const needsApprove = act === "Deposit" || act === "Repay" || act === "Supply";
    let units = parseUnits(amount, dec);
    let approveUnits = units;
    if (act === "Repay" && opts.all) {
      // interest keeps accruing between blocks; approve a 0.1% buffer and let the contract cap at actual debt
      approveUnits = parseUnits(((opts.debt ?? 0) * 1.001).toFixed(6), 6);
      units = maxUint256;
    }
    const list: TxStep[] = [
      ...(needsApprove ? [{ label: `Approve ${formatUnits(approveUnits, dec)} ${isColl ? "tBTC" : "tUSDC"} to LengoMarket`, state: "wait" as const }] : []),
      { label: "Confirm in wallet", state: "wait" },
      { label: "Pending onchain", state: "wait" },
      { label: "Confirmed", state: "wait" },
    ];
    setSteps(list); setBusy(true);
    const upd = (i: number, p: Partial<TxStep>) => setSteps((s) => s && s.map((x, k) => (k === i ? { ...x, ...p } : x)));
    let i = 0;
    try {
      if (needsApprove) {
        upd(0, { state: "sign" });
        const h = await writeContractAsync({ address: token, abi: tokenAbi, functionName: "approve", args: [deployment.market!, approveUnits], chainId: rhTestnet.id });
        upd(0, { state: "pending", hash: h });
        const rc = await client.waitForTransactionReceipt({ hash: h, timeout: 120_000 });
        if (rc.status !== "success") throw new Error("Approval reverted");
        upd(0, { state: "done" }); i = 1;
        toast.push({ kind: "ok", title: "Approval confirmed", detail: list[0].label, hash: h });
      }
      const fn = { Deposit: "depositCollateral", Withdraw: "withdrawCollateral", Borrow: "borrow", Repay: "repay", Supply: "supply", WithdrawSupply: "withdrawSupply" }[act] as
        "depositCollateral" | "withdrawCollateral" | "borrow" | "repay" | "supply" | "withdrawSupply";
      upd(i, { state: "sign" });
      const h = await writeContractAsync({ address: deployment.market!, abi: marketAbi, functionName: fn, args: [units], chainId: rhTestnet.id });
      upd(i, { state: "done", hash: h }); upd(i + 1, { state: "pending", hash: h });
      const rc = await client.waitForTransactionReceipt({ hash: h, timeout: 120_000 });
      if (rc.status !== "success") { upd(i + 1, { state: "failed" }); throw new Error("Transaction reverted"); }
      upd(i + 1, { state: "done" }); upd(i + 2, { state: "done", hash: h });
      toast.push({ kind: "ok", title: `${act === "WithdrawSupply" ? "Withdraw supply" : act} confirmed`, detail: `${opts.all ? "All" : amount} ${isColl ? "tBTC" : "tUSDC"} · Robinhood Chain Testnet`, hash: h });
      onDone();
    } catch (e) {
      const msg = (e as Error).message || "";
      // timeouts stay pending/unknown with their hash; never auto-retry a write that may have been sent
      const timeout = /timed out|timeout/i.test(msg);
      toast.push(timeout
        ? { kind: "info", title: "Status unknown", detail: "Still pending after 2 minutes. Check the explorer before retrying." }
        : { kind: "err", title: /rejected|denied/i.test(msg) ? "Rejected in wallet" : `${act} failed`, detail: /rejected|denied/i.test(msg) ? undefined : msg.split("\n")[0].slice(0, 140) });
      setSteps((s) => s && s.map((x) => (x.state === "sign" || x.state === "pending" ? { ...x, state: timeout ? "pending" : "failed", label: timeout ? x.label + " · unknown, check explorer" : /rejected|denied/i.test(msg) ? "Rejected in wallet" : x.label } : x)));
    } finally { setBusy(false); }
  }, [busy, client, writeContractAsync, onDone, toast]);

  return { steps, busy, run, close: () => setSteps(null) };
}
