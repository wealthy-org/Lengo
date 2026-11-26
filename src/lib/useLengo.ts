"use client";
import { useCallback, useState } from "react";
import { formatUnits, maxUint256, parseAbi, parseUnits, type Address } from "viem";
import { useAccount, useReadContracts, useWriteContract, usePublicClient, useSwitchChain } from "wagmi";
import { marketAbi, priceOracleAbi, tokenAbi } from "./abi";
import type { MarketSpec } from "./markets";
import { useNetwork } from "./useNetwork";
import { ensureWalletChain } from "./walletChain";
import { useToast } from "@/app/Toaster";

export type Act = "Deposit" | "Borrow" | "Repay" | "Withdraw" | "Supply" | "WithdrawSupply";
export type TxStep = { label: string; hash?: string; state: "wait" | "sign" | "pending" | "done" | "failed" };

const clAggAbi = parseAbi([
  "function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
]);

const n = (v: unknown, d: number) => (typeof v === "bigint" ? Number(formatUnits(v, d)) : 0);

/** Reads position, pool, direct Chainlink feed, and wallet balances for the selected MarketSpec. */
export function useLengo(spec?: MarketSpec) {
  const net = useNetwork();
  const { address, isConnected, chainId } = useAccount();

  const marketAddr = spec ? spec.market : net.market;
  const collAddr = spec ? spec.collateral : net.collateral!;
  const debtAddr = spec ? spec.debtAsset : net.debtAsset!;
  const oracleAddr = spec ? spec.oracle : net.oracle;
  const collDec = spec ? spec.collDecimals : net.collDecimals;
  const debtDec = spec ? spec.debtDecimals : net.debtDecimals;
  const clFeed = spec?.chainlinkFeed;
  const marketDeployed = !!(marketAddr && collAddr && debtAddr && oracleAddr);

  const onActiveChain = isConnected && chainId === net.chain.id;
  const acct = (address ?? "0x0000000000000000000000000000000000000000") as Address;

  // Wallet token balances ALWAYS read onchain even before a secondary LengoMarket contract is deployed!
  const balQuery = useReadContracts({
    allowFailure: true,
    query: { enabled: !!address },
    contracts: [
      { address: collAddr, abi: tokenAbi, functionName: "balanceOf", args: [acct], chainId: net.chain.id },
      { address: debtAddr, abi: tokenAbi, functionName: "balanceOf", args: [acct], chainId: net.chain.id },
    ],
  });

  // Direct Chainlink feed read on Mainnet so every market shows live onchain Chainlink price + age immediately!
  const feedQuery = useReadContracts({
    allowFailure: true,
    query: { enabled: !!clFeed && net.mode === "mainnet" },
    contracts: clFeed ? [{ address: clFeed, abi: clAggAbi, functionName: "latestRoundData", chainId: net.chain.id }] : [],
  });

  const m = { address: (marketAddr ?? "0x0000000000000000000000000000000000000000") as Address, abi: marketAbi, chainId: net.chain.id } as const;

  const q = useReadContracts({
    allowFailure: true,
    query: { enabled: marketDeployed && !!address },
    contracts: [
      { ...m, functionName: "getPosition", args: [acct] },
      { ...m, functionName: "getMarketState" },
      { ...m, functionName: "claimOf", args: [acct] },
      { ...m, functionName: "maxOracleAge" },
      { ...m, functionName: "paused" },
    ],
  });

  const pq = useReadContracts({
    allowFailure: true,
    query: { enabled: marketDeployed },
    contracts: [
      { ...m, functionName: "getMarketState" },
      { ...m, functionName: "maxOracleAge" },
      { address: (oracleAddr ?? "0x0000000000000000000000000000000000000000") as Address, abi: priceOracleAbi, functionName: "getPrice", args: [debtAddr], chainId: net.chain.id },
      { ...m, functionName: "paused" },
      { ...m, functionName: "totalCollateral" },
      { ...m, functionName: "collateralCap" },
      { ...m, functionName: "supplyCap" },
    ],
  });

  const collBal = n(balQuery.data?.[0]?.result, collDec);
  const debtBal = n(balQuery.data?.[1]?.result, debtDec);

  const clRound = feedQuery.data?.[0]?.result as readonly [bigint, bigint, bigint, bigint, bigint] | undefined;
  const clPrice = clRound && clRound[1] > 0n ? Number(formatUnits(clRound[1], 8)) : null;
  const clUpdatedAt = clRound ? Number(clRound[3]) : 0;

  const r = q.data;
  const pos = r?.[0]?.result as readonly bigint[] | undefined;
  const mkt = r?.[1]?.result as readonly bigint[] | undefined;
  const data = !!address ? {
    coll: marketDeployed && pos ? n(pos[0], collDec) : 0,
    debt: marketDeployed && pos ? n(pos[1], debtDec) : 0,
    hf: marketDeployed && pos ? (pos[2] === maxUint256 ? Infinity : n(pos[2], 18)) : Infinity,
    supplied: marketDeployed && mkt ? n(mkt[0], debtDec) : 0,
    borrowed: marketDeployed && mkt ? n(mkt[1], debtDec) : 0,
    available: marketDeployed && mkt ? n(mkt[2], debtDec) : 0,
    price: marketDeployed && mkt ? n(mkt[4], 8) : (clPrice ?? spec?.fallbackPrice ?? net.simPrice),
    priceAt: marketDeployed && mkt ? Number(mkt[5] ?? 0n) : clUpdatedAt,
    claim: marketDeployed ? n(r?.[2]?.result, debtDec) : 0,
    collBal,
    debtBal,
    tBTC: collBal,
    tUSDC: debtBal,
    maxAge: marketDeployed ? Number((r?.[3]?.result as bigint | undefined) ?? BigInt(spec?.maxOracleAge ?? 300)) : (spec?.maxOracleAge ?? 90000),
    paused: marketDeployed ? Boolean(r?.[4]?.result ?? false) : false,
  } : null;

  const pm = pq.data?.[0]?.result as readonly bigint[] | undefined;
  const du = pq.data?.[2]?.result as readonly bigint[] | undefined;
  const rawTotColl = pq.data?.[4]?.result as bigint | undefined;
  const rawCap = pq.data?.[5]?.result as bigint | undefined;
  const rawSupCap = pq.data?.[6]?.result as bigint | undefined;
  const totalColl = typeof rawTotColl === "bigint" ? n(rawTotColl, collDec) : 0;
  const colCap = typeof rawCap === "bigint" && rawCap !== maxUint256 ? n(rawCap, collDec) : Infinity;
  const supCap = typeof rawSupCap === "bigint" && rawSupCap !== maxUint256 ? n(rawSupCap, debtDec) : Infinity;

  const pool = marketDeployed && pm ? {
    supplied: n(pm[0], debtDec),
    borrowed: n(pm[1], debtDec),
    available: n(pm[2], debtDec),
    price: n(pm[4], 8),
    priceAt: Number(pm[5] ?? 0n),
    debtPriceAt: Number(du?.[1] ?? 0n),
    maxAge: Number((pq.data?.[1]?.result as bigint | undefined) ?? BigInt(spec?.maxOracleAge ?? 300)),
    paused: Boolean(pq.data?.[3]?.result ?? false),
    totalCollateral: totalColl,
    collateralCap: colCap,
    supplyCap: supCap,
  } : clPrice ? {
    supplied: 0,
    borrowed: 0,
    available: 0,
    price: clPrice,
    priceAt: clUpdatedAt,
    debtPriceAt: Math.floor(Date.now() / 1000),
    maxAge: spec?.maxOracleAge ?? 90000,
    paused: false,
    totalCollateral: 0,
    collateralCap: Infinity,
    supplyCap: Infinity,
  } : null;

  const refetch = () => {
    balQuery.refetch();
    feedQuery.refetch();
    pq.refetch();
    return q.refetch();
  };

  const poolLoading = pq.isLoading || (net.mode === "mainnet" && !!clFeed && feedQuery.isLoading && !pm);
  const userLoading = !!address && (q.isLoading || balQuery.isLoading);

  return {
    net,
    marketDeployed,
    marketAddr,
    live: marketDeployed && onActiveChain && !!address,
    isConnected,
    onActiveChain,
    address,
    data,
    pool,
    loading: userLoading,
    poolLoading,
    userLoading,
    error: q.error,
    refetch,
  };
}

/** Runs auto-chain-switch → approve (only if allowance is insufficient) → write → receipt for the selected MarketSpec. */
export function useLengoTx(onDone: () => void, spec?: MarketSpec) {
  const net = useNetwork();
  const { address, chainId, connector } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const client = usePublicClient({ chainId: net.chain.id });
  const toast = useToast();
  const [steps, setSteps] = useState<TxStep[] | null>(null);
  const [busy, setBusy] = useState(false);

  const marketAddr = spec ? spec.market : net.market;
  const collAddr = spec ? spec.collateral : net.collateral;
  const debtAddr = spec ? spec.debtAsset : net.debtAsset;
  const collDec = spec ? spec.collDecimals : net.collDecimals;
  const debtDec = spec ? spec.debtDecimals : net.debtDecimals;
  const collSym = spec ? spec.collSymbol : net.collSymbol;
  const debtSym = spec ? spec.debtSymbol : net.debtSymbol;

  const run = useCallback(async (act: Act, amount: string, opts: { all?: boolean; debt?: number } = {}) => {
    if (busy || !client || !marketAddr || !collAddr || !debtAddr) return;
    if (chainId !== net.chain.id) {
      const switched = await ensureWalletChain(net.chain, connector, switchChainAsync);
      if (!switched) {
        toast.push({ kind: "err", title: `Switch wallet to ${net.chain.name}` });
        return;
      }
    }

    const isColl = act === "Deposit" || act === "Withdraw";
    const dec = isColl ? collDec : debtDec;
    const sym = isColl ? collSym : debtSym;
    const token = isColl ? collAddr : debtAddr;
    const isApproveAct = act === "Deposit" || act === "Repay" || act === "Supply";
    let units = parseUnits(amount, dec);
    let approveUnits = units;
    if (act === "Repay" && opts.all) {
      approveUnits = parseUnits(((opts.debt ?? 0) * 1.001).toFixed(dec), dec);
      units = maxUint256;
    }

    setBusy(true);
    let needsApprove = isApproveAct;
    if (isApproveAct && address) {
      try {
        const curAllowance = (await client.readContract({
          address: token,
          abi: tokenAbi,
          functionName: "allowance",
          args: [address, marketAddr],
        })) as bigint;
        if (curAllowance >= approveUnits) {
          needsApprove = false;
        }
      } catch {
        needsApprove = true;
      }
    }

    const list: TxStep[] = [
      ...(needsApprove ? [{ label: `Approve ${formatUnits(approveUnits, dec)} ${sym} to ${collSym}/${debtSym} Market`, state: "wait" as const }] : []),
      { label: "Confirm in wallet", state: "wait" },
      { label: "Pending onchain", state: "wait" },
      { label: "Confirmed", state: "wait" },
    ];
    setSteps(list);
    const upd = (i: number, p: Partial<TxStep>) => setSteps((s) => s && s.map((x, k) => (k === i ? { ...x, ...p } : x)));
    let i = 0;
    try {
      if (needsApprove) {
        upd(0, { state: "sign" });
        const h = await writeContractAsync({ address: token, abi: tokenAbi, functionName: "approve", args: [marketAddr, approveUnits], chainId: net.chain.id });
        upd(0, { state: "pending", hash: h });
        const rc = await client.waitForTransactionReceipt({ hash: h, timeout: 120_000 });
        if (rc.status !== "success") throw new Error("Approval reverted");
        upd(0, { state: "done" }); i = 1;
        toast.push({ kind: "ok", title: "Approval confirmed", detail: list[0].label, hash: h });
      }
      const fn = { Deposit: "depositCollateral", Withdraw: "withdrawCollateral", Borrow: "borrow", Repay: "repay", Supply: "supply", WithdrawSupply: "withdrawSupply" }[act] as
        "depositCollateral" | "withdrawCollateral" | "borrow" | "repay" | "supply" | "withdrawSupply";
      upd(i, { state: "sign" });
      const h = await writeContractAsync({ address: marketAddr, abi: marketAbi, functionName: fn, args: [units], chainId: net.chain.id });
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
  }, [busy, client, address, marketAddr, collAddr, debtAddr, collDec, debtDec, collSym, debtSym, net, chainId, connector, switchChainAsync, writeContractAsync, onDone, toast]);

  return { steps, busy, run, close: () => setSteps(null) };
}
