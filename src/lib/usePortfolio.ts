"use client";
import { formatUnits, maxUint256, parseAbi, type Address } from "viem";
import { useAccount, useReadContracts } from "wagmi";
import { marketAbi, tokenAbi } from "./abi";
import { MAINNET_MARKETS, TESTNET_MARKET, type MarketSpec } from "./markets";
import { useNetwork } from "./useNetwork";

const clAggAbi = parseAbi([
  "function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
]);

const num = (v: unknown, dec: number) => (typeof v === "bigint" ? Number(formatUnits(v, dec)) : 0);

export type MarketHealthRow = {
  spec: MarketSpec;
  price: number;
  priceAt: number;
  stale: boolean;
  paused: boolean;
  poolSupplied: number;
  poolBorrowed: number;
  poolAvailable: number;
  totalCollateral: number;
  collateralCap: number;
  supplyCap: number;
  isPoolLive: boolean;
  // User position (0 when disconnected or no position)
  coll: number;
  collUsd: number;
  debt: number;
  hf: number;
  ltv: number;
  liqPrice: number;
  borrowRoomUsd: number;
  ltBufferUsd: number;
  dropToLiqPct: number;
  lenderClaim: number;
  walletColl: number;
  status: "NO_POSITION" | "SAFE" | "NEAR_LT" | "CRITICAL" | "LIQUIDATABLE";
};

/** Reads all markets' onchain positions, pool states, and Chainlink feeds in one Multicall3 batch. */
export function usePortfolio() {
  const net = useNetwork();
  const { address, isConnected } = useAccount();
  const isMainnet = net.mode === "mainnet";
  const markets: MarketSpec[] = isMainnet ? MAINNET_MARKETS : [TESTNET_MARKET];
  const zero = "0x0000000000000000000000000000000000000000" as Address;
  const acct = (address ?? zero) as Address;
  const debtToken = markets[0].debtAsset;

  // Per market: 5 public reads -> getMarketState, paused, totalCollateral, collateralCap, supplyCap (+ optional Chainlink feed)
  const poolReads = useReadContracts({
    allowFailure: true,
    contracts: markets.flatMap((m) => {
      const addr = (m.market ?? zero) as Address;
      const feed = (m.chainlinkFeed ?? zero) as Address;
      return [
        { address: addr, abi: marketAbi, functionName: "getMarketState" as const, chainId: net.chain.id },
        { address: addr, abi: marketAbi, functionName: "paused" as const, chainId: net.chain.id },
        { address: addr, abi: marketAbi, functionName: "totalCollateral" as const, chainId: net.chain.id },
        { address: addr, abi: marketAbi, functionName: "collateralCap" as const, chainId: net.chain.id },
        { address: addr, abi: marketAbi, functionName: "supplyCap" as const, chainId: net.chain.id },
        { address: feed, abi: clAggAbi, functionName: "latestRoundData" as const, chainId: net.chain.id },
      ];
    }),
  });

  // Per market when wallet connected: getPosition, claimOf, collateral balanceOf + 1 shared debt balanceOf at the end
  const userReads = useReadContracts({
    allowFailure: true,
    query: { enabled: !!address },
    contracts: [
      ...markets.flatMap((m) => {
        const addr = (m.market ?? zero) as Address;
        return [
          { address: addr, abi: marketAbi, functionName: "getPosition" as const, args: [acct] as const, chainId: net.chain.id },
          { address: addr, abi: marketAbi, functionName: "claimOf" as const, args: [acct] as const, chainId: net.chain.id },
          { address: m.collateral, abi: tokenAbi, functionName: "balanceOf" as const, args: [acct] as const, chainId: net.chain.id },
        ];
      }),
      { address: debtToken, abi: tokenAbi, functionName: "balanceOf" as const, args: [acct] as const, chainId: net.chain.id },
    ],
  });

  const nowS = Math.floor(Date.now() / 1000);
  const pData = poolReads.data;
  const uData = userReads.data;

  const rows: MarketHealthRow[] = markets.map((spec, idx) => {
    const base = idx * 6;
    const ms = pData?.[base]?.result as readonly bigint[] | undefined;
    const paused = Boolean(pData?.[base + 1]?.result ?? false);
    const rawTotColl = pData?.[base + 2]?.result as bigint | undefined;
    const rawColCap = pData?.[base + 3]?.result as bigint | undefined;
    const rawSupCap = pData?.[base + 4]?.result as bigint | undefined;
    const clRound = pData?.[base + 5]?.result as readonly [bigint, bigint, bigint, bigint, bigint] | undefined;

    const clPrice = clRound && clRound[1] > 0n ? Number(formatUnits(clRound[1], 8)) : null;
    const clAt = clRound ? Number(clRound[3]) : 0;

    const poolSupplied = ms ? num(ms[0], spec.debtDecimals) : 0;
    const poolBorrowed = ms ? num(ms[1], spec.debtDecimals) : 0;
    const poolAvailable = ms ? num(ms[2], spec.debtDecimals) : 0;
    const mktPrice = ms && ms[4] > 0n ? num(ms[4], 8) : null;
    const mktPriceAt = ms ? Number(ms[5] ?? 0n) : 0;

    const price = mktPrice ?? clPrice ?? spec.fallbackPrice;
    const priceAt = mktPriceAt || clAt;
    const stale = priceAt > 0 ? nowS - priceAt > spec.maxOracleAge : false;

    const totalCollateral = typeof rawTotColl === "bigint" ? num(rawTotColl, spec.collDecimals) : 0;
    const collateralCap = typeof rawColCap === "bigint" && rawColCap !== maxUint256 ? num(rawColCap, spec.collDecimals) : Infinity;
    const supplyCap = typeof rawSupCap === "bigint" && rawSupCap !== maxUint256 ? num(rawSupCap, spec.debtDecimals) : Infinity;
    const isPoolLive = spec.id === "WETH" || !isMainnet || poolSupplied > 0 || totalCollateral > 0;

    const uBase = idx * 3;
    const pos = address ? (uData?.[uBase]?.result as readonly bigint[] | undefined) : undefined;
    const rawClaim = address ? uData?.[uBase + 1]?.result : undefined;
    const rawWalColl = address ? uData?.[uBase + 2]?.result : undefined;

    const coll = pos ? num(pos[0], spec.collDecimals) : 0;
    const debt = pos ? num(pos[1], spec.debtDecimals) : 0;
    const hf = pos ? (pos[2] === maxUint256 ? Infinity : num(pos[2], 18)) : Infinity;
    const collUsd = coll * price;
    const ltv = collUsd > 0 ? debt / collUsd : 0;
    const liqPrice = debt > 0 && coll > 0 ? debt / (coll * spec.liqThreshold) : 0;
    const maxBorrowUsd = collUsd * spec.maxLtv;
    const borrowRoomUsd = Math.max(0, Math.min(maxBorrowUsd - debt, poolAvailable));
    const ltBufferUsd = Math.max(0, collUsd * spec.liqThreshold - debt);
    const dropToLiqPct = debt > 0 && price > 0 ? Math.max(0, ((price - liqPrice) / price) * 100) : 100;

    let status: MarketHealthRow["status"] = "NO_POSITION";
    if (coll > 0 || debt > 0) {
      if (debt === 0 || hf >= 1.3) status = "SAFE";
      else if (hf >= 1.15) status = "NEAR_LT";
      else if (hf >= 1.0) status = "CRITICAL";
      else status = "LIQUIDATABLE";
    }

    return {
      spec,
      price,
      priceAt,
      stale,
      paused,
      poolSupplied,
      poolBorrowed,
      poolAvailable,
      totalCollateral,
      collateralCap,
      supplyCap,
      isPoolLive,
      coll,
      collUsd,
      debt,
      hf,
      ltv,
      liqPrice,
      borrowRoomUsd,
      ltBufferUsd,
      dropToLiqPct,
      lenderClaim: num(rawClaim, spec.debtDecimals),
      walletColl: num(rawWalColl, spec.collDecimals),
      status,
    };
  });

  const debtWalletIdx = markets.length * 3;
  const walletDebtBal = address ? num(uData?.[debtWalletIdx]?.result, markets[0].debtDecimals) : 0;

  const totals = rows.reduce(
    (acc, r) => {
      acc.collUsd += r.collUsd;
      acc.debtUsd += r.debt;
      acc.borrowRoomUsd += r.borrowRoomUsd;
      acc.lenderClaimUsd += r.lenderClaim;
      if (r.coll > 0 || r.debt > 0) acc.activeCount++;
      if (r.debt > 0 && r.hf < acc.minHf) acc.minHf = r.hf;
      return acc;
    },
    { collUsd: 0, debtUsd: 0, borrowRoomUsd: 0, lenderClaimUsd: 0, activeCount: 0, minHf: Infinity }
  );

  return {
    net,
    isMainnet,
    isConnected,
    address,
    rows,
    totals,
    walletDebtBal,
    loading: poolReads.isLoading || (!!address && userReads.isLoading),
    refetch: () => {
      poolReads.refetch();
      userReads.refetch();
    },
  };
}
