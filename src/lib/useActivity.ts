"use client";
import { useQuery } from "@tanstack/react-query";
import { formatUnits } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { marketAbi } from "./abi";
import { useNetwork } from "./chain";

export type ActivityRow = { type: string; amt: string; tx: string; block: bigint; logIndex: number; group: string };

/** Account history rebuilt from market events. Identity = txHash + logIndex + chainId. */
export function useActivity() {
  const net = useNetwork();
  const { address, isConnected } = useAccount();
  const client = usePublicClient({ chainId: net.chain.id });
  const mine = net.isDeployed && isConnected && !!address && !!client;
  const live = net.isDeployed && !!client;

  const events: { name: string; type: string; group: string; arg: string; fmt: (a: Record<string, bigint>) => string }[] = [
    { name: "CollateralDeposited", type: "Deposit", group: "Lending", arg: "account", fmt: (a) => `${formatUnits(a.assets, net.collDecimals)} ${net.collSymbol}` },
    { name: "CollateralWithdrawn", type: "Withdraw", group: "Lending", arg: "account", fmt: (a) => `${formatUnits(a.assets, net.collDecimals)} ${net.collSymbol}` },
    { name: "Borrowed", type: "Borrow", group: "Lending", arg: "account", fmt: (a) => `${formatUnits(a.assets, net.debtDecimals)} ${net.debtSymbol}` },
    { name: "Repaid", type: "Repay", group: "Lending", arg: "account", fmt: (a) => `${formatUnits(a.assets, net.debtDecimals)} ${net.debtSymbol}` },
    { name: "Supplied", type: "Supply", group: "Lending", arg: "account", fmt: (a) => `${formatUnits(a.assets, net.debtDecimals)} ${net.debtSymbol}` },
    { name: "SupplyWithdrawn", type: "Withdraw supply", group: "Lending", arg: "account", fmt: (a) => `${formatUnits(a.assets, net.debtDecimals)} ${net.debtSymbol}` },
    { name: "Liquidated", type: "Liquidated", group: "Lending", arg: "borrower", fmt: (a) => `${formatUnits(a.repaid, net.debtDecimals)} ${net.debtSymbol} repaid · ${formatUnits(a.seized, net.collDecimals)} ${net.collSymbol} seized` },
  ];

  const q = useQuery({
    queryKey: ["activity", net.chain.id, mine ? address : "market"],
    enabled: live,
    queryFn: async () => {
      try {
        const res = await fetch(mine ? `/api/activity?chainId=${net.chain.id}&account=${address}` : `/api/activity?chainId=${net.chain.id}`);
        if (res.status === 200) {
          const j = (await res.json()) as { rows: { tx_hash: string; log_index: number; block_number: string; event: string; amount_a: string | null; amount_b: string | null }[] };
          const fmt = (e: string, a: string | null, b: string | null) => {
            const A = BigInt(a ?? "0"), B = BigInt(b ?? "0");
            if (e === "Deposit" || e === "Withdraw") return `${formatUnits(A, net.collDecimals)} ${net.collSymbol}`;
            if (e === "Liquidated") return `${formatUnits(A, net.debtDecimals)} ${net.debtSymbol} repaid · ${formatUnits(B, net.collDecimals)} ${net.collSymbol} seized`;
            return `${formatUnits(A, net.debtDecimals)} ${net.debtSymbol}`;
          };
          return j.rows.map((r) => ({ type: r.event, group: "Lending", amt: fmt(r.event, r.amount_a, r.amount_b), tx: r.tx_hash, block: BigInt(r.block_number), logIndex: r.log_index }));
        }
      } catch { /* fall through to RPC */ }
      const all = await Promise.all(events.map(async (e) => {
        const logs = await client!.getContractEvents({
          address: net.market!, abi: marketAbi,
          eventName: e.name as "Borrowed",
          args: (mine ? { [e.arg]: address } : undefined) as never,
          fromBlock: net.startBlock, toBlock: "latest",
        });
        return logs.map((l) => ({ type: e.type, group: e.group, amt: e.fmt(l.args as unknown as Record<string, bigint>), tx: l.transactionHash, block: l.blockNumber, logIndex: l.logIndex }));
      }));
      const seen = new Set<string>();
      return all.flat().filter((r) => { const k = `${r.tx}:${r.logIndex}:${net.chain.id}`; if (seen.has(k)) return false; seen.add(k); return true; })
        .sort((a, b) => (a.block === b.block ? b.logIndex - a.logIndex : Number(b.block - a.block)));
    },
  });
  return { net, live, mine, rows: q.data as ActivityRow[] | undefined, loading: q.isLoading, error: q.error };
}
