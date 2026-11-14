"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { injected } from "wagmi/connectors";
import { rhTestnet } from "@/lib/chain";
import s from "./app/app.module.css";

const nav = [
  { href: "/app", label: "Markets" },
  { href: "/app/routes", label: "Routes" },
  { href: "/app/activity", label: "Activity" },
  { href: "/faucet", label: "Faucet" },
  { href: "/docs", label: "Docs" },
];

export default function TopNav() {
  const path = usePathname();
  const { address, isConnected, chainId } = useAccount();
  const { connect, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const wrong = mounted && isConnected && chainId !== rhTestnet.id;
  const short = address ? address.slice(0, 6) + "…" + address.slice(-4) : null;
  const label = !mounted ? "Connect" : isConnected ? short : isPending ? "Connecting…" : error ? "No wallet found" : "Connect";
  return (
  <header className={s.top}>
      <Link href="/" className={s.brand}><Image src="/logo-mark.png" alt="" width={24} height={24} /> LENGO</Link>
      <nav className={s.nav}>
        {nav.map((n) => (
          <Link key={n.label} href={n.href} className={path === n.href ? s.on : ""} aria-current={path === n.href ? "page" : undefined}>{n.label}</Link>
        ))}
      </nav>
      <div className={s.right}>
        <button className={`${s.chain} ${wrong ? s.wrong : ""}`} title="Robinhood Chain Testnet · 46630"
          onClick={() => isConnected && switchChain({ chainId: rhTestnet.id })}>
          <span className={s.chainIco}><Image src="/logo-mark.png" alt="" width={16} height={16} /></span>
          {wrong ? "Switch to RH Testnet" : "RH Testnet"} <i>▾</i>
        </button>
        <button className={`${s.connect} ${mounted && isConnected ? s.connected : ""}`}
          title={isConnected ? "Disconnect" : "Connect an EVM wallet"}
          onClick={() => (isConnected ? disconnect() : connect({ connector: injected(), chainId: rhTestnet.id }))}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="6" width="18" height="13" rx="1"/><path d="M3 10h18M16 14.5h2"/></svg>
          {label}
        </button>
      </div>
    </header>
  );
}
