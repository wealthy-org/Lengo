"use client";
import { useCallback, useState } from "react";
import { formatUnits, maxUint256, parseUnits, type Address } from "viem";
import { useAccount, useReadContracts, useWriteContract, usePublicClient, useSwitchChain } from "wagmi";
import { marketAbi, priceOracleAbi, tokenAbi } from "./abi";
import { useNetwork } from "./chain";
import { ensureWalletChain } from "./walletChain";
import { useToast } from "@/app/Toaster";

export type Act = "Deposit" | "Borrow" | "Repay" | "Withdraw" | "Supply" | "WithdrawSupply";
export type TxStep = { label: string; hash?: string; state: "wait" | "sign" | "pending" | "done" | "failed" };

const n = (v: unknown, d: number) => (typeof v === "bigint" ? Number(formatUnits(v, d)) : 0);

/** Reads position, market, and wallet state from the active Robinhood Chain network (Testnet 46630 default, or Mainnet 4663). */
export function useLengo() {
  const net = useNetwork();
  const { address, isConnected, chainId } = useAccount();
  const onActiveChain = isConnected && chainId === net.chain.id;
  const live = net.isDeployed && onActiveChain && !!address;
  const m = { address: net.market!, abi: marketAbi, chainId: net.chain.id } as const;
  const acct = (address ?? "0x0000000000000000000000000000000000000000") as Address;

  const q = useReadContracts({
    allowFailure: true,
    query: { enabled: net.isDeployed && !!address },
    contracts: [
      { ...m, functionName: "getPosition", args: [acct] },
      { ...m, functionName: "getMarketState" },
      { ...m, functionName: "claimOf", args: [acct] },
      { address: net.collateral!, abi: tokenAbi, functionName: "balanceOf", args: [acct], chainId: net.chain.id },
      { address: net.debtAsset!, abi: tokenAbi, functionName: "balanceOf", args: [acct], chainId: net.chain.id },
      { ...m, functionName: "maxOracleAge" },
      { ...m, functionName: "paused" },
    ],
  });

  const r = q.data;
  const pos = r?.[0]?.result as readonly bigint[] | undefined;
  const mkt = r?.[1]?.result as readonly bigint[] | undefined;
  const data = net.isDeployed && !!address && pos && mkt ? {
    coll: n(pos[0], net.collDecimals),
    debt: n(pos[1], net.debtDecimals),
    hf: pos[2] === maxUint256 ? Infinity : n(pos[2], 18),
    supplied: n(mkt[0], net.debtDecimals),
    borrowed: n(mkt[1], net.debtDecimals),
    available: n(mkt[2], net.debtDecimals),
    price: n(mkt[4], 8),
    priceAt: Number(mkt[5] ?? 0n),
    claim: n(r?.[2]?.result, net.debtDecimals),
    collBal: n(r?.[3]?.result, net.collDecimals),
    debtBal: n(r?.[4]?.result, net.debtDecimals),
    // Backwards-compatible aliases
    tBTC: n(r?.[3]?.result, net.collDecimals),
    tUSDC: n(r?.[4]?.result, net.debtDecimals),
    maxAge: Number((r?.[5]?.result as bigint | undefined) ?? 300n),
    paused: Boolean(r?.[6]?.result ?? false),
  } : null;

  // Pool state is public: read it even without a wallet so /app never shows demo numbers once deployed.
  const pq = useReadContracts({
    allowFailure: true,
    query: { enabled: net.isDeployed },
    contracts: [
      { ...m, functionName: "getMarketState" },
      { ...m, functionName: "maxOracleAge" },
      { address: net.oracle!, abi: priceOracleAbi, functionName: "getPrice", args: [net.debtAsset!], chainId: net.chain.id },
      { ...m, functionName: "paused" },
    ],
  });
  const pm = pq.data?.[0]?.result as readonly bigint[] | undefined;
  const du = pq.data?.[2]?.result as readonly bigint[] | undefined;
  const pool = pm ? {
    supplied: n(pm[0], net.debtDecimals),
    borrowed: n(pm[1], net.debtDecimals),
    available: n(pm[2], net.debtDecimals),
    price: n(pm[4], 8),
    priceAt: Number(pm[5] ?? 0n),
    debtPriceAt: Number(du?.[1] ?? 0n),
    maxAge: Number((pq.data?.[1]?.result as bigint | undefined) ?? 300n),
    paused: Boolean(pq.data?.[3]?.result ?? false),
  } : null;

  const refetch = () => { pq.refetch(); return q.refetch(); };
  return { net, live, isConnected, onActiveChain, address, data, pool, loading: live && q.isLoading, error: q.error, refetch };
}

/** Runs auto-chain-switch → approve → write → receipt for one action and reports each step for the modal. */
export function useLengoTx(onDone: () => void) {
  const net = useNetwork();
  const { chainId, connector } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const client = usePublicClient({ chainId: net.chain.id });
  const toast = useToast();
  const [steps, setSteps] = useState<TxStep[] | null>(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async (act: Act, amount: string, opts: { all?: boolean; debt?: number } = {}) => {
    if (busy || !client || !net.isDeployed) return;
    if (chainId !== net.chain.id) {
      const switched = await ensureWalletChain(net.chain, connector, switchChainAsync);
      if (!switched) {
        toast.push({ kind: "err", title: `Switch wallet to ${net.chain.name}` });
        return;
      }
    }

    const isColl = act === "Deposit" || act === "Withdraw";
    const dec = isColl ? net.collDecimals : net.debtDecimals;
    const sym = isColl ? net.collSymbol : net.debtSymbol;
    const token = isColl ? net.collateral! : net.debtAsset!;
    const needsApprove = act === "Deposit" || act === "Repay" || act === "Supply";
    let units = parseUnits(amount, dec);
    let approveUnits = units;
    if (act === "Repay" && opts.all) {
      approveUnits = parseUnits(((opts.debt ?? 0) * 1.001).toFixed(dec), dec);
      units = maxUint256;
    }
    const list: TxStep[] = [
      ...(needsApprove ? [{ label: `Approve ${formatUnits(approveUnits, dec)} ${sym} to LengoMarket`, state: "wait" as const }] : []),
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
        const h = await writeContractAsync({ address: token, abi: tokenAbi, functionName: "approve", args: [net.market!, approveUnits], chainId: net.chain.id });
        upd(0, { state: "pending", hash: h });
        const rc = await client.waitForTransactionReceipt({ hash: h, timeout: 120_000 });
        if (rc.status !== "success") throw new Error("Approval reverted");
        upd(0, { state: "done" }); i = 1;
        toast.push({ kind: "ok", title: "Approval confirmed", detail: list[0].label, hash: h });
      }
      const fn = { Deposit: "depositCollateral", Withdraw: "withdrawCollateral", Borrow: "borrow", Repay: "repay", Supply: "supply", WithdrawSupply: "withdrawSupply" }[act] as
        "depositCollateral" | "withdrawCollateral" | "borrow" | "repay" | "supply" | "withdrawSupply";
      upd(i, { state: "sign" });
      const h = await writeContractAsync({ address: net.market!, abi: marketAbi, functionName: fn, args: [units], chainId: net.chain.id });
      upd(i, { state: "done", hash: h }); upd(i + 1, { state: "pending", hash: h });
      const rc = await client.waitForTransactionReceipt({ hash: h, timeout: 120_000 });
      if (rc.status !== "success") { upd(i + 1, { state: "failed" }); throw new Error("Transaction reverted"); }
      upd(i + 1, { state: "done" }); upd(i + 2, { state: "done", hash: h });
      toast.push({ kind: "ok", title: `${act === "WithdrawSupply" ? "Withdraw supply" : act} confirmed`, detail: `${opts.all ? "All" : amount} ${sym} · ${net.chain.name}`, hash: h });
      onDone();
    } catch (e) {
      const msg = (e as Error).message || "";
      const timeout = /timed out|timeout/i.test(msg);
      toast.push(timeout
        ? { kind: "info", title: "Status unknown", detail: "Still pending after 2 minutes. Check the explorer before retrying." }
        : { kind: "err", title: /rejected|denied/i.test(msg) ? "Rejected in wallet" : `${act} failed`, detail: /rejected|denied/i.test(msg) ? undefined : msg.split("\n")[0].slice(0, 140) });
      setSteps((s) => s && s.map((x) => (x.state === "sign" || x.state === "pending" ? { ...x, state: timeout ? "pending" : "failed", label: timeout ? x.label + " · unknown, check explorer" : /rejected|denied/i.test(msg) ? "Rejected in wallet" : x.label } : x)));
    } finally { setBusy(false); }
  }, [busy, client, net, chainId, connector, switchChainAsync, writeContractAsync, onDone, toast]);

  return { steps, busy, run, close: () => setSteps(null) };
}
