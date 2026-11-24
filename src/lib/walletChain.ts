"use client";
import type { Chain } from "viem";
import type { Connector } from "wagmi";

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function isUserRejected(err: unknown): boolean {
  const code = (err as { code?: number })?.code;
  const msg = String((err as { message?: string })?.message ?? err ?? "");
  return code === 4001 || /user rejected|user denied|rejected the request/i.test(msg);
}

async function resolveProvider(connector?: Connector): Promise<Eip1193Provider | null> {
  try {
    if (connector && typeof connector.getProvider === "function") {
      const p = (await connector.getProvider()) as Eip1193Provider | undefined;
      if (p && typeof p.request === "function") return p;
    }
  } catch {
    /* fall back to window.ethereum */
  }
  if (typeof window !== "undefined") {
    const eth = (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
    if (eth && typeof eth.request === "function") return eth;
  }
  return null;
}

/**
 * Ensures the connected wallet is switched to `targetChain` (e.g. RH Testnet 46630 by default).
 * Automatically calls `wallet_addEthereumChain` if the network is not yet configured in the wallet.
 */
export async function ensureWalletChain(
  targetChain: Chain,
  connector?: Connector,
  switchChainAsync?: (args: { chainId: number }) => Promise<unknown>
): Promise<boolean> {
  const hexChainId = `0x${targetChain.id.toString(16)}`;
  const provider = await resolveProvider(connector);

  if (provider) {
    try {
      const currentHex = (await provider.request({ method: "eth_chainId" })) as string;
      if (parseInt(currentHex, 16) === targetChain.id) return true;
    } catch {
      /* continue */
    }
  }

  // 1) Try wagmi switchChainAsync first so wagmi state updates immediately
  if (switchChainAsync) {
    try {
      await switchChainAsync({ chainId: targetChain.id });
      return true;
    } catch (err) {
      if (isUserRejected(err)) return false;
      // Fall through to explicit EIP-3085 add + switch
    }
  }

  if (!provider) return false;

  // 2) Try direct wallet_switchEthereumChain, and on ANY non-rejection error add the chain via wallet_addEthereumChain
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: hexChainId }],
    });
    return true;
  } catch (switchErr) {
    if (isUserRejected(switchErr)) return false;
    try {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: hexChainId,
            chainName: targetChain.name,
            nativeCurrency: targetChain.nativeCurrency,
            rpcUrls: targetChain.rpcUrls.default.http,
            blockExplorerUrls: targetChain.blockExplorers?.default?.url
              ? [targetChain.blockExplorers.default.url]
              : undefined,
          },
        ],
      });
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: hexChainId }],
      });
      return true;
    } catch {
      return false;
    }
  }
}
