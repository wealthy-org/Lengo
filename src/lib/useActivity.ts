"use client";
import { useQuery } from "@tanstack/react-query";
import { formatUnits } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { marketAbi } from "./abi";
import { deployment, isDeployed, rhTestnet } from "./chain";

export type ActivityRow = { type: string; amt: string; tx: string; block: bigint; logIndex: number; group: string };

const EVENTS: { name: string; type: string; group: string; arg: string; fmt: (a: Record<string, bigint>) => string }[] = [
  { name: "CollateralDeposited", type: "Deposit", group: "Lending", arg: "account", fmt: (a) => `${formatUnits(a.assets, 8)} tBTC` },
  { name: "CollateralWithdrawn", type: "Withdraw", group: "Lending", arg: "account", fmt: (a) => `${formatUnits(a.assets, 8)} tBTC` },
  { name: "Borrowed", type: "Borrow", group: "Lending", arg: "account", fmt: (a) => `${formatUnits(a.assets, 6)} tUSDC` },
  { name: "Repaid", type: "Repay", group: "Lending", arg: "account", fmt: (a) => `${formatUnits(a.assets, 6)} tUSDC` },
  { name: "Supplied", type: "Supply", group: "Lending", arg: "account", fmt: (a) => `${formatUnits(a.assets, 6)} tUSDC` },
  { name: "SupplyWithdrawn", type: "Withdraw supply", group: "Lending", arg: "account", fmt: (a) => `${formatUnits(a.assets, 6)} tUSDC` },
  { name: "Liquidated", type: "Liquidated", group: "Lending", arg: "borrower", fmt: (a) => `${formatUnits(a.repaid, 6)} tUSDC repaid · ${formatUnits(a.seized, 8)} tBTC seized` },
];

/** Account history rebuilt from market events. Identity = txHash + logIndex + chainId. */
export function useActivity() {
  const { address, isConnected, chainId } = useAccount();
  const client = usePublicClient({ chainId: rhTestnet.id });
  const live = isDeployed && isConnected && chainId === rhTestnet.id && !!address && !!client;
  const q = useQuery({
    queryKey: ["activity", address],
    enabled: live,
    queryFn: async () => {
      // 1) DB read model (Neon) when configured; 2) otherwise straight from RPC logs.
      try {
        const res = await fetch(`/api/activity?account=${address}`);
        if (res.status === 200) {
          const j = await res.json() as { rows: { tx_hash: string; log_index: number; block_number: string; event: string; amount_a: string | null; amount_b: string | null }[] };
          const fmt = (e: string, a: string | null, b: string | null) => {
            const A = BigInt(a ?? "0"), B = BigInt(b ?? "0");
            if (e === "Deposit" || e === "Withdraw") return `${formatUnits(A, 8)} tBTC`;
            if (e === "Liquidated") return `${formatUnits(A, 6)} tUSDC repaid · ${formatUnits(B, 8)} tBTC seized`;
            return `${formatUnits(A, 6)} tUSDC`;
          };
          return j.rows.map((r) => ({ type: r.event, group: "Lending", amt: fmt(r.event, r.amount_a, r.amount_b), tx: r.tx_hash, block: BigInt(r.block_number), logIndex: r.log_index }));
        }
      } catch { /* fall through to RPC */ }
      const all = await Promise.all(EVENTS.map(async (e) => {
        const logs = await client!.getContractEvents({
          address: deployment.market!, abi: marketAbi,
          eventName: e.name as "Borrowed",
          args: { [e.arg]: address } as never,
          fromBlock: deployment.startBlock, toBlock: "latest",
        });
        return logs.map((l) => ({ type: e.type, group: e.group, amt: e.fmt(l.args as unknown as Record<string, bigint>), tx: l.transactionHash, block: l.blockNumber, logIndex: l.logIndex }));
      }));
      const seen = new Set<string>();
      return all.flat().filter((r) => { const k = `${r.tx}:${r.logIndex}:${rhTestnet.id}`; if (seen.has(k)) return false; seen.add(k); return true; })
        .sort((a, b) => (a.block === b.block ? b.logIndex - a.logIndex : Number(b.block - a.block)));
    },
  });
  return { live, rows: q.data as ActivityRow[] | undefined, loading: q.isLoading, error: q.error };
}
