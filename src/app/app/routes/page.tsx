"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Pair } from "../../TokenIcon";
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

const CHAIN_META: Record<string, { key: string; evmChain?: Chain; explorerTx: string }> = {
  "Robinhood (hood)": { key: "hood", evmChain: rhMainnet, explorerTx: "https://robinhoodchain.blockscout.com/tx/" },
  Solana: { key: "sol", explorerTx: "https://solscan.io/tx/" },
  Base: { key: "base", evmChain: base, explorerTx: "https://basescan.org/tx/" },
  Arbitrum: { key: "arb", evmChain: arbitrum, explorerTx: "https://arbiscan.io/tx/" },
  Ethereum: { key: "eth", evmChain: mainnet, explorerTx: "https://etherscan.io/tx/" },
  Optimism: { key: "op", evmChain: optimism, explorerTx: "https://optimistic.etherscan.io/tx/" },
  Polygon: { key: "pol", evmChain: polygon, explorerTx: "https://polygonscan.com/tx/" },
  "BNB Chain": { key: "bsc", evmChain: bsc, explorerTx: "https://bscscan.com/tx/" },
  Avalanche: { key: "avax", evmChain: avalanche, explorerTx: "https://snowtrace.io/tx/" },
  NEAR: { key: "near", explorerTx: "https://nearblocks.io/txns/" },
  TON: { key: "ton", explorerTx: "https://tonviewer.com/transaction/" },
  TRON: { key: "tron", explorerTx: "https://tronscan.org/#/transaction/" },
  Sui: { key: "sui", explorerTx: "https://suiscan.xyz/mainnet/tx/" },
  Aptos: { key: "aptos", explorerTx: "https://explorer.aptoslabs.com/txn/" },
  Stellar: { key: "stellar", explorerTx: "https://stellar.expert/explorer/public/tx/" },
  Bitcoin: { key: "btc", explorerTx: "https://mempool.space/tx/" },
  Zcash: { key: "zec", explorerTx: "https://blockchair.com/zcash/transaction/" },
};

const isEvmLabel = (label: string) => Boolean(CHAIN_META[label]?.evmChain);

type PresetKind = {
  id: "payout" | "collateral" | "repay" | "swap";
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
    label: "Borrow payout",
    sub: "USDG hood → multi-chain stable",
    originChains: ["Robinhood (hood)"],
    originAssets: ["USDG"],
    destChains: ["Solana", "Base", "Arbitrum", "Ethereum", "Optimism", "Polygon", "BNB Chain", "Avalanche", "NEAR", "TON", "TRON", "Sui", "Aptos", "Stellar"],
    destAssets: ["USDC", "USDT", "DAI"],
    defaultFromChain: "Robinhood (hood)",
    defaultFromAsset: "USDG",
    defaultToChain: "Solana",
    defaultToAsset: "USDC",
    defaultAmt: "10",
    note: "Route borrowed USDG on Robinhood Chain into USDC, USDT, or DAI across 14+ destination chains via NEAR Intents 1Click.",
    steps: ["Borrow USDG on Robinhood Chain", "Pick target chain & stablecoin", "Send USDG to 1Click", "Receive USDC / USDT on destination chain"],
  },
  {
    id: "collateral",
    label: "Cross-chain collateral",
    sub: "Any chain → WETH / USDe on RH",
    originChains: ["Solana", "Base", "Arbitrum", "Ethereum", "Optimism", "Polygon", "BNB Chain", "Avalanche", "Bitcoin"],
    originAssets: ["SOL", "USDC", "USDT", "ETH", "BTC"],
    destChains: ["Robinhood (hood)"],
    destAssets: ["WETH", "USDe"],
    defaultFromChain: "Base",
    defaultFromAsset: "USDC",
    defaultToChain: "Robinhood (hood)",
    defaultToAsset: "WETH",
    defaultAmt: "25",
    note: "Deposit assets from another chain via NEAR Intents 1Click into WETH or USDe on Robinhood Chain, then lock directly into LengoMarket as collateral.",
    steps: ["Choose origin chain & asset", "Route into WETH on Robinhood Chain", "Lock WETH collateral in LengoMarket", "Both origin & LengoMarket txs recorded"],
  },
  {
    id: "repay",
    label: "Cross-chain repay",
    sub: "Any stablecoin → repay USDG debt",
    originChains: ["Solana", "Base", "Arbitrum", "Polygon", "Optimism", "Ethereum", "BNB Chain", "Avalanche", "TRON", "TON", "NEAR"],
    originAssets: ["USDC", "USDT", "DAI", "SOL", "ETH"],
    destChains: ["Robinhood (hood)"],
    destAssets: ["USDG"],
    defaultFromChain: "Solana",
    defaultFromAsset: "USDC",
    defaultToChain: "Robinhood (hood)",
    defaultToAsset: "USDG",
    defaultAmt: "5",
    note: "Repay your USDG debt on Robinhood Chain using USDC or USDT from any chain via NEAR Intents 1Click, then unlock & withdraw your collateral.",
    steps: ["Route external USDC / USDT → USDG on RH", "1Click settles USDG to your RH wallet", "Execute Repay All on LengoMarket", "Withdraw unlocked collateral"],
  },
  {
    id: "swap",
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
    steps: ["Request 1Click swap quote", "Send BTC / ZEC to deposit address", "Solver settles on NEAR Intents", "Receive stablecoin on target chain"],
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

  const [execMode, setExecMode] = useState(false); // false = Preview, true = Live
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
  const [sending, setSending] = useState(false);
  const [copiedDep, setCopiedDep] = useState(false);
  const [now, setNow] = useState(Date.now());
  const reqId = useRef(0);

  // Target LengoMarket for Update 1 (Cross-chain Collateral) & Update 4 (Cross-chain Repay)
  const targetMarketSpec = useMemo(() => {
    if (preset.id === "collateral" && toAsset === "USDe") {
      return MAINNET_MARKETS.find((m) => m.id === "USDe") ?? MAINNET_MARKETS[0];
    }
    return MAINNET_MARKETS[0]; // WETH / USDG primary live market
  }, [preset.id, toAsset]);

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
    if (mParam === "live") setExecMode(true);
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

  // Auto-align asset selection when switching chain so user never lands on an unsupported pair when another valid asset exists
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

  const origin = findTok(fromAsset, fromChain);
  const destTok = findTok(toAsset, toChain);
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

  async function getQuote() {
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
          execute: execMode,
        }),
      });
      const j: Quote = await res.json();
      if (id !== reqId.current) return;
      setQ(j);
      setState(j.status === "ok" ? "ok" : "unavailable");
      if (j.status === "ok" && execMode && j.depositAddress) {
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

  // LengoMarket live balances on Robinhood Chain for Step-2 Guided Actions (Updates 1 & 4)
  const rhCollWallet = lengo.data?.collBal ?? 0;
  const rhUsdgWallet = lengo.data?.debtBal ?? 0;
  const rhPosColl = lengo.data?.coll ?? 0;
  const rhPosDebt = lengo.data?.debt ?? 0;
  const settledOutAmt = Number(swapDetails?.amountOutFormatted || q?.amountOut || "0");
  const depositReadyAmt = Math.min(rhCollWallet, settledOutAmt > 0 ? settledOutAmt : rhCollWallet);

  return (
    <>
      <div className={s.pageHead}>
        <div>
          <h1>Routes</h1>
          <p>
            Cross-chain collateral inflow, multi-chain stablecoin payouts, and any-chain debt repayment via NEAR Intents 1Click.
          </p>
        </div>
        <span>{execMode ? "Live Mode · dedicated deposit address" : "Preview Mode · no funds moved"}</span>
      </div>

      <div className={`${s.frame} bevel`}>
        <aside className={s.list}>
          <div className={s.listHead}><span>Route flows</span><b>{PRESETS.length}</b></div>
          <div style={{ height: 14 }} />
          {PRESETS.map((x) => (
            <button key={x.id} className={`${s.mkt} ${preset.id === x.id ? s.mktOn : ""}`} onClick={() => applyPreset(x)}>
              <Pair a={x.defaultFromAsset} b={x.defaultToAsset} />
              <span><b>{x.label}</b><small>{x.sub}</small></span>
            </button>
          ))}
          <div className={r.journey}>
            <span className={s.k}>{preset.label} flow</span>
            <em>Preview &amp; Live Settlement</em>
            {preset.steps.map((t, i) => <div key={t}><i>{i + 1}</i>{t}</div>)}
          </div>
        </aside>

        <section key={preset.id} className={`${s.center} pane-swap`}>
          <div className={s.mHead}>
            <Pair a={fromAsset} b={toAsset} size={42} />
            <div><h2>{fromAsset} → {toAsset}</h2><p>{fromChain} → {toChain}</p></div>
            <div className={s.badges}>
              <span className={execMode ? s.active : ""}>{execMode ? "Live" : "Preview"}</span>
              <span>{execMode ? "Executable" : "Read-only"}</span>
            </div>
          </div>
          <div className={s.stats} style={{ gridTemplateColumns: "repeat(5,1fr)" }}>
            <div><span>Provider</span><b>1Click</b></div>
            <div><span>Origin</span><b>{fromAsset} · {fromChain.split(" ")[0]}</b></div>
            <div><span>Destination</span><b>{toAsset} · {toChain.split(" ")[0]}</b></div>
            <div><span>Slippage</span><b>0.50%</b></div>
            <div>
              <span>Status</span>
              <b className={state === "unavailable" || expired || swapStatus === "FAILED" ? s.warn : state === "ok" ? s.ok : ""}>
                {state === "loading" ? <span className="skel skel-sm" /> : swapStatus ? fmtSwapStatus(swapStatus) : state === "idle" ? "Not requested" : state === "ok" ? (expired ? "Expired" : "Quote valid") : "Unavailable"}
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
            <span className={execMode && q?.depositAddress ? s.ok : s.amberT}>
              {execMode && q?.depositAddress ? `Deposit ${q.depositAddress.slice(0, 8)}…${q.depositAddress.slice(-6)}` : "Preview mode (no deposit address)"}
            </span>
          </div>

          <div className={s.viewBody}>
            <div className={r.route}>
              <div className={r.node}><span>From</span><b>{amt || "0"} {fromAsset}</b><small>{fromChain}</small></div>
              <div className={r.wire}><i /><em>NEAR Intents · 1Click</em></div>
              <div className={r.node}><span>Solver network</span><b>{execMode ? (swapStatus ? fmtSwapStatus(swapStatus) : "Live Intent") : "Preview"}</b><small>{execMode ? "live settlement" : "preview · no funds moved"}</small></div>
              <div className={r.wire}><i /><em>settle</em></div>
              <div className={`${r.node} ${r.dst}`}>
                <span>To</span>
                <b>{state === "loading" ? <span className="skel skel-md" /> : state === "ok" ? `${q?.amountOut} ${toAsset}` : `— ${toAsset}`}</b>
                <small>{toChain}</small>
              </div>
            </div>
            <p className={r.note}>{preset.note}</p>

            {/* Step 1: Live 1Click Deposit & Proof Box */}
            {execMode && state === "ok" && q?.depositAddress && (
              <div className={`${s.sim} bevel`} style={{ marginTop: 18, padding: 14, border: "1px solid var(--lime)" }}>
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
                        {sending ? "Sending…" : `Send ${amt} ${fromAsset} from ${fromChain.split(" ")[0]} Wallet →`}
                      </button>
                    )}
                  </div>
                </div>

                {/* Optional Origin Tx Hash submission when sending from non-EVM wallet (Phantom / Bitcoin / TronLink / Tonkeeper) */}
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
                        Origin {fromChain.split(" ")[0]} tx:{" "}
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
                        {toChain.split(" ")[0]} {toAsset} tx:{" "}
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

            {/* Update 1: Step 2 Guided Action — Lock Routed Asset as Collateral in LengoMarket */}
            {preset.id === "collateral" && isConnected && (swapStatus === "SUCCESS" || rhCollWallet > 0) && (
              <div className={`${s.sim} bevel`} style={{ marginTop: 14, padding: 14, border: "1px solid var(--line2)", background: "var(--bg)" }}>
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

            {/* Update 4: Step 2 & 3 Guided Action — Repay USDG Debt & Withdraw Collateral on LengoMarket */}
            {preset.id === "repay" && isConnected && (rhPosDebt > 0 || rhPosColl > 0) && (
              <div className={`${s.sim} bevel`} style={{ marginTop: 14, padding: 14, border: "1px solid var(--line2)", background: "var(--bg)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <span style={{ display: "block", fontSize: 10, letterSpacing: "0.08em", color: "var(--lime)" }}>
                      STEP 2 &amp; 3 · SETTLE DEBT &amp; UNLOCK COLLATERAL ON LENGOMARKET (RH 4663)
                    </span>
                    <small style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--tx2)" }}>
                      Outstanding debt: <b>${rhPosDebt.toFixed(4)} USDG</b> · RH Wallet USDG: <b>${rhUsdgWallet.toFixed(2)}</b> · Locked collateral: <b>{rhPosColl.toFixed(4)} WETH</b>
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
                        {lengoTx.busy ? "Withdrawing…" : `Withdraw All ${rhPosColl.toFixed(4)} WETH →`}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className={s.kv} style={{ marginTop: 22 }}>
              <div><span>Amount out</span><b>{state === "loading" ? <span className="skel skel-md" /> : state === "ok" ? `${q?.amountOut} ${toAsset}` : "—"}</b><small>{state === "loading" ? <span className="skel skel-xs" /> : state === "ok" ? `≈ $${Number(q?.amountOutUsd).toFixed(2)}` : "after quote"}</small></div>
              <div><span>Minimum received</span><b>{state === "loading" ? <span className="skel skel-md" /> : state === "ok" ? `${fmtOut(q?.minAmountOut)} ${toAsset}` : "—"}</b><small>0.5% slippage bound</small></div>
              <div><span>Known fees</span><b>{state === "loading" ? <span className="skel skel-sm" /> : state === "ok" ? `${(q?.fees?.appFees ?? []).reduce((a, f) => a + f.fee, 0) / 100}% app` : "—"}</b><small>{state === "loading" ? <span className="skel skel-xs" /> : state === "ok" ? `withdraw ${fmtOut(q?.fees?.withdrawFee)} ${toAsset}` : "provider + app"}</small></div>
              <div><span>Est. duration</span><b>{state === "loading" ? <span className="skel skel-sm" /> : state === "ok" && typeof q?.timeEstimate === "number" ? `~${fmtDuration(q.timeEstimate)}` : "—"}</b><small>provider estimate</small></div>
              <div><span>Quote time</span><b>{state === "loading" ? <span className="skel skel-sm" /> : state === "ok" && q?.quotedAt ? fmtQuoteClock(q.quotedAt) : "—"}</b><small>{state === "ok" && q?.quotedAt ? fmtAgo(q.quotedAt, now) : "provider timestamp"}</small></div>
              <div><span>Expiry</span><b className={expired ? s.warn : ""}>{state === "loading" ? <span className="skel skel-sm" /> : state === "ok" && q?.deadline ? (expired ? "Expired" : fmtDuration(expiryRemSec)) : "—"}</b><small>{expired ? "request a new quote" : state === "ok" && q?.deadline ? `until ${fmtQuoteClock(q.deadline)}` : "quote window"}</small></div>
            </div>
          </div>
          <div className={s.footLine}>GET /v0/tokens · POST /v0/quote · POST /v0/deposit/submit · GET /v0/status</div>
        </section>

        <aside className={s.action}>
          <div className={s.mode}>
            <button className={!execMode ? s.mOn : ""} onClick={() => { setExecMode(false); setState("idle"); setQ(null); setSwapStatus(null); setSwapDetails(null); }}>⇄ Preview</button>
            <button className={execMode ? s.mOn : ""} onClick={() => { setExecMode(true); setState("idle"); setQ(null); setSwapStatus(null); setSwapDetails(null); }}>◈ Live</button>
          </div>
          <div key={`${preset.id}:${execMode}`} className={`${s.aBody} pane-swap`}>
            <span className={s.k}>{execMode ? "Live execution · real funds" : "Preview · no funds moved"}</span>
            <h3>{preset.label}</h3>

            {/* Origin Field with Dynamic Chain + Asset Selector */}
            <div className={s.field}>
              <div className={s.fTop}>
                <span>
                  You send ·{" "}
                  {preset.originChains.length > 1 ? (
                    <select
                      value={fromChain}
                      onChange={(e) => {
                        setFromChain(e.target.value);
                        setState("idle");
                        setQ(null);
                      }}
                      aria-label="Origin chain"
                      className={r.sel}
                    >
                      {preset.originChains.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  ) : (
                    fromChain
                  )}
                </span>
                <span>
                  {preset.id === "repay" && rhPosDebt > 0 ? (
                    <button
                      type="button"
                      className={s.inlineBtn}
                      onClick={() => {
                        setAmt((rhPosDebt * 1.02 + 0.25).toFixed(2));
                        setState("idle");
                        setQ(null);
                      }}
                    >
                      Debt ${rhPosDebt.toFixed(2)} + fee
                    </button>
                  ) : originBal !== null && isConnected ? (
                    `Bal ${originBal.toFixed(originDec === 6 ? 2 : 4)} ${fromAsset}`
                  ) : execMode ? (
                    "Exact input"
                  ) : (
                    "Hypothetical"
                  )}
                </span>
              </div>
              <div className={s.fRow}>
                <input
                  inputMode="decimal"
                  value={amt}
                  aria-label="Amount in"
                  onChange={(e) => {
                    setAmt(e.target.value.replace(/[^0-9.]/g, ""));
                    setState("idle");
                    setQ(null);
                    reqId.current++;
                  }}
                />
                {originBal !== null && isConnected && originBal > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const f = 10 ** Math.min(originDec, 6);
                      setAmt(String(Math.floor((originBal + 1e-12) * f) / f));
                      setState("idle");
                      setQ(null);
                      reqId.current++;
                    }}
                  >
                    Max
                  </button>
                )}
                {preset.originAssets.length > 1 ? (
                  <select
                    value={fromAsset}
                    onChange={(e) => {
                      setFromAsset(e.target.value);
                      setState("idle");
                      setQ(null);
                    }}
                    aria-label="Origin token"
                    className={r.sel}
                    style={{ padding: "8px 10px", fontSize: 12 }}
                  >
                    {preset.originAssets.map((sym) => {
                      const ok = !toks || !!findTok(sym, fromChain);
                      return (
                        <option key={sym} value={sym} disabled={!ok}>
                          {sym}{!ok ? " (n/a)" : ""}
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <span className={s.tok}>{fromAsset}</span>
                )}
              </div>
            </div>

            <div className={r.swap}>↓</div>

            {/* Destination Field with Dynamic Chain + Stablecoin/Asset Selector */}
            <div className={s.field}>
              <div className={s.fTop}>
                <span>You receive ({execMode ? "live" : "preview"})</span>
                {preset.destChains.length > 1 ? (
                  <select
                    value={toChain}
                    onChange={(e) => {
                      setToChain(e.target.value);
                      setState("idle");
                      setQ(null);
                    }}
                    aria-label="Destination chain"
                    className={r.sel}
                  >
                    {preset.destChains.map((d) => {
                      const hasAny = !toks || preset.destAssets.some((sym) => !!findTok(sym, d));
                      return (
                        <option key={d} value={d} disabled={!hasAny}>
                          {d}{!hasAny ? " · not in catalog" : ""}
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <span>{toChain}</span>
                )}
              </div>
              <div className={s.fRow}>
                {state === "loading" ? (
                  <div style={{ flex: 1, padding: "6px 0" }}><span className="skel skel-lg" /></div>
                ) : (
                  <input value={state === "ok" ? q?.amountOut ?? "—" : "—"} readOnly aria-label="Amount out" />
                )}
                {preset.destAssets.length > 1 ? (
                  <select
                    value={toAsset}
                    onChange={(e) => {
                      setToAsset(e.target.value);
                      setState("idle");
                      setQ(null);
                    }}
                    aria-label="Destination token"
                    className={r.sel}
                    style={{ padding: "8px 10px", fontSize: 12 }}
                  >
                    {preset.destAssets.map((sym) => {
                      const ok = !toks || !!findTok(sym, toChain);
                      return (
                        <option key={sym} value={sym} disabled={!ok}>
                          {sym}{!ok ? " (n/a)" : ""}
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <span className={s.tok}>{toAsset}</span>
                )}
              </div>
            </div>

            <label className={s.field}>
              <div className={s.fTop}><span>Recipient · {toChain}</span><span>{execMode ? "required (live)" : "optional in preview"}</span></div>
              <input className={r.addr} placeholder={execMode ? `Your ${toChain} address` : `Optional (${toChain} preview)`} value={recipient} onChange={(e) => setRecipient(e.target.value)} />
            </label>
            <label className={s.field}>
              <div className={s.fTop}><span>Refund · {fromChain}</span><span>{execMode ? "required (live)" : "optional in preview"}</span></div>
              <input className={r.addr} placeholder={execMode ? `Your ${fromChain} address` : `Optional (${fromChain} preview)`} value={refundTo} onChange={(e) => setRefundTo(e.target.value)} />
            </label>
            <div className={s.sim}>
              <div><span>Slippage limit</span><b>0.5%</b></div>
              <div><span>Mode</span><b>{execMode ? "Live" : "Preview"}</b></div>
            </div>
            {overOriginBal && originBal !== null && (
              <p className={`${s.note} ${s.warn}`}>
                Input exceeds your {fromChain} balance ({originBal.toFixed(originDec === 6 ? 2 : 4)} {fromAsset}) — you can still request a deposit address or lower the amount.
              </p>
            )}
            {state === "unavailable" && <p className={`${s.note} ${s.warn}`}>{q?.reason ?? "Unavailable"}.</p>}
            <button className={s.cta} disabled={state === "loading" || !parseFloat(amt) || !origin || !destTok} onClick={getQuote}>
              {state === "loading"
                ? "Requesting…"
                : state === "ok"
                  ? expired
                    ? "Refresh quote"
                    : execMode
                      ? "Refresh live quote"
                      : "Requote"
                  : !toks
                    ? "Loading catalog…"
                    : !origin || !destTok
                      ? `${fromAsset} → ${toAsset} not on ${toChain}`
                      : execMode
                        ? "Get live deposit address"
                        : "Preview quote"}
            </button>
            <p className={s.note}>{execMode ? "Issues a dedicated 1Click deposit address & tracks live settlement" : "Market estimate · no deposit address issued"}</p>
          </div>
        </aside>
      </div>

      {/* Step Modal for Step-2 LengoMarket Deposit / Repay / Withdraw */}
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
