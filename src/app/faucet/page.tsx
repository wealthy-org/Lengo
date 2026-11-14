"use client";
import { Pair } from "../TokenIcon";
import { useState } from "react";
import { formatUnits, type Address } from "viem";
import { useAccount, useReadContracts, useWriteContract, usePublicClient } from "wagmi";
import s from "../app/trade.module.css";
import f from "./faucet.module.css";
import { tokenAbi } from "@/lib/abi";
import { deployment, isDeployed, rhTestnet, txUrl, addrUrl } from "@/lib/chain";
import { useToast } from "../Toaster";

const tokens = [
  { sym: "tBTC", name: "Lengo Test BTC (no value)", dec: 8, addr: deployment.tBTC, c: "#f2a93b", t: "₿", note: "Collateral. No Bitcoin backing." },
  { sym: "tUSDC", name: "Lengo Test USDC (no value)", dec: 6, addr: deployment.tUSDC, c: "#7fb6f2", t: "$", note: "Debt asset. Not Circle USDC." },
];

export default function Faucet() {
  const { address, isConnected, chainId } = useAccount();
  const live = isDeployed && isConnected && chainId === rhTestnet.id && !!address;
  const acct = (address ?? "0x0000000000000000000000000000000000000000") as Address;
  const reads = useReadContracts({
    query: { enabled: live },
    contracts: tokens.flatMap((t) => [
      { address: t.addr!, abi: tokenAbi, functionName: "balanceOf", args: [acct] },
      { address: t.addr!, abi: tokenAbi, functionName: "faucetAmount" },
      { address: t.addr!, abi: tokenAbi, functionName: "lastMint", args: [acct] },
      { address: t.addr!, abi: tokenAbi, functionName: "faucetCooldown" },
    ] as const),
  });
  const { writeContractAsync } = useWriteContract();
  const client = usePublicClient({ chainId: rhTestnet.id });
  const [st, setSt] = useState<Record<string, { msg: string; hash?: string }>>({});
  const toast = useToast();

  async function mint(i: number) {
    const t = tokens[i];
    try {
      setSt((x) => ({ ...x, [t.sym]: { msg: "Confirm in wallet" } }));
      const h = await writeContractAsync({ address: t.addr!, abi: tokenAbi, functionName: "faucet", chainId: rhTestnet.id });
      setSt((x) => ({ ...x, [t.sym]: { msg: "Pending onchain", hash: h } }));
      const rc = await client!.waitForTransactionReceipt({ hash: h });
      setSt((x) => ({ ...x, [t.sym]: { msg: rc.status === "success" ? "Minted" : "Reverted", hash: h } }));
      toast.push(rc.status === "success" ? { kind: "ok", title: `${t.sym} minted`, detail: "Testnet demo asset · no value", hash: h } : { kind: "err", title: `${t.sym} mint reverted`, hash: h });
      reads.refetch();
    } catch (e) {
      const m = (e as Error).message;
      const label = /rejected|denied/i.test(m) ? "Rejected in wallet" : /Cooldown/i.test(m) ? "Cooldown active" : "Failed";
      setSt((x) => ({ ...x, [t.sym]: { msg: label } }));
      toast.push({ kind: "err", title: `${t.sym}: ${label}` });
    }
  }

  return (
    <>
      <div className={s.pageHead}>
        <div><h1>Faucet</h1><p>Mint demo assets on Robinhood Chain Testnet. They have no value and cannot leave testnet.</p></div>
        <span>Limit · one mint per token per 24h per wallet</span>
      </div>
      <div className={f.grid}>
        {tokens.map((t, i) => {
          const r = reads.data;
          const bal = live ? r?.[i * 4]?.result as bigint | undefined : undefined;
          const amt = live ? r?.[i * 4 + 1]?.result as bigint | undefined : undefined;
          const last = Number((live ? r?.[i * 4 + 2]?.result as bigint | undefined : 0n) ?? 0n);
          const cd = Number((live ? r?.[i * 4 + 3]?.result as bigint | undefined : 0n) ?? 0n);
          const next = last ? last + cd : 0;
          const wait = next > Date.now() / 1000;
          const x = st[t.sym];
          return (
            <section key={t.sym} className={`${f.card} bevel`}>
              <div className={f.head}>
                <Pair a={t.sym} size={42} />
                <div><h2>{t.sym}</h2><p>{t.name}</p></div>
                <span className={f.tag}>{t.dec} decimals</span>
              </div>
              <div className={f.rows}>
                <div><span>Your balance</span><b>{bal !== undefined ? Number(formatUnits(bal, t.dec)).toLocaleString("en-US", { maximumFractionDigits: t.dec }) : "—"}</b></div>
                <div><span>Per mint</span><b>{amt !== undefined ? formatUnits(amt, t.dec) : "—"}</b></div>
                <div><span>Next mint</span><b>{!live ? "—" : wait ? new Date(next * 1000).toLocaleString() : "Available"}</b></div>
                <div><span>Contract</span><b>{t.addr ? <a href={addrUrl(t.addr)} target="_blank" rel="noreferrer">{t.addr.slice(0, 8)}…{t.addr.slice(-6)} ↗</a> : "Not deployed"}</b></div>
              </div>
              <p className={f.note}>{t.note}</p>
              <button className={s.cta} disabled={!live || wait || x?.msg === "Confirm in wallet" || x?.msg === "Pending onchain"} onClick={() => mint(i)}>
                {!isDeployed ? "Contracts not deployed yet" : !isConnected ? "Connect wallet" : chainId !== rhTestnet.id ? "Switch to RH Testnet" : wait ? "Cooldown active" : `Mint ${t.sym}`}
              </button>
              {x && <p className={f.status}>{x.msg}{x.hash && <> · <a href={txUrl(x.hash)} target="_blank" rel="noreferrer">tx ↗</a></>}</p>}
            </section>
          );
        })}
        <section className={`${f.card} ${f.gas} bevel`}>
          <span className={s.k}>Gas · testnet ETH</span>
          <h2>You need a little testnet ETH for gas</h2>
          <ol>
            <li>Add Robinhood Chain Testnet to your wallet: chain ID <b>46630</b>, RPC <code>rpc.testnet.chain.robinhood.com</code>. The network button in the header does this for you.</li>
            <li>Get testnet ETH from the faucet listed in the official Robinhood Chain docs. We only link sources we have verified.</li>
            <li>Still empty? Ask the Lengo team for a small gas drip on testnet.</li>
          </ol>
          <a className="btn" href="https://docs.robinhood.com/chain/connecting/" target="_blank" rel="noreferrer">RH Chain docs ↗</a>
        </section>
      </div>
    </>
  );
}
