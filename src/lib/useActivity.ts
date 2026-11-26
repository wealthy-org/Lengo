"use client";
import { useQuery } from "@tanstack/react-query";
import { formatUnits } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { marketAbi } from "./abi";
import { MAINNET_MARKETS } from "./markets";
import { useNetwork } from "./useNetwork";

export type ActivityRow = {
  type: string;
  amt: string;
  tx: string;
  txHref?: string;
  txLabel?: string;
  block: bigint | null;
  logIndex: number;
  group: string;
  status: "Confirmed" | "Preview" | "Live Intent";
  timeLabel?: string;
};

function assetMeta(assetId: string): { label: string; sym: string; decimals: number } {
  if (assetId.includes("5fc5360d")) return { label: "USDG · RH", sym: "USDG", decimals: 6 };
  if (assetId.includes("0bd7d308")) return { label: "WETH · RH", sym: "WETH", decimals: 18 };
  if (assetId.includes("hood.omft")) return { label: "ETH · RH", sym: "ETH", decimals: 18 };
  if (assetId.includes("sol.omft")) return { label: "SOL · Solana", sym: "SOL", decimals: 9 };
  if (assetId.startsWith("nep141:sol-")) return { label: "USDC · Solana", sym: "USDC", decimals: 6 };
  if (assetId.startsWith("nep141:base-")) return { label: "USDC · Base", sym: "USDC", decimals: 6 };
  if (assetId.startsWith("nep141:arb-")) return { label: "USDC · Arbitrum", sym: "USDC", decimals: 6 };
  if (assetId.startsWith("nep141:eth-")) return { label: "USDC · Ethereum", sym: "USDC", decimals: 6 };
  if (assetId.includes("btc.omft")) return { label: "BTC · Bitcoin", sym: "BTC", decimals: 8 };
  if (assetId.includes("zec.omft")) return { label: "ZEC · Zcash", sym: "ZEC", decimals: 8 };
  return { label: assetId.slice(0, 14), sym: "", decimals: 6 };
}

function fmtRouteUnits(raw: string | null | undefined, assetId: string): string {
  const m = assetMeta(assetId);
  if (!raw) return m.label;
  try {
    const num = Number(formatUnits(BigInt(raw), m.decimals));
    const txt = num.toLocaleString("en-US", { maximumFractionDigits: num < 10 ? 4 : 2 });
    return `${txt} ${m.label}`;
  } catch {
    return m.label;
  }
}

/** Account & market history rebuilt from indexed contract events + 1Click route quotes. */
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
    queryFn: async (): Promise<{ rows: ActivityRow[]; indexedTo: string | null; scope: string }> => {
      try {
        const res = await fetch(mine ? `/api/activity?chainId=${net.chain.id}&account=${address}` : `/api/activity?chainId=${net.chain.id}`);
        if (res.status === 200) {
          const j = (await res.json()) as {
            rows: { tx_hash: string; log_index: number; block_number: string; event: string; amount_a: string | null; amount_b: string | null; market?: string | null }[];
            quotes?: {
              id: string;
              origin_asset: string;
              dest_asset: string;
              amount_in?: string | null;
              amount_out?: string | null;
              status: string;
              deposit_address?: string | null;
              tx_hash?: string | null;
              dest_tx_hash?: string | null;
              created_at: string;
            }[];
            indexedTo?: string | null;
            scope?: string;
          };
          const fmt = (e: string, a: string | null, b: string | null, mktAddr?: string | null) => {
            const spec = mktAddr ? MAINNET_MARKETS.find((m) => m.market?.toLowerCase() === mktAddr.toLowerCase()) : undefined;
            const cDec = spec?.collDecimals ?? net.collDecimals;
            const cSym = spec?.collSymbol ?? net.collSymbol;
            const dDec = spec?.debtDecimals ?? net.debtDecimals;
            const dSym = spec?.debtSymbol ?? net.debtSymbol;
            const A = BigInt(a ?? "0"), B = BigInt(b ?? "0");
            if (e === "Deposit" || e === "Withdraw") return `${formatUnits(A, cDec)} ${cSym}`;
            if (e === "Liquidated") return `${formatUnits(A, dDec)} ${dSym} repaid · ${formatUnits(B, cDec)} ${cSym} seized`;
            return `${formatUnits(A, dDec)} ${dSym}`;
          };
          const onchainRows: ActivityRow[] = j.rows.map((r) => ({
            type: r.event,
            group: "Lending",
            amt: fmt(r.event, r.amount_a, r.amount_b, r.market),
            tx: r.tx_hash,
            block: BigInt(r.block_number),
            logIndex: r.log_index,
            status: "Confirmed",
          }));
          const quoteRows: ActivityRow[] = (j.quotes ?? []).map((qr, idx) => {
            const settled = qr.status === "settled";
            const isExec = settled || qr.status === "submitted" || qr.status === "live_quote";
            const txHash = qr.tx_hash || "";
            const txHref = txHash
              ? `https://robinhoodchain.blockscout.com/tx/${txHash}`
              : qr.deposit_address
                ? `https://explorer.near-intents.org/transactions/${qr.deposit_address}`
                : undefined;
            const txLabel = txHash
              ? `${txHash.slice(0, 6)}…${txHash.slice(-4)} ↗`
              : qr.deposit_address
                ? `Intents ↗`
                : undefined;
            return {
              type: isExec ? "Execute" : "Quote",
              group: "Routes",
              amt: `${fmtRouteUnits(qr.amount_in, qr.origin_asset)} → ${fmtRouteUnits(qr.amount_out, qr.dest_asset)}`,
              tx: txHash,
              txHref,
              txLabel,
              block: null,
              logIndex: idx,
              status: settled ? "Confirmed" : isExec ? "Live Intent" : "Preview",
              timeLabel: qr.created_at ? new Date(qr.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "1Click",
            };
          });
          return { rows: [...onchainRows, ...quoteRows], indexedTo: j.indexedTo ?? null, scope: j.scope ?? "market" };
        }
      } catch {
        /* fall through to RPC */
      }

      // RPC fallback: stay strictly within 999 blocks so public Orbit RPCs never reject eth_getLogs
      const head = await client!.getBlockNumber();
      const from = head - 999n > net.startBlock ? head - 999n : net.startBlock;
      const all = await Promise.all(
        events.map(async (e) => {
          const logs = await client!.getContractEvents({
            address: net.market!,
            abi: marketAbi,
            eventName: e.name as "Borrowed",
            args: (mine ? { [e.arg]: address } : undefined) as never,
            fromBlock: from,
            toBlock: head,
          });
          return logs.map((l) => ({
            type: e.type,
            group: e.group,
            amt: e.fmt(l.args as unknown as Record<string, bigint>),
            tx: l.transactionHash,
            block: l.blockNumber,
            logIndex: l.logIndex,
            status: "Confirmed" as const,
          }));
        })
      );
      const seen = new Set<string>();
      const rows = all
        .flat()
        .filter((r) => {
          const k = `${r.tx}:${r.logIndex}:${net.chain.id}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        })
        .sort((a, b) => (a.block === b.block ? b.logIndex - a.logIndex : Number((b.block ?? 0n) - (a.block ?? 0n))));
      return { rows, indexedTo: head.toString(), scope: mine ? "account" : "market" };
    },
  });

  return {
    net,
    live,
    mine,
    rows: q.data?.rows,
    indexedTo: q.data?.indexedTo ?? null,
    scope: q.data?.scope ?? "market",
    loading: q.isLoading,
    error: q.error,
  };
}
