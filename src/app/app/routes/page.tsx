"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Pair, TokenIcon } from "../../TokenIcon";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { formatUnits, type Address, type Chain } from "viem";
import { arbitrum, avalanche, base, bsc, mainnet, optimism, polygon } from "viem/chains";
import { useAccount, useReadContracts, useSendTransaction, useSwitchChain, useWriteContract } from "wagmi";
import s from "../trade.module.css";
import r from "./routes.module.css";
import { tokenAbi } from "@/lib/abi";
import { DEPLOYMENTS, rhMainnet, txUrl } from "@/lib/chain";
import { MAINNET_MARKETS } from "@/lib/markets";
import { useLengo, useLengoTx } from "@/lib/useLengo";
import { ensureWalletChain } from "@/lib/walletChain";
import { useToast } from "../../Toaster";

type Tok = { assetId: string; decimals: number; blockchain: string; symbol: string; price?: number; contractAddress?: string };
type SwapTxRef = { hash: string; explorerUrl?: string } | string;
type SwapDetails = {
  depositedAmountFormatted?: string | null;
  amountOutFormatted?: string | null;
  originChainTxHashes?: SwapTxRef[];
  destinationChainTxHashes?: SwapTxRef[];
};
type Quote = {
  status: string;
  reason?: string;
  dry?: boolean;
  depositAddress?: string;
  depositMemo?: string;
  amountInUnits?: string;
  amountIn?: string;
  amountOut?: string;
  amountOutUsd?: string;
  amountInUsd?: string;
  minAmountOut?: string;
  timeEstimate?: number;
  fees?: { refundFee?: string; withdrawFee?: string; appFees?: { fee: number }[] };
  deadline?: string;
  quotedAt?: string;
  origin?: { assetId?: string; symbol: string; chain: string; decimals: number; contractAddress?: string };
  destination?: { assetId?: string; symbol: string; chain: string; decimals: number; contractAddress?: string };
};

const CHAIN_META: Record<string, { key: string; short: string; evmChain?: Chain; explorerTx: string }> = {
  "Robinhood (hood)": { key: "hood", short: "Robinhood", evmChain: rhMainnet, explorerTx: "https://robinhoodchain.blockscout.com/tx/" },
  Solana: { key: "sol", short: "Solana", explorerTx: "https://solscan.io/tx/" },
  Base: { key: "base", short: "Base", evmChain: base, explorerTx: "https://basescan.org/tx/" },
  Arbitrum: { key: "arb", short: "Arbitrum", evmChain: arbitrum, explorerTx: "https://arbiscan.io/tx/" },
  Ethereum: { key: "eth", short: "Ethereum", evmChain: mainnet, explorerTx: "https://etherscan.io/tx/" },
  Optimism: { key: "op", short: "Optimism", evmChain: optimism, explorerTx: "https://optimistic.etherscan.io/tx/" },
  Polygon: { key: "pol", short: "Polygon", evmChain: polygon, explorerTx: "https://polygonscan.com/tx/" },
  "BNB Chain": { key: "bsc", short: "BNB", evmChain: bsc, explorerTx: "https://bscscan.com/tx/" },
  Avalanche: { key: "avax", short: "Avalanche", evmChain: avalanche, explorerTx: "https://snowtrace.io/tx/" },
  NEAR: { key: "near", short: "NEAR", explorerTx: "https://nearblocks.io/txns/" },
  TON: { key: "ton", short: "TON", explorerTx: "https://tonviewer.com/transaction/" },
  TRON: { key: "tron", short: "TRON", explorerTx: "https://tronscan.org/#/transaction/" },
  Sui: { key: "sui", short: "Sui", explorerTx: "https://suiscan.xyz/mainnet/tx/" },
  Aptos: { key: "aptos", short: "Aptos", explorerTx: "https://explorer.aptoslabs.com/txn/" },
  Stellar: { key: "stellar", short: "Stellar", explorerTx: "https://stellar.expert/explorer/public/tx/" },
  Bitcoin: { key: "btc", short: "Bitcoin", explorerTx: "https://mempool.space/tx/" },
  Zcash: { key: "zec", short: "Zcash", explorerTx: "https://blockchair.com/zcash/transaction/" },
};

const isEvmLabel = (label: string) => Boolean(CHAIN_META[label]?.evmChain);

type PresetKind = {
  id: "payout" | "collateral" | "repay" | "supply" | "swap";
  tag: string;
  label: string;
  sub: string;
  originChains: string[];
  originAssets: string[];
  destChains: string[];
  destAssets: string[];
  defaultFromChain: string;
  defaultFromAsset: string;
  defaultToChain: string;
  defaultToAsset: string;
  defaultAmt: string;
  note: string;
  steps: string[];
};

const PRESETS: PresetKind[] = [
  {
    id: "payout",
    tag: "14+ CHAINS · MULTI-STABLE PAYOUT",
    label: "Borrow payout",
    sub: "USDG → 14+ chains · USDC/USDT/DAI",
    originChains: ["Robinhood (hood)"],
    originAssets: ["USDG"],
    destChains: ["Solana", "Base", "Arbitrum", "Ethereum", "Optimism", "Polygon", "BNB Chain", "Avalanche", "TON", "TRON", "Sui", "NEAR", "Aptos", "Stellar"],
    destAssets: ["USDC", "USDT", "DAI"],
    defaultFromChain: "Robinhood (hood)",
    defaultFromAsset: "USDG",
    defaultToChain: "Solana",
    defaultToAsset: "USDC",
    defaultAmt: "10",
    note: "Select any target chain and preferred stablecoin (USDC, USDT, or DAI) below — live NEAR Intents solver quotes update automatically.",
    steps: ["Borrow USDG on Robinhood Chain", "Pick target chain & stablecoin", "Send USDG to 1Click", "Receive USDC / USDT / DAI on target chain"],
  },
  {
    id: "collateral",
    tag: "CROSS-CHAIN COLLATERAL INFLOW",
    label: "Cross-chain collateral",
    sub: "Any chain → ETH / WETH → LengoMarket",
    originChains: ["Solana", "Base", "Arbitrum", "Ethereum", "Optimism", "Polygon", "BNB Chain", "Avalanche", "Bitcoin"],
    originAssets: ["SOL", "USDC", "USDT", "ETH", "BTC"],
    destChains: ["Robinhood (hood)"],
    destAssets: ["ETH", "WETH", "USDe"],
    defaultFromChain: "Solana",
    defaultFromAsset: "SOL",
    defaultToChain: "Robinhood (hood)",
    defaultToAsset: "ETH",
    defaultAmt: "0.03",
    note: "Route assets from an external network (e.g. SOL on Solana or USDC on Base) via NEAR Intents 1Click into ETH/WETH on Robinhood Chain, then deposit directly into LengoMarket collateral.",
    steps: ["Select origin network & token", "Route into ETH / WETH on RHC", "Deposit WETH collateral in LengoMarket", "Borrow USDG against locked collateral"],
  },
  {
    id: "repay",
    tag: "ANY-CHAIN DEBT SETTLEMENT",
    label: "Cross-chain repay",
    sub: "Any stablecoin → repay USDG & unlock",
    originChains: ["Solana", "Base", "Arbitrum", "Polygon", "Optimism", "Ethereum", "BNB Chain", "Avalanche", "TRON", "TON", "NEAR"],
    originAssets: ["USDC", "USDT", "DAI", "SOL", "ETH"],
    destChains: ["Robinhood (hood)"],
    destAssets: ["USDG"],
    defaultFromChain: "Solana",
    defaultFromAsset: "USDC",
    defaultToChain: "Robinhood (hood)",
    defaultToAsset: "USDG",
    defaultAmt: "5",
    note: "Settle your Robinhood Chain USDG debt from any external network via NEAR Intents 1Click, then unlock and withdraw your collateral in one continuous flow.",
    steps: ["Pick external chain & asset", "1Click settles USDG to your RH wallet", "Execute Repay All on LengoMarket", "Withdraw unlocked collateral"],
  },
  {
    id: "supply",
    tag: "COMMUNITY POOL · CROSS-CHAIN LEND",
    label: "Cross-chain supply",
    sub: "Any chain → USDG → earn Lengo yield",
    originChains: ["Solana", "Base", "Arbitrum", "Polygon", "Optimism", "Ethereum", "BNB Chain", "Avalanche", "TRON", "TON", "NEAR"],
    originAssets: ["USDC", "USDT", "DAI", "SOL", "ETH"],
    destChains: ["Robinhood (hood)"],
    destAssets: ["USDG"],
    defaultFromChain: "Solana",
    defaultFromAsset: "USDC",
    defaultToChain: "Robinhood (hood)",
    defaultToAsset: "USDG",
    defaultAmt: "10",
    note: "Supply liquidity from any external chain into Lengo's isolated Crypto & RWA Stock lending pools on Robinhood Chain via NEAR Intents 1Click to earn borrower APR.",
    steps: ["Pick origin network & asset", "1Click routes into USDG on Robinhood Chain", "Select isolated Crypto or RWA market", "Supply USDG to pool & accrue lender yield"],
  },
  {
    id: "swap",
    tag: "1CLICK INTENT ROUTER",
    label: "BTC / ZEC swap",
    sub: "BTC · ZEC → USDC / USDT",
    originChains: ["Bitcoin", "Zcash"],
    originAssets: ["BTC", "ZEC"],
    destChains: ["Solana", "Base", "Arbitrum", "Ethereum", "Polygon"],
    destAssets: ["USDC", "USDT"],
    defaultFromChain: "Bitcoin",
    defaultFromAsset: "BTC",
    defaultToChain: "Solana",
    defaultToAsset: "USDC",
    defaultAmt: "0.01",
    note: "Cross-chain BTC or transparent ZEC swap via NEAR Intents 1Click (distinct from native collateral locking).",
    steps: ["Select BTC or ZEC origin", "Send to 1Click deposit address", "Solver settles on NEAR Intents", "Receive USDC / USDT on target chain"],
  },
];

function fmtDuration(totalSec: number): string {
  const sec = Math.max(0, Math.round(totalSec));
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) {
    const m = Math.floor(sec / 60);
    const rem = sec % 60;
    return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
  }
  if (sec < 86400) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  return h > 0 ? `${d}d ${h}h` : `${d}d`;
}

function fmtQuoteClock(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function fmtAgo(iso: string, nowMs: number): string {
  const diff = Math.max(0, Math.round((nowMs - new Date(iso).getTime()) / 1000));
  if (diff < 5) return "just now";
  return `${fmtDuration(diff)} ago`;
}

function fmtSwapStatus(st: string | null): string {
  if (!st) return "";
  switch (st) {
    case "PENDING_DEPOSIT":
      return "Awaiting deposit";
    case "KNOWN_DEPOSIT_TX":
      return "Deposit submitted";
    case "PROCESSING":
      return "Swapping";
    case "SUCCESS":
      return "Settled ✓";
    case "INCOMPLETE_DEPOSIT":
      return "Incomplete deposit";
    case "REFUNDED":
      return "Refunded";
    case "FAILED":
      return "Failed";
    default:
      return st;
  }
}

function chainTxLink(chainLabel: string, ref: SwapTxRef): { hash: string; url: string } | null {
  const hash = typeof ref === "string" ? ref : ref?.hash;
  if (!hash) return null;
  const provided = typeof ref === "object" ? ref?.explorerUrl : undefined;
  if (provided) return { hash, url: provided };
  const baseExp = CHAIN_META[chainLabel]?.explorerTx;
  if (baseExp) return { hash, url: `${baseExp}${hash}` };
  return { hash, url: `https://explorer.near-intents.org/transactions/${hash}` };
}

function RoutesInner() {
  const searchParams = useSearchParams();
  const { address, isConnected, chainId, connector } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const { sendTransactionAsync } = useSendTransaction();
  const toast = useToast();

  const [execMode, setExecMode] = useState(true); // true = Live by default, false = Preview
  const [preset, setPreset] = useState<PresetKind>(PRESETS[0]);
  const [fromChain, setFromChain] = useState(PRESETS[0].defaultFromChain);
  const [fromAsset, setFromAsset] = useState(PRESETS[0].defaultFromAsset);
  const [toChain, setToChain] = useState(PRESETS[0].defaultToChain);
  const [toAsset, setToAsset] = useState(PRESETS[0].defaultToAsset);
  const [amt, setAmt] = useState(PRESETS[0].defaultAmt);

  const [state, setState] = useState<"idle" | "loading" | "unavailable" | "ok">("idle");
  const [toks, setToks] = useState<Tok[] | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string>("");
  const [discErr, setDiscErr] = useState("");
  const [recipient, setRecipient] = useState("");
  const [refundTo, setRefundTo] = useState("");
  const [q, setQ] = useState<Quote | null>(null);
  const [swapStatus, setSwapStatus] = useState<string | null>(null);
  const [swapDetails, setSwapDetails] = useState<SwapDetails | null>(null);
  const [depositTx, setDepositTx] = useState<string | null>(null);
  const [manualTx, setManualTx] = useState("");
  const [lengoTxHashes, setLengoTxHashes] = useState<{ label: string; hash: string }[]>([]);
  const [supplyPoolId, setSupplyPoolId] = useState<string>(MAINNET_MARKETS[0].id);
  const [sending, setSending] = useState(false);
  const [copiedDep, setCopiedDep] = useState(false);
  const [now, setNow] = useState(Date.now());
  const reqId = useRef(0);

  // Target LengoMarket for Cross-chain Collateral, Cross-chain Repay & Cross-chain Supply
  const targetMarketSpec = useMemo(() => {
    if (preset.id === "supply" || preset.id === "repay") {
      return MAINNET_MARKETS.find((m) => m.id === supplyPoolId) ?? MAINNET_MARKETS[0];
    }
    if (preset.id === "collateral" && toAsset === "USDe") {
      return MAINNET_MARKETS.find((m) => m.id === "USDe") ?? MAINNET_MARKETS[0];
    }
    return MAINNET_MARKETS[0]; // WETH / USDG primary live market
  }, [preset.id, toAsset, supplyPoolId]);

  const lengo = useLengo(targetMarketSpec);
  const lengoTx = useLengoTx(() => {
    lengo.refetch();
  }, targetMarketSpec);

  // Capture latest LengoMarket tx hash when modal finishes confirming
  useEffect(() => {
    const doneStep = lengoTx.steps?.find((st) => st.label === "Confirmed" && st.state === "done" && st.hash);
    if (doneStep?.hash) {
      setLengoTxHashes((prev) =>
        prev.some((x) => x.hash === doneStep.hash)
          ? prev
          : [...prev, { label: preset.id === "collateral" ? `LengoMarket Deposit (${targetMarketSpec.collSymbol})` : "LengoMarket Tx", hash: doneStep.hash! }]
      );
    }
  }, [lengoTx.steps, preset.id, targetMarketSpec.collSymbol]);

  const resetQuoteOnly = () => {
    setQ((prev) => (prev?.depositAddress ? null : prev));
    setSwapStatus(null);
    setSwapDetails(null);
    setDepositTx(null);
  };

  const applyPreset = (p: PresetKind, customAmt?: string) => {
    setPreset(p);
    setFromChain(p.defaultFromChain);
    setFromAsset(p.defaultFromAsset);
    setToChain(p.defaultToChain);
    setToAsset(p.defaultToAsset);
    setAmt(customAmt || p.defaultAmt);
    setState("idle");
    setQ(null);
    setSwapStatus(null);
    setSwapDetails(null);
    setDepositTx(null);
    setManualTx("");
    setLengoTxHashes([]);
    setRefundTo(isEvmLabel(p.defaultFromChain) && address ? address : "");
    setRecipient(isEvmLabel(p.defaultToChain) && address ? address : "");
  };

  // Initialize from URL query parameters (?preset=payout|collateral|repay&mode=live&amt=...)
  const didInitUrl = useRef(false);
  useEffect(() => {
    if (didInitUrl.current) return;
    didInitUrl.current = true;
    const pParam = searchParams.get("preset");
    const mParam = searchParams.get("mode");
    const aParam = searchParams.get("amt");
    const mktParam = searchParams.get("market");
    if (mktParam && MAINNET_MARKETS.some((m) => m.id === mktParam)) {
      setSupplyPoolId(mktParam);
    }
    if (mParam === "live") setExecMode(true);
    else if (mParam === "preview") setExecMode(false);
    const found = PRESETS.find((x) => x.id === pParam);
    if (found) {
      applyPreset(found, aParam || undefined);
    } else if (aParam) {
      setAmt(aParam.replace(/[^0-9.]/g, ""));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Sync EVM wallet address onto EVM origin/destination fields, and update when user switches active wallet
  const prevAddrRef = useRef<string | undefined>(address);
  useEffect(() => {
    const addrChanged = prevAddrRef.current !== address;
    prevAddrRef.current = address;

    if (isEvmLabel(fromChain)) {
      if (address && (!refundTo || addrChanged)) setRefundTo(address);
    } else if (refundTo.startsWith("0x")) {
      setRefundTo("");
    }
    if (isEvmLabel(toChain)) {
      if (address && (!recipient || addrChanged)) setRecipient(address);
    } else if (recipient.startsWith("0x")) {
      setRecipient("");
    }
  }, [address, fromChain, toChain, refundTo, recipient]);

  useEffect(() => {
    fetch("/api/routes/tokens")
      .then((res) => res.json())
      .then((j) => {
        if (j.tokens) {
          setToks(j.tokens);
          setFetchedAt(j.fetchedAt);
        } else setDiscErr(j.reason || "unavailable");
      })
      .catch((e) => setDiscErr(String(e)));
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const findTok = (sym: string, chainLabel: string) => {
    const ck = CHAIN_META[chainLabel]?.key;
    return toks?.find((t) => t.symbol === sym && t.blockchain === ck);
  };

  // Auto-align asset selection when switching chain so user always lands on a valid pair
  useEffect(() => {
    if (!toks) return;
    if (!findTok(fromAsset, fromChain)) {
      const validAsset = preset.originAssets.find((sym) => !!findTok(sym, fromChain));
      if (validAsset) setFromAsset(validAsset);
    }
    if (!findTok(toAsset, toChain)) {
      const validDestAsset = preset.destAssets.find((sym) => !!findTok(sym, toChain));
      if (validDestAsset) setToAsset(validDestAsset);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toks, fromChain, toChain, preset.id]);

  const origin = findTok(fromAsset, fromChain);
  const destTok = findTok(toAsset, toChain);

  // Auto-fetch a read-only market quote whenever pair/amount changes and no live depositAddress is active yet!
  useEffect(() => {
    if (!origin || !destTok || !(parseFloat(amt) > 0)) return;
    if (execMode && q?.depositAddress) return;
    const timer = setTimeout(async () => {
      const id = ++reqId.current;
      setState("loading");
      try {
        const res = await fetch("/api/routes/quote", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            originAsset: origin.assetId,
            destinationAsset: destTok.assetId,
            amount: amt,
            recipient,
            refundTo,
            slippageBps: 50,
            execute: false, // read-only auto-preview; dedicated deposit address issued only when clicking CTA in Live mode
          }),
        });
        const j: Quote = await res.json();
        if (id !== reqId.current) return;
        setQ(j);
        setState(j.status === "ok" ? "ok" : "unavailable");
      } catch (e) {
        if (id === reqId.current) {
          setQ({ status: "unavailable", reason: String(e) });
          setState("unavailable");
        }
      }
    }, 320);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin?.assetId, destTok?.assetId, amt]);

  // Poll live 1Click status when an executable quote has issued a depositAddress
  useEffect(() => {
    const dep = q?.depositAddress;
    if (!dep || q?.dry !== false) return;
    let stop = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/routes/status?depositAddress=${encodeURIComponent(dep)}`);
        if (!res.ok) return;
        const j = await res.json();
        if (!stop && j.status) {
          setSwapStatus(j.status);
          if (j.swapDetails) setSwapDetails(j.swapDetails);
          if (j.status === "SUCCESS" || j.status === "REFUNDED" || j.status === "FAILED") {
            stop = true;
            lengo.refetch();
          }
        }
      } catch {
        /* ignore transient network errors */
      }
    };
    poll();
    const iv = setInterval(poll, 5000);
    return () => {
      stop = true;
      clearInterval(iv);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q?.depositAddress, q?.dry]);

  const expired = q?.deadline ? new Date(q.deadline).getTime() < now : false;

  const originEvmChain = CHAIN_META[fromChain]?.evmChain;
  const originErc20 = (
    origin?.contractAddress ||
    origin?.assetId.match(/0x[a-fA-F0-9]{40}/)?.[0] ||
    (fromChain === "Robinhood (hood)" && fromAsset === "USDG" ? DEPLOYMENTS.mainnet.debtAsset : undefined)
  ) as Address | undefined;

  const evmBalQuery = useReadContracts({
    allowFailure: true,
    query: { enabled: !!address && !!originEvmChain && !!originErc20 },
    contracts:
      originErc20 && address && originEvmChain
        ? [{ address: originErc20, abi: tokenAbi, functionName: "balanceOf", args: [address], chainId: originEvmChain.id }]
        : [],
  });
  const originDec = origin?.decimals ?? (fromAsset === "USDG" || fromAsset === "USDC" || fromAsset === "USDT" ? 6 : 18);
  const rawOriginBal = evmBalQuery.data?.[0]?.result;
  const originBal = typeof rawOriginBal === "bigint" ? Number(formatUnits(rawOriginBal, originDec)) : null;
  const overOriginBal =
    execMode && !!originEvmChain && !!originErc20 && isConnected && originBal !== null && (parseFloat(amt) || 0) > originBal + 1e-6;

  async function requestQuote(forceLive = execMode) {
    if (!origin || !destTok) return;
    const id = ++reqId.current;
    setState("loading");
    setSwapStatus(null);
    setSwapDetails(null);
    setDepositTx(null);
    try {
      const res = await fetch("/api/routes/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          originAsset: origin.assetId,
          destinationAsset: destTok.assetId,
          amount: amt,
          recipient,
          refundTo,
          slippageBps: 50,
          execute: forceLive,
        }),
      });
      const j: Quote = await res.json();
      if (id !== reqId.current) return;
      setQ(j);
      setState(j.status === "ok" ? "ok" : "unavailable");
      if (j.status === "ok" && forceLive && j.depositAddress) {
        setSwapStatus("PENDING_DEPOSIT");
      }
    } catch (e) {
      if (id === reqId.current) {
        setQ({ status: "unavailable", reason: String(e) });
        setState("unavailable");
      }
    }
  }

  async function sendFromEvmWallet() {
    if (!q?.depositAddress || !q.amountInUnits || !q.origin || !origin || !originEvmChain) return;
    setSending(true);
    try {
      const expectedChainKey = CHAIN_META[fromChain]?.key;
      if (
        q.origin.chain !== expectedChainKey ||
        q.origin.symbol !== origin.symbol ||
        q.origin.decimals !== origin.decimals ||
        (q.origin.assetId && q.origin.assetId !== origin.assetId)
      ) {
        throw new Error("Selected asset does not match active 1Click quote — please refresh quote");
      }

      if (chainId !== originEvmChain.id) {
        const ok = await ensureWalletChain(originEvmChain, connector, switchChainAsync);
        if (!ok) throw new Error(`Switch wallet to ${fromChain} (${originEvmChain.id}) to send`);
      }

      const dep = q.depositAddress as Address;
      if (!/^0x[a-fA-F0-9]{40}$/.test(dep)) {
        throw new Error("Invalid EVM deposit address returned by quote");
      }

      const units = BigInt(q.amountInUnits);
      if (units <= 0n) throw new Error("Quoted transfer amount must be greater than zero");

      const isNativeToken =
        (q.origin.symbol === "ETH" || q.origin.symbol === "POL" || q.origin.symbol === "BNB" || q.origin.symbol === "AVAX") &&
        !q.origin.contractAddress &&
        !q.origin.assetId?.match(/0x[a-fA-F0-9]{40}/);

      let hash: `0x${string}`;
      if (isNativeToken) {
        hash = await sendTransactionAsync({
          to: dep,
          value: units,
          chainId: originEvmChain.id,
        });
      } else {
        const quotedAddr = (
          q.origin.contractAddress ||
          q.origin.assetId?.match(/0x[a-fA-F0-9]{40}/)?.[0] ||
          origin.contractAddress ||
          origin.assetId.match(/0x[a-fA-F0-9]{40}/)?.[0]
        ) as Address | undefined;

        if (!quotedAddr || !/^0x[a-fA-F0-9]{40}$/.test(quotedAddr)) {
          throw new Error(`Cannot resolve verified ERC-20 contract address for ${q.origin.symbol}`);
        }
        if (
          fromChain === "Robinhood (hood)" &&
          q.origin.symbol === "USDG" &&
          DEPLOYMENTS.mainnet.debtAsset &&
          quotedAddr.toLowerCase() !== DEPLOYMENTS.mainnet.debtAsset.toLowerCase()
        ) {
          throw new Error("Quoted USDG contract does not match canonical Robinhood Chain USDG");
        }

        hash = await writeContractAsync({
          address: quotedAddr,
          abi: tokenAbi,
          functionName: "transfer",
          args: [dep, units],
          chainId: originEvmChain.id,
        });
      }

      setDepositTx(hash);
      toast.push({ kind: "ok", title: `Sent ${amt} ${q.origin.symbol} to 1Click`, detail: "Submitting txHash to solver network…", hash });
      await fetch("/api/routes/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ txHash: hash, depositAddress: q.depositAddress }),
      });
      setSwapStatus("KNOWN_DEPOSIT_TX");
      evmBalQuery.refetch();
    } catch (e) {
      const m = (e as Error).message || "Transfer failed";
      toast.push({ kind: "err", title: /rejected|denied/i.test(m) ? "Rejected in wallet" : "Send failed", detail: m.split("\n")[0].slice(0, 120) });
    } finally {
      setSending(false);
    }
  }

  async function submitManualOriginTx() {
    const clean = manualTx.trim();
    if (!clean || !q?.depositAddress) return;
    setDepositTx(clean);
    await fetch("/api/routes/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ txHash: clean, depositAddress: q.depositAddress }),
    });
    setSwapStatus("KNOWN_DEPOSIT_TX");
    setManualTx("");
    toast.push({ kind: "ok", title: "Origin tx submitted to 1Click", detail: clean.slice(0, 18) + "…" });
  }

  const fmtOut = (v?: string) => (v && q?.destination ? (Number(v) / 10 ** q.destination.decimals).toLocaleString("en-US", { maximumFractionDigits: 6 }) : "—");
  const canSendDirect = execMode && state === "ok" && !!q?.depositAddress && !expired && !!originEvmChain && isConnected && !overOriginBal;

  const originTxs = (swapDetails?.originChainTxHashes ?? [])
    .map((ref) => chainTxLink(fromChain, ref))
    .filter((x): x is { hash: string; url: string } => !!x);
  const destTxs = (swapDetails?.destinationChainTxHashes ?? [])
    .map((ref) => chainTxLink(toChain, ref))
    .filter((x): x is { hash: string; url: string } => !!x);
  const primaryOriginUrl = depositTx ? `${CHAIN_META[fromChain]?.explorerTx ?? ""}${depositTx}` : originTxs[0]?.url;
  const primaryOriginHash = depositTx || originTxs[0]?.hash;

  const expiryRemSec = q?.deadline ? Math.max(0, Math.round((new Date(q.deadline).getTime() - now) / 1000)) : 0;

  // LengoMarket live metrics for Cross-chain Collateral & Cross-chain Repay
  const rhCollWallet = lengo.data?.collBal ?? 0;
  const rhUsdgWallet = lengo.data?.debtBal ?? 0;
  const rhPosColl = lengo.data?.coll ?? 0;
  const rhPosDebt = lengo.data?.debt ?? 0;
  const rhCollPrice = lengo.pool?.price ?? targetMarketSpec.fallbackPrice;
  const estOutNum = Number(swapDetails?.amountOutFormatted || q?.amountOut || "0");
  const depositReadyAmt = Math.min(rhCollWallet, estOutNum > 0 ? estOutNum : rhCollWallet);
  const estNewCollUsd = (rhPosColl + (estOutNum > 0 ? estOutNum : 0)) * rhCollPrice;
  const estBorrowCapUsd = Math.max(0, estNewCollUsd * targetMarketSpec.maxLtv - rhPosDebt);

  return (
    <>
      <div className={s.pageHead}>
        <div>
          <h1>Routes</h1>
          <p>
            Cross-chain collateral inflow, 14+ chain multi-stablecoin payouts, and any-chain debt repayment via NEAR Intents 1Click.
          </p>
        </div>
        <span>{execMode ? "Live Mode · dedicated deposit address" : "Preview Mode · auto-quoting live market rates"}</span>
      </div>

      <div className={`${s.frame} bevel`}>
        <aside className={s.list}>
          <div className={s.listHead}><span>Route flows</span><b>{PRESETS.length}</b></div>
          <div style={{ height: 12 }} />
          {PRESETS.map((x) => (
            <button key={x.id} className={`${s.mkt} ${preset.id === x.id ? s.mktOn : ""}`} onClick={() => applyPreset(x)}>
              <Pair a={x.defaultFromAsset} b={x.defaultToAsset} />
              <span><b>{x.label}</b><small>{x.sub}</small></span>
            </button>
          ))}
          <div className={r.journey}>
            <span className={s.k}>{preset.label}</span>
            <em>{preset.tag}</em>
            {preset.steps.map((t, i) => <div key={t}><i>{i + 1}</i>{t}</div>)}
          </div>
        </aside>

        <section key={preset.id} className={`${s.center} pane-swap`}>
          <div className={s.mHead}>
            <Pair a={fromAsset} b={toAsset} size={42} />
            <div>
              <h2>{fromAsset} → {toAsset}{preset.id === "collateral" ? ` → LengoMarket` : preset.id === "repay" ? ` → Repay Debt` : preset.id === "supply" ? ` → Supply ${targetMarketSpec.pair}` : ""}</h2>
              <p>{CHAIN_META[fromChain]?.short ?? fromChain} → {CHAIN_META[toChain]?.short ?? toChain} · {preset.tag}</p>
            </div>
            <div className={s.badges}>
              <span className={execMode ? s.active : ""}>{execMode ? "Live" : "Preview"}</span>
              <span>{q?.depositAddress ? "Address Issued" : execMode ? "Executable" : "Auto-Quote"}</span>
            </div>
          </div>

          <div className={s.stats} style={{ gridTemplateColumns: "repeat(5,1fr)" }}>
            <div><span>Provider</span><b>1Click</b></div>
            <div><span>Origin</span><b>{fromAsset} · {CHAIN_META[fromChain]?.short ?? fromChain}</b></div>
            <div><span>Destination</span><b>{toAsset} · {CHAIN_META[toChain]?.short ?? toChain}</b></div>
            <div><span>Slippage</span><b>0.50%</b></div>
            <div>
              <span>Status</span>
              <b className={state === "unavailable" || expired || swapStatus === "FAILED" ? s.warn : state === "ok" ? s.ok : ""}>
                {state === "loading" ? <span className="skel skel-sm" /> : swapStatus ? fmtSwapStatus(swapStatus) : state === "ok" ? (expired ? "Expired" : q?.depositAddress ? "Ready to deposit" : "Live quote ready") : state === "unavailable" ? "Unavailable" : "Ready"}
              </b>
            </div>
          </div>

          <div className={s.strip}>
            <span>
              {toks
                ? `Discovery · ${toks.length} tokens · ${fmtQuoteClock(fetchedAt)}`
                : discErr
                  ? "Discovery unavailable"
                  : <span className="skel skel-md" />}
            </span>
            <span>{!toks && !discErr ? <span className="skel skel-md" /> : origin ? origin.assetId.slice(0, 34) + "…" : "pair not in catalog"}</span>
            <span className={q?.depositAddress ? s.ok : execMode ? s.amberT : ""}>
              {q?.depositAddress
                ? `Deposit ${q.depositAddress.slice(0, 8)}…${q.depositAddress.slice(-6)}`
                : execMode
                  ? "Live Mode · enter recipient & click Get Live Deposit Address"
                  : "Preview Mode · auto-quoting live market rate"}
            </span>
          </div>

          <div className={s.viewBody}>
            {/* Visual 3-Node or 4-Node Pipeline (with LengoMarket Final Stage on Collateral & Repay!) */}
            <div className={r.route}>
              <div className={r.node}>
                <span>01 · Send ({CHAIN_META[fromChain]?.short ?? fromChain})</span>
                <b>{amt || "0"} {fromAsset}</b>
                <small>{fromChain}</small>
              </div>
              <div className={r.wire}><i /><em>1Click</em></div>
              <div className={r.node}>
                <span>02 · Solver Intent</span>
                <b>{swapStatus ? fmtSwapStatus(swapStatus) : execMode ? "Live Intent" : "Auto-Quote"}</b>
                <small>{execMode ? "real settlement" : "live market rate"}</small>
              </div>
              <div className={r.wire}><i /><em>settle</em></div>
              <div className={`${r.node} ${r.dst}`}>
                <span>03 · Receive ({CHAIN_META[toChain]?.short ?? toChain})</span>
                <b>{state === "loading" ? <span className="skel skel-md" /> : state === "ok" ? `${q?.amountOut} ${toAsset}` : `— ${toAsset}`}</b>
                <small>{state === "ok" && q?.amountOutUsd ? `≈ $${Number(q.amountOutUsd).toFixed(2)} USD` : toChain}</small>
              </div>
              {(preset.id === "collateral" || preset.id === "repay" || preset.id === "supply") && (
                <>
                  <div className={r.wire}><i /><em>onchain</em></div>
                  <div className={`${r.node} ${r.mktNode}`}>
                    <span>04 · LengoMarket (4663)</span>
                    <b>
                      {preset.id === "collateral"
                        ? `Lock ${toAsset}`
                        : preset.id === "supply"
                          ? `Supply ${targetMarketSpec.pair}`
                          : rhPosDebt > 0
                            ? `Repay $${rhPosDebt.toFixed(2)}`
                            : "Clear Debt"}
                    </b>
                    <small>
                      {preset.id === "collateral"
                        ? `${Math.round(targetMarketSpec.maxLtv * 100)}% Max LTV · ${targetMarketSpec.pair}`
                        : preset.id === "supply"
                          ? `Earn ${(targetMarketSpec.apr * 100).toFixed(1)}% borrower APR`
                          : `Unlock ${targetMarketSpec.collSymbol} collateral`}
                    </small>
                  </div>
                </>
              )}
            </div>

            {/* Live Protocol Impact Strip for Cross-chain Collateral & Cross-chain Repay */}
            {preset.id === "collateral" && (
              <div className={r.impact}>
                <div>
                  <span>Target Market</span>
                  <b>{targetMarketSpec.pair}</b>
                  <small>Max LTV {Math.round(targetMarketSpec.maxLtv * 100)}% · LT {Math.round(targetMarketSpec.liqThreshold * 100)}%</small>
                </div>
                <div>
                  <span>Est. {toAsset} Received</span>
                  <b className={s.ok}>{state === "loading" ? <span className="skel skel-sm" /> : state === "ok" ? `${Number(q?.amountOut || 0).toFixed(4)} ${toAsset}` : "—"}</b>
                  <small>landed on Robinhood Chain</small>
                </div>
                <div>
                  <span>New Borrow Capacity</span>
                  <b className={s.ok}>{state === "loading" ? <span className="skel skel-sm" /> : `$${estBorrowCapUsd.toFixed(2)} USDG`}</b>
                  <small>after locking in LengoMarket</small>
                </div>
                <div>
                  <span>Settlement Path</span>
                  <b>1Click → LengoMarket</b>
                  <small>Inbound route + collateral deposit</small>
                </div>
              </div>
            )}

            {preset.id === "repay" && (
              <div className={r.impact}>
                <div>
                  <span>Target Market Position</span>
                  <b>
                    <select
                      value={supplyPoolId}
                      onChange={(e) => setSupplyPoolId(e.target.value)}
                      className={r.sel}
                      aria-label="Target repay market"
                    >
                      {MAINNET_MARKETS.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.pair} ({m.category})
                        </option>
                      ))}
                    </select>
                  </b>
                  <small>{isConnected ? `Debt: $${rhPosDebt.toFixed(4)} USDG` : "connect wallet to read"}</small>
                </div>
                <div>
                  <span>Locked Collateral</span>
                  <b>{rhPosColl.toFixed(4)} {targetMarketSpec.collSymbol}</b>
                  <small>≈ ${(rhPosColl * rhCollPrice).toFixed(2)} USD</small>
                </div>
                <div>
                  <span>Est. USDG Delivered</span>
                  <b className={s.ok}>{state === "loading" ? <span className="skel skel-sm" /> : state === "ok" ? `${Number(q?.amountOut || 0).toFixed(2)} USDG` : "—"}</b>
                  <small>{state === "ok" && Number(q?.amountOut || 0) >= rhPosDebt ? "covers 100% of debt ✓" : "partial / custom repay"}</small>
                </div>
                <div>
                  <span>Post-Repay Status</span>
                  <b className={s.ok}>Withdraw Ready</b>
                  <small>0 debt · full {targetMarketSpec.collSymbol} exit</small>
                </div>
              </div>
            )}

            {preset.id === "supply" && (
              <div className={r.impact}>
                <div>
                  <span>Target Lending Pool</span>
                  <b>
                    <select
                      value={supplyPoolId}
                      onChange={(e) => setSupplyPoolId(e.target.value)}
                      className={r.sel}
                      aria-label="Target lending pool"
                    >
                      {MAINNET_MARKETS.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.pair} ({(m.apr * 100).toFixed(1)}% APR)
                        </option>
                      ))}
                    </select>
                  </b>
                  <small>{targetMarketSpec.category} isolated market</small>
                </div>
                <div>
                  <span>Pool Supplied / Cap</span>
                  <b>${(lengo.pool?.supplied ?? 0).toFixed(2)} USDG</b>
                  <small>Cap {targetMarketSpec.supplyCapLabel ?? "50,000 USDG"}</small>
                </div>
                <div>
                  <span>Est. USDG to Supply</span>
                  <b className={s.ok}>{state === "loading" ? <span className="skel skel-sm" /> : state === "ok" ? `${Number(q?.amountOut || 0).toFixed(2)} USDG` : "—"}</b>
                  <small>routed via NEAR Intents 1Click</small>
                </div>
                <div>
                  <span>Borrower Interest Rate</span>
                  <b className={s.ok}>{(targetMarketSpec.apr * 100).toFixed(1)}% Fixed APR</b>
                  <small>accrues per second in RAY</small>
                </div>
              </div>
            )}

            <p className={r.note}>{preset.note}</p>

            {/* Step 1: Live 1Click Deposit & Proof Box */}
            {execMode && state === "ok" && q?.depositAddress && (
              <div className={`${s.sim} bevel`} style={{ marginTop: 14, padding: 14, border: "1px solid var(--lime)" }}>
                <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
                    <span style={{ fontSize: 10, letterSpacing: "0.08em", color: "var(--tx3)" }}>
                      STEP 1 · 1CLICK DEPOSIT ADDRESS · {fromChain.toUpperCase()} · SEND ONLY {q.origin?.symbol ?? fromAsset}
                    </span>
                    <code style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--lime)", wordBreak: "break-all" }}>{q.depositAddress}</code>
                    {q.depositMemo && <small style={{ display: "block", color: "var(--amber)" }}>Memo required: {q.depositMemo}</small>}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        navigator.clipboard?.writeText(q.depositAddress!);
                        setCopiedDep(true);
                        setTimeout(() => setCopiedDep(false), 1600);
                      }}
                    >
                      {copiedDep ? "Copied ✓" : "Copy address"}
                    </button>
                    <a
                      className="btn"
                      href={`https://explorer.near-intents.org/transactions/${q.depositAddress}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Intents Explorer ↗
                    </a>
                    {canSendDirect && !depositTx && (
                      <button type="button" className="btn btn-primary" disabled={sending} onClick={sendFromEvmWallet}>
                        {sending ? "Sending…" : `Send ${amt} ${fromAsset} from ${CHAIN_META[fromChain]?.short ?? fromChain} Wallet →`}
                      </button>
                    )}
                  </div>
                </div>

                {!originEvmChain && !primaryOriginHash && (
                  <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, marginTop: 8 }}>
                    <input
                      value={manualTx}
                      onChange={(e) => setManualTx(e.target.value)}
                      placeholder={`Sent from external ${fromChain} wallet? Paste origin tx hash to speed up indexing…`}
                      style={{ flex: 1, background: "var(--bg)", border: "1px solid var(--line2)", padding: "7px 10px", fontFamily: "var(--mono)", fontSize: 11, color: "var(--tx)" }}
                    />
                    <button type="button" className="btn" disabled={!manualTx.trim()} onClick={submitManualOriginTx}>
                      Submit Tx Hash
                    </button>
                  </div>
                )}

                {(primaryOriginHash || destTxs.length > 0 || lengoTxHashes.length > 0) && (
                  <div style={{ gridColumn: "1 / -1", display: "flex", flexWrap: "wrap", gap: 14, fontSize: 11, fontFamily: "var(--mono)", color: "var(--tx2)", marginTop: 8, paddingTop: 8, borderTop: "1px dashed var(--line2)" }}>
                    {primaryOriginHash && primaryOriginUrl && (
                      <span>
                        Origin {CHAIN_META[fromChain]?.short ?? fromChain} tx:{" "}
                        <a href={primaryOriginUrl} target="_blank" rel="noreferrer">
                          {primaryOriginHash.slice(0, 8)}…{primaryOriginHash.slice(-6)} ↗
                        </a>
                      </span>
                    )}
                    <span>
                      Solver: <b style={{ color: "var(--lime)" }}>{fmtSwapStatus(swapStatus)}</b>
                    </span>
                    {destTxs.map((tx) => (
                      <span key={tx.hash}>
                        {CHAIN_META[toChain]?.short ?? toChain} {toAsset} tx:{" "}
                        <a href={tx.url} target="_blank" rel="noreferrer">
                          {tx.hash.slice(0, 8)}…{tx.hash.slice(-6)} ↗
                        </a>
                      </span>
                    ))}
                    {lengoTxHashes.map((lt) => (
                      <span key={lt.hash}>
                        {lt.label}:{" "}
                        <a href={txUrl(lt.hash, "mainnet")} target="_blank" rel="noreferrer" style={{ color: "var(--lime)" }}>
                          {lt.hash.slice(0, 8)}…{lt.hash.slice(-6)} ↗
                        </a>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 2 Guided Action — Lock Routed Asset as Collateral in LengoMarket */}
            {preset.id === "collateral" && isConnected && (swapStatus === "SUCCESS" || rhCollWallet > 0) && (
              <div className={`${s.sim} bevel`} style={{ marginTop: 12, padding: 14, border: "1px solid var(--line2)", background: "var(--bg)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <span style={{ display: "block", fontSize: 10, letterSpacing: "0.08em", color: "var(--lime)" }}>
                      STEP 2 · LOCK {targetMarketSpec.collSymbol} COLLATERAL IN LENGOMARKET (ROBINHOOD CHAIN 4663)
                    </span>
                    <small style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--tx2)" }}>
                      RH Wallet balance: <b>{rhCollWallet.toFixed(4)} {targetMarketSpec.collSymbol}</b> · Active collateral: <b>{rhPosColl.toFixed(4)} {targetMarketSpec.collSymbol}</b>
                    </small>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={rhCollWallet <= 0 || lengoTx.busy}
                      onClick={() => {
                        const depAmt = String(Math.floor(depositReadyAmt * 1e6) / 1e6);
                        if (parseFloat(depAmt) > 0) lengoTx.run("Deposit", depAmt);
                      }}
                    >
                      {lengoTx.busy ? "Confirming…" : `Lock ${depositReadyAmt.toFixed(4)} ${targetMarketSpec.collSymbol} as Collateral →`}
                    </button>
                    <Link href={`/app?market=${targetMarketSpec.id}&act=Borrow`} className="btn">
                      Open {targetMarketSpec.pair} Market ↗
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2 & 3 Guided Action — Repay USDG Debt & Withdraw Collateral on LengoMarket */}
            {preset.id === "repay" && isConnected && (rhPosDebt > 0 || rhPosColl > 0) && (
              <div className={`${s.sim} bevel`} style={{ marginTop: 12, padding: 14, border: "1px solid var(--line2)", background: "var(--bg)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <span style={{ display: "block", fontSize: 10, letterSpacing: "0.08em", color: "var(--lime)" }}>
                      STEP 2 &amp; 3 · SETTLE DEBT &amp; UNLOCK {targetMarketSpec.collSymbol} ON LENGOMARKET (RH 4663)
                    </span>
                    <small style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--tx2)" }}>
                      Outstanding debt: <b>${rhPosDebt.toFixed(4)} USDG</b> · RH Wallet USDG: <b>${rhUsdgWallet.toFixed(2)}</b> · Locked collateral: <b>{rhPosColl.toFixed(4)} {targetMarketSpec.collSymbol}</b>
                    </small>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {rhPosDebt > 0 && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={rhUsdgWallet <= 0 || lengoTx.busy}
                        onClick={() => {
                          const canAll = rhUsdgWallet >= rhPosDebt;
                          const repAmt = canAll ? rhPosDebt.toFixed(6) : String(Math.floor(rhUsdgWallet * 1e6) / 1e6);
                          lengoTx.run("Repay", repAmt, { all: canAll, debt: rhPosDebt });
                        }}
                      >
                        {lengoTx.busy
                          ? "Confirming…"
                          : rhUsdgWallet >= rhPosDebt
                            ? `Repay All Debt (${rhPosDebt.toFixed(2)} USDG) →`
                            : `Repay ${rhUsdgWallet.toFixed(2)} USDG →`}
                      </button>
                    )}
                    {rhPosColl > 0 && rhPosDebt === 0 && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={lengoTx.busy}
                        onClick={() => lengoTx.run("Withdraw", String(rhPosColl))}
                      >
                        {lengoTx.busy ? "Withdrawing…" : `Withdraw All ${rhPosColl.toFixed(4)} ${targetMarketSpec.collSymbol} →`}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2 Guided Action — Supply Routed USDG to Selected Isolated Pool */}
            {preset.id === "supply" && isConnected && (swapStatus === "SUCCESS" || rhUsdgWallet > 0) && (
              <div className={`${s.sim} bevel`} style={{ marginTop: 12, padding: 14, border: "1px solid var(--line2)", background: "var(--bg)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <span style={{ display: "block", fontSize: 10, letterSpacing: "0.08em", color: "var(--lime)" }}>
                      STEP 2 · SUPPLY ROUTED USDG TO {targetMarketSpec.pair} POOL (ROBINHOOD CHAIN 4663)
                    </span>
                    <small style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--tx2)" }}>
                      RH Wallet USDG: <b>${rhUsdgWallet.toFixed(2)} USDG</b> · Your current pool claim: <b>${(lengo.data?.claim ?? 0).toFixed(2)} USDG</b>
                    </small>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={rhUsdgWallet <= 0 || lengoTx.busy}
                      onClick={() => {
                        const supAmt = Math.min(rhUsdgWallet, estOutNum > 0 ? estOutNum : rhUsdgWallet);
                        const formatted = String(Math.floor(supAmt * 1e6) / 1e6);
                        if (parseFloat(formatted) > 0) lengoTx.run("Supply", formatted);
                      }}
                    >
                      {lengoTx.busy
                        ? "Supplying…"
                        : `Supply ${Math.min(rhUsdgWallet, estOutNum > 0 ? estOutNum : rhUsdgWallet).toFixed(2)} USDG to ${targetMarketSpec.pair} →`}
                    </button>
                    <Link href={`/app?market=${targetMarketSpec.id}&mode=Lend`} className="btn">
                      Open {targetMarketSpec.pair} Pool ↗
                    </Link>
                  </div>
                </div>
              </div>
            )}

            <div className={s.kv} style={{ marginTop: 16 }}>
              <div><span>Amount out</span><b>{state === "loading" ? <span className="skel skel-md" /> : state === "ok" ? `${q?.amountOut} ${toAsset}` : "—"}</b><small>{state === "loading" ? <span className="skel skel-xs" /> : state === "ok" ? `≈ $${Number(q?.amountOutUsd).toFixed(2)}` : "after quote"}</small></div>
              <div><span>Minimum received</span><b>{state === "loading" ? <span className="skel skel-md" /> : state === "ok" ? `${fmtOut(q?.minAmountOut)} ${toAsset}` : "—"}</b><small>0.5% slippage bound</small></div>
              <div>
                <span>$LENGO Fee Tier</span>
                <b className={lengo.hasLengoTier ? s.ok : ""}>
                  {lengo.hasLengoTier ? "0.00% (Holder Tier)" : "0.00% Beta (≥10k LENGO)"}
                </b>
                <small>
                  <a href="https://robinhoodchain.blockscout.com/token/0xc256e0fb1f93164b8e499746bba593a8e40a7eef" target="_blank" rel="noreferrer">
                    $LENGO 0xc256…7eef ↗
                  </a>
                </small>
              </div>
              <div><span>Est. duration</span><b>{state === "loading" ? <span className="skel skel-sm" /> : state === "ok" && typeof q?.timeEstimate === "number" ? `~${fmtDuration(q.timeEstimate)}` : "—"}</b><small>provider estimate</small></div>
              <div><span>Quote time</span><b>{state === "loading" ? <span className="skel skel-sm" /> : state === "ok" && q?.quotedAt ? fmtQuoteClock(q.quotedAt) : "—"}</b><small>{state === "ok" && q?.quotedAt ? fmtAgo(q.quotedAt, now) : "provider timestamp"}</small></div>
              <div><span>Expiry</span><b className={expired ? s.warn : ""}>{state === "loading" ? <span className="skel skel-sm" /> : state === "ok" && q?.deadline ? (expired ? "Expired" : fmtDuration(expiryRemSec)) : "—"}</b><small>{expired ? "request a new quote" : state === "ok" && q?.deadline ? `until ${fmtQuoteClock(q.deadline)}` : "quote window"}</small></div>
            </div>

            {/* Verified Mainnet 1Click Settlements Proof Table */}
            <div style={{ marginTop: 16, border: "1px solid var(--line2)", background: "var(--bg)", padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--lime)" }}>
                  ● Verified Live Mainnet 1Click Settlements (Solana · Base · Arbitrum · BNB Chain · Polygon)
                </span>
                <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--tx3)" }}>
                  $LENGO Utility: <a href="https://robinhoodchain.blockscout.com/token/0xc256e0fb1f93164b8e499746bba593a8e40a7eef" target="_blank" rel="noreferrer">0xc256…7eef ↗</a> ({lengo.lengoBal.toLocaleString("en-US", { maximumFractionDigits: 0 })} LENGO in wallet)
                </span>
              </div>
              <div style={{ display: "grid", gap: 6, fontFamily: "var(--mono)", fontSize: 11, color: "var(--tx2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", paddingBottom: 6, borderBottom: "1px dashed var(--line)" }}>
                  <span><b>1.00 USDG (RH 4663) → 0.806257 USDC (Solana)</b> · Status: <b className={s.ok}>SUCCESS</b></span>
                  <span style={{ display: "inline-flex", gap: 10, flexWrap: "wrap" }}>
                    <a href="https://robinhoodchain.blockscout.com/tx/0xc6684d3643a3d0378129c7b2ed80de1f44851e8ae71d4dcbb520b52016d09644" target="_blank" rel="noreferrer">RH Tx 0xc668…9644 ↗</a>
                    <a href="https://explorer.near-intents.org/transactions/0x0D650Ee3D0961B376a9b90fB12e5fE0BD9D46283" target="_blank" rel="noreferrer">1Click 0x0D65…6283 ↗</a>
                    <a href="https://solscan.io/tx/PWUk1xC3DdzyGvPZu9rVviDkj1EpNapzftXxjWPWwpfdFf6PyRMAWkmZqWbp8oCgk4jhuJFDgqz8pRzZV77RUwV" target="_blank" rel="noreferrer">Solana Tx PWUk1x…7RUwV ↗</a>
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", paddingBottom: 6, borderBottom: "1px dashed var(--line)" }}>
                  <span><b>0.30 USDG (RH 4663) → 0.296513 USDC (Base)</b> · Status: <b className={s.ok}>SUCCESS</b></span>
                  <span style={{ display: "inline-flex", gap: 10, flexWrap: "wrap" }}>
                    <a href="https://robinhoodchain.blockscout.com/tx/0xa484f312f7419d09f0d64fd85bcaff29394ed072d53603c510f2d523cf77a7f0" target="_blank" rel="noreferrer">RH Tx 0xa484…a7f0 ↗</a>
                    <a href="https://explorer.near-intents.org/transactions/0x0cC24E339540688717D23c86fE2783e3DD7C2E3d" target="_blank" rel="noreferrer">1Click 0x0cC2…2E3d ↗</a>
                    <a href="https://basescan.org/tx/0x7e4f2eb4a67b2e083993793c4154ce34a23781d6f03e1b866b5e3e78b4c2cd0d" target="_blank" rel="noreferrer">Base Tx 0x7e4f…cd0d ↗</a>
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", paddingBottom: 6, borderBottom: "1px dashed var(--line)" }}>
                  <span><b>0.15 USDG (RH 4663) → 0.1443 USDC (Arbitrum)</b> · Status: <b className={s.ok}>SUCCESS</b></span>
                  <span style={{ display: "inline-flex", gap: 10, flexWrap: "wrap" }}>
                    <a href="https://robinhoodchain.blockscout.com/tx/0x832a5e0007347a459b47a1ab56a3dfdb0f9712d09a5802a4d7ef2d1c4118ade9" target="_blank" rel="noreferrer">RH Tx 0x832a…ade9 ↗</a>
                    <a href="https://explorer.near-intents.org/transactions/0xD1c6F77F9c2E22A9B3Cf77972d7B2d20e926f669" target="_blank" rel="noreferrer">1Click 0xD1c6…f669 ↗</a>
                    <a href="https://arbiscan.io/tx/0xab62778d215835734109129fde86f2dc9f0e2ce43259cddd27f320ab175a5ba9" target="_blank" rel="noreferrer">Arbitrum Tx 0xab62…5ba9 ↗</a>
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", paddingBottom: 6, borderBottom: "1px dashed var(--line)" }}>
                  <span><b>0.15 USDG (RH 4663) → 0.1396 USDT (BNB Chain)</b> · Status: <b className={s.ok}>SUCCESS</b></span>
                  <span style={{ display: "inline-flex", gap: 10, flexWrap: "wrap" }}>
                    <a href="https://robinhoodchain.blockscout.com/tx/0x879485a80206d2a005e312d9bfb1ff3257ad40261548f7b146abf0d06abb01fd" target="_blank" rel="noreferrer">RH Tx 0x8794…01fd ↗</a>
                    <a href="https://explorer.near-intents.org/transactions/0x581D10cae02143f5051259C350BC55b8083302c5" target="_blank" rel="noreferrer">1Click 0x581D…02c5 ↗</a>
                    <a href="https://bscscan.com/tx/0xb13b8b8d07fa0e4b8c294b184d4bea4771aec0b28025d9be781d385f85b299d6" target="_blank" rel="noreferrer">BNB Tx 0xb13b…99d6 ↗</a>
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", paddingBottom: 6, borderBottom: "1px dashed var(--line)" }}>
                  <span><b>0.15 USDG (RH 4663) → 0.1395 USDC (Polygon)</b> · Status: <b className={s.ok}>SUCCESS</b></span>
                  <span style={{ display: "inline-flex", gap: 10, flexWrap: "wrap" }}>
                    <a href="https://robinhoodchain.blockscout.com/tx/0x7c8e7d1659ad551de05b57b19abedb85b8aa367b237dfb0085fc61b0fc379a99" target="_blank" rel="noreferrer">RH Tx 0x7c8e…9a99 ↗</a>
                    <a href="https://explorer.near-intents.org/transactions/0x07bCda52e9A1B2C375e554F5ce8378f6564d79f6" target="_blank" rel="noreferrer">1Click 0x07bC…79f6 ↗</a>
                    <a href="https://polygonscan.com/tx/0x1c58e043f21d7e69a29b0e9342d93b7875166d1aa97b5659e7e13f1d7e7cf782" target="_blank" rel="noreferrer">Polygon Tx 0x1c58…f782 ↗</a>
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", paddingBottom: 6, borderBottom: "1px dashed var(--line)" }}>
                  <span><b>Cross-Chain Repay &amp; Collateral Exit (RH 4663)</b> · Status: <b className={s.ok}>CONFIRMED</b></span>
                  <span style={{ display: "inline-flex", gap: 10, flexWrap: "wrap" }}>
                    <a href="https://explorer.near-intents.org/transactions/Tzb8ET9kjsEBR95A4qC35FXzJsWpuaCgE9wKaoajFN9" target="_blank" rel="noreferrer">1Click Intent Tzb8ET…jFN9 ↗</a>
                    <a href="https://robinhoodchain.blockscout.com/tx/0x88a0e4bfdfa2b444d205b3f8b125afab714346d86a864451e5a36aa8e55844c8" target="_blank" rel="noreferrer">Repay Tx 0x88a0…44c8 ↗</a>
                    <a href="https://robinhoodchain.blockscout.com/tx/0x563d35bd6f8dbb8e56c1029e04dda04f164b2ba1bdd893e216d22195b6aab41f" target="_blank" rel="noreferrer">Withdraw WETH Tx 0x563d…b41f ↗</a>
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <span><b>Cross-Chain Community Pool Supply (0.25 + 0.13 USDG → WETH/USDG)</b> · Status: <b className={s.ok}>CONFIRMED</b></span>
                  <span style={{ display: "inline-flex", gap: 10, flexWrap: "wrap" }}>
                    <a href="https://robinhoodchain.blockscout.com/tx/0xcf2e76b91b2d4cc024616ce3accaecba8743ccc4ef022aff40c9639ec4e25c85" target="_blank" rel="noreferrer">Supply #1 0xcf2e…5c85 ↗</a>
                    <a href="https://robinhoodchain.blockscout.com/tx/0x970c967609fa3983467ebd3e781126dee2dadfa380151f266d219227a931a046" target="_blank" rel="noreferrer">Supply #2 0x970c…a046 ↗</a>
                    <a href="https://robinhoodchain.blockscout.com/tx/0x04723328d50ba9902b87d03833a14a31bb29f8758d18c302c237ae5e16990112" target="_blank" rel="noreferrer">Approve 0x0472…0112 ↗</a>
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className={s.footLine}>GET /v0/tokens · POST /v0/quote · POST /v0/deposit/submit · GET /v0/status</div>
        </section>

        <aside className={s.action}>
          <div className={s.mode}>
            <button
              className={!execMode ? s.mOn : ""}
              onClick={() => {
                setExecMode(false);
                setSwapStatus(null);
                setSwapDetails(null);
                setDepositTx(null);
                setQ((prev) => (prev ? { ...prev, depositAddress: undefined, dry: true } : null));
              }}
            >
              ⇄ Preview
            </button>
            <button
              className={execMode ? s.mOn : ""}
              onClick={() => {
                setExecMode(true);
                setSwapStatus(null);
                setSwapDetails(null);
              }}
            >
              ◈ Live
            </button>
          </div>
          <div key={`${preset.id}:${execMode}`} className={`${s.aBody} pane-swap`} style={{ padding: "18px 20px", gap: 11 }}>
            <span className={s.k}>{execMode ? "Live execution · real funds" : "Preview · auto-quoted market rate"}</span>
            <h3 style={{ fontSize: 23 }}>{preset.label}</h3>

            {/* Origin Field */}
            <div className={s.field} style={{ padding: "11px 14px" }}>
              <div className={s.fTop}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  You send ·{" "}
                  {preset.originChains.length > 1 ? (
                    <select
                      value={fromChain}
                      onChange={(e) => {
                        setFromChain(e.target.value);
                        resetQuoteOnly();
                      }}
                      aria-label="Origin chain"
                      className={r.sel}
                    >
                      {preset.originChains.map((c) => (
                        <option key={c} value={c}>{CHAIN_META[c]?.short ?? c}</option>
                      ))}
                    </select>
                  ) : (
                    <b style={{ color: "var(--tx)", fontWeight: 500 }}>{CHAIN_META[fromChain]?.short ?? fromChain}</b>
                  )}
                </span>
                <span>
                  {preset.id === "repay" && rhPosDebt > 0 ? (
                    <button
                      type="button"
                      className={s.inlineBtn}
                      onClick={() => {
                        setAmt((rhPosDebt * 1.02 + 0.25).toFixed(2));
                        resetQuoteOnly();
                      }}
                    >
                      Debt ${rhPosDebt.toFixed(2)} + fee
                    </button>
                  ) : evmBalQuery.isLoading && isConnected ? (
                    <span className="skel skel-xs" />
                  ) : originBal !== null && isConnected ? (
                    `Bal ${originBal.toFixed(originDec === 6 ? 2 : 4)} ${fromAsset}`
                  ) : execMode ? (
                    "Exact input"
                  ) : (
                    "Auto-quote"
                  )}
                </span>
              </div>
              <div className={s.fRow} style={{ marginTop: 7 }}>
                <input
                  inputMode="decimal"
                  value={amt}
                  aria-label="Amount in"
                  style={{ fontSize: 22 }}
                  onChange={(e) => {
                    setAmt(e.target.value.replace(/[^0-9.]/g, ""));
                    resetQuoteOnly();
                  }}
                />
                {originBal !== null && isConnected && originBal > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const f = 10 ** Math.min(originDec, 6);
                      setAmt(String(Math.floor((originBal + 1e-12) * f) / f));
                      resetQuoteOnly();
                    }}
                  >
                    Max
                  </button>
                )}
                <span className={s.tok} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <TokenIcon sym={fromAsset} size={14} />
                  {fromAsset}
                </span>
              </div>
              {preset.originAssets.length > 1 && (
                <div className={r.fieldPills}>
                  {preset.originAssets.map((sym) => {
                    const ok = !toks || !!findTok(sym, fromChain);
                    return (
                      <button
                        key={sym}
                        type="button"
                        disabled={!ok}
                        className={`${r.pill} ${fromAsset === sym ? r.pillOn : ""}`}
                        onClick={() => {
                          setFromAsset(sym);
                          resetQuoteOnly();
                        }}
                      >
                        <TokenIcon sym={sym} size={13} />
                        {sym}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className={r.swap}>↓</div>

            {/* Destination Field */}
            <div className={s.field} style={{ padding: "11px 14px" }}>
              <div className={s.fTop}>
                <span>You receive ({execMode ? "live" : "quote"})</span>
                {preset.destChains.length > 1 ? (
                  <select
                    value={toChain}
                    onChange={(e) => {
                      setToChain(e.target.value);
                      resetQuoteOnly();
                    }}
                    aria-label="Destination chain"
                    className={r.sel}
                  >
                    {preset.destChains.map((d) => {
                      const hasAny = !toks || preset.destAssets.some((sym) => !!findTok(sym, d));
                      return (
                        <option key={d} value={d} disabled={!hasAny}>
                          {d}{!hasAny ? " · n/a" : ""}
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <b style={{ color: "var(--tx)", fontWeight: 500 }}>{CHAIN_META[toChain]?.short ?? toChain}</b>
                )}
              </div>
              <div className={s.fRow} style={{ marginTop: 7 }}>
                {state === "loading" ? (
                  <div style={{ flex: 1, padding: "4px 0" }}><span className="skel skel-lg" /></div>
                ) : (
                  <input value={state === "ok" ? q?.amountOut ?? "—" : "—"} readOnly aria-label="Amount out" style={{ fontSize: 22 }} />
                )}
                <span className={s.tok} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <TokenIcon sym={toAsset} size={14} />
                  {toAsset}
                </span>
              </div>
              {preset.destAssets.length > 1 && (
                <div className={r.fieldPills}>
                  {preset.destAssets.map((sym) => {
                    const ok = !toks || !!findTok(sym, toChain);
                    return (
                      <button
                        key={sym}
                        type="button"
                        disabled={!ok}
                        className={`${r.pill} ${toAsset === sym ? r.pillOn : ""}`}
                        onClick={() => {
                          setToAsset(sym);
                          resetQuoteOnly();
                        }}
                      >
                        <TokenIcon sym={sym} size={13} />
                        {sym}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <label className={s.field} style={{ padding: "11px 14px" }}>
              <div className={s.fTop}><span>Recipient · {CHAIN_META[toChain]?.short ?? toChain}</span><span>{execMode ? "required (live)" : "optional"}</span></div>
              <input className={r.addr} placeholder={execMode ? `Your ${toChain} address` : `Optional (${toChain} preview)`} value={recipient} onChange={(e) => setRecipient(e.target.value)} />
            </label>
            <label className={s.field} style={{ padding: "11px 14px" }}>
              <div className={s.fTop}><span>Refund · {CHAIN_META[fromChain]?.short ?? fromChain}</span><span>{execMode ? "required (live)" : "optional"}</span></div>
              <input className={r.addr} placeholder={execMode ? `Your ${fromChain} address` : `Optional (${fromChain} preview)`} value={refundTo} onChange={(e) => setRefundTo(e.target.value)} />
            </label>
            <div className={s.sim} style={{ padding: "2px 0", gap: 6 }}>
              <div><span>Slippage limit</span><b>0.5%</b></div>
              <div><span>Mode</span><b>{execMode ? "Live" : "Preview"}</b></div>
            </div>
            {overOriginBal && originBal !== null && (
              <p className={`${s.note} ${s.warn}`}>
                Input exceeds your {CHAIN_META[fromChain]?.short ?? fromChain} balance ({originBal.toFixed(originDec === 6 ? 2 : 4)} {fromAsset}) — lower the amount to send directly from wallet.
              </p>
            )}
            {state === "unavailable" && <p className={`${s.note} ${s.warn}`}>{q?.reason ?? "Unavailable"}.</p>}
            <button className={s.cta} style={{ padding: 15 }} disabled={state === "loading" || !parseFloat(amt) || !origin || !destTok} onClick={() => requestQuote(execMode)}>
              {state === "loading"
                ? "Requesting…"
                : !toks
                  ? "Loading catalog…"
                  : !origin || !destTok
                    ? `${fromAsset} → ${toAsset} not on ${toChain}`
                    : execMode
                      ? q?.depositAddress
                        ? expired
                          ? "Refresh deposit address"
                          : "Refresh live quote"
                        : "Get live deposit address"
                      : "Refresh quote"}
            </button>
            <p className={s.note}>{execMode ? "Issues a dedicated 1Click deposit address & tracks live settlement" : "Auto-updates live market estimate · zero funds moved"}</p>
          </div>
        </aside>
      </div>

      {lengoTx.steps && (
        <div className={s.modalWrap} role="dialog" aria-modal="true" aria-label="LengoMarket Transaction">
          <div className={`${s.modal} bevel`}>
            <span className={s.k}>LengoMarket · {targetMarketSpec.pair} · Robinhood Chain</span>
            <h3>Confirm Onchain Step</h3>
            <div className={s.steps}>
              {lengoTx.steps.map((st, i) => (
                <div key={i} className={st.state === "done" ? s.sDone : st.state === "sign" || st.state === "pending" ? s.sNow : ""} style={st.state === "failed" ? { color: "var(--red)" } : undefined}>
                  <i>{st.state === "done" ? "✓" : st.state === "failed" ? "×" : i + 1}</i>{st.label}
                  {st.hash && <a href={txUrl(st.hash, "mainnet")} target="_blank" rel="noreferrer" style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 10, color: "var(--tx2)" }}>tx ↗</a>}
                </div>
              ))}
            </div>
            <div className={s.mBtns}><button className="btn btn-primary" autoFocus disabled={lengoTx.busy} onClick={lengoTx.close}>{lengoTx.busy ? "Working…" : "Close"}</button></div>
          </div>
        </div>
      )}
    </>
  );
}

export default function Routes() {
  return (
    <Suspense fallback={<div style={{ padding: 32, fontFamily: "var(--mono)", fontSize: 12, color: "var(--tx3)" }}>Loading cross-chain router…</div>}>
      <RoutesInner />
    </Suspense>
  );
}
