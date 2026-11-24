"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { injected } from "wagmi/connectors";
import { DEPLOYMENTS, type NetworkMode } from "@/lib/chain";
import { useNetwork } from "@/lib/useNetwork";
import { ensureWalletChain } from "@/lib/walletChain";
import s from "./app/app.module.css";

const baseNav = [
  { href: "/app", label: "Markets" },
  { href: "/app/routes", label: "Routes" },
  { href: "/app/activity", label: "Activity" },
  { href: "/faucet", label: "Faucet", testnetOnly: true },
  { href: "/docs", label: "Docs" },
];

export default function TopNav() {
  const path = usePathname();
  const net = useNetwork();
  const { address, isConnected, chainId, connector } = useAccount();
  const { connectAsync, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const [mounted, setMounted] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const autoAttemptedRef = useRef<string>("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  // AUTO-SWITCH DEFAULT TO RH TESTNET (46630) whenever a wallet is connected on a different chain!
  useEffect(() => {
    if (!mounted || !isConnected || !address) return;
    if (chainId === net.chain.id) return;
    const key = `${address.toLowerCase()}:${net.chain.id}`;
    if (autoAttemptedRef.current === key) return;
    autoAttemptedRef.current = key;

    let cancelled = false;
    setSwitching(true);
    ensureWalletChain(net.chain, connector, switchChainAsync).finally(() => {
      if (!cancelled) setSwitching(false);
    });
    return () => {
      cancelled = true;
    };
  }, [mounted, isConnected, address, chainId, net.chain, connector, switchChainAsync]);

  const wrong = mounted && isConnected && chainId !== net.chain.id;
  const short = address ? address.slice(0, 6) + "…" + address.slice(-4) : null;
  const label = !mounted
    ? "Connect"
    : isConnected
      ? short
      : isPending
        ? "Connecting…"
        : error
          ? "No wallet found"
          : "Connect";

  const nav = baseNav.filter((n) => !n.testnetOnly || net.mode === "testnet");
  const chainTitle = net.mode === "mainnet" ? "RH Mainnet" : "RH Testnet";

  async function onConnectClick() {
    if (isConnected) {
      autoAttemptedRef.current = "";
      disconnect();
      return;
    }
    try {
      const res = await connectAsync({ connector: injected(), chainId: net.chain.id });
      if (res.chainId !== net.chain.id) {
        setSwitching(true);
        await ensureWalletChain(net.chain, undefined, switchChainAsync);
      }
    } catch {
      /* user cancelled or wallet unavailable */
    } finally {
      setSwitching(false);
    }
  }

  async function onPickNetwork(nextMode: NetworkMode) {
    setMenuOpen(false);
    net.setMode(nextMode);
    const target = DEPLOYMENTS[nextMode].chain;
    if (isConnected) {
      autoAttemptedRef.current = `${(address ?? "").toLowerCase()}:${target.id}`;
      setSwitching(true);
      await ensureWalletChain(target, connector, switchChainAsync);
      setSwitching(false);
    }
  }

  async function onChainButtonClick() {
    // If wallet is connected on the wrong chain, immediately switch it to the active network (RH Testnet by default)
    if (wrong && !switching) {
      setSwitching(true);
      const ok = await ensureWalletChain(net.chain, connector, switchChainAsync);
      setSwitching(false);
      if (ok) return;
    }
    setMenuOpen((o) => !o);
  }

  return (
    <header className={s.top}>
      <Link href="/" className={s.brand}>
        <Image src="/logo-mark.png" alt="" width={24} height={24} /> LENGO
      </Link>
      <nav className={s.nav}>
        {nav.map((n) => (
          <Link key={n.label} href={n.href} className={path === n.href ? s.on : ""} aria-current={path === n.href ? "page" : undefined}>
            {n.label}
          </Link>
        ))}
      </nav>
      <div className={s.right}>
        <a className={s.social} href="https://x.com/lengoapp" target="_blank" rel="noreferrer" aria-label="Lengo on X" title="@lengoapp on X">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M18.9 2H22l-7.6 8.7L23.3 22h-7l-5.5-7.2L4.5 22H1.4l8.1-9.3L1 2h7.2l5 6.6L18.9 2Zm-1.1 18h1.7L7.3 3.9H5.5L17.8 20Z" />
          </svg>
        </a>
        <div className={s.chainWrap} ref={menuRef}>
          <button
            type="button"
            className={`${s.chain} ${wrong ? s.wrong : ""}`}
            title={`${net.chain.name} · ${net.chain.id}`}
            onClick={onChainButtonClick}
          >
            <span className={s.chainIco}>
              <Image src="/logo-mark.png" alt="" width={16} height={16} />
            </span>
            <span>{switching ? `Switching to ${chainTitle}…` : wrong ? `Switch to ${chainTitle}` : chainTitle}</span> <i>▾</i>
          </button>
          {menuOpen && (
            <div className={s.chainMenu} role="menu">
              <button
                type="button"
                role="menuitem"
                className={`${s.chainOpt} ${net.mode === "mainnet" ? s.chainOptOn : ""}`}
                onClick={() => onPickNetwork("mainnet")}
              >
                <span>● RH Mainnet <small>(Live)</small></span>
                <small>4663</small>
              </button>
              <button
                type="button"
                role="menuitem"
                className={`${s.chainOpt} ${net.mode === "testnet" ? s.chainOptOn : ""}`}
                onClick={() => onPickNetwork("testnet")}
              >
                <span>● RH Testnet</span>
                <small>46630</small>
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          className={`${s.connect} ${mounted && isConnected ? s.connected : ""}`}
          title={isConnected ? "Disconnect" : `Connect wallet (${chainTitle})`}
          onClick={onConnectClick}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="3" y="6" width="18" height="13" rx="1" />
            <path d="M3 10h18M16 14.5h2" />
          </svg>
          {label}
        </button>
      </div>
    </header>
  );
}
