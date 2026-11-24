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

function withTimeout<T>(promise: Promise<T>, ms = 3500): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error("wallet_switch_timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(id);
        resolve(v);
      },
      (e) => {
        clearTimeout(id);
        reject(e);
      }
    );
  });
}

/**
 * Ensures the connected wallet is switched to `targetChain`.
 * Bounded by short timeouts so multi-extension browsers (Rabby + Phantom + MetaMask) never hang UI state.
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
      const currentHex = (await withTimeout(provider.request({ method: "eth_chainId" }), 1500)) as string;
      if (parseInt(currentHex, 16) === targetChain.id) return true;
    } catch {
      /* continue */
    }
  }

  if (switchChainAsync) {
    try {
      await withTimeout(switchChainAsync({ chainId: targetChain.id }), 4000);
      return true;
    } catch (err) {
      if (isUserRejected(err)) return false;
    }
  }

  if (!provider) return false;

  try {
    await withTimeout(
      provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: hexChainId }],
      }),
      4000
    );
    return true;
  } catch (switchErr) {
    if (isUserRejected(switchErr)) return false;
    try {
      await withTimeout(
        provider.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: hexChainId,
              chainName: targetChain.name,
              nativeCurrency: targetChain.nativeCurrency,
              rpcUrls: [targetChain.rpcUrls.default.http[0]],
              blockExplorerUrls: targetChain.blockExplorers?.default?.url
                ? [targetChain.blockExplorers.default.url]
                : undefined,
            },
          ],
        }),
        4000
      );
      return true;
    } catch {
      return false;
    }
  }
}
