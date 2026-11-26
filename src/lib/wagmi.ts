import { createConfig, fallback, http } from "wagmi";
import { arbitrum, avalanche, base, bsc, mainnet, optimism, polygon } from "viem/chains";
import { injected } from "wagmi/connectors";
import { DEFAULT_NETWORK, rhMainnet, rhTestnet } from "./chain";

const evmPartners = [base, arbitrum, optimism, polygon, mainnet, bsc, avalanche] as const;
const chains =
  DEFAULT_NETWORK === "mainnet"
    ? ([rhMainnet, rhTestnet, ...evmPartners] as const)
    : ([rhTestnet, rhMainnet, ...evmPartners] as const);

export const wagmiConfig = createConfig({
  chains,
  connectors: [injected()],
  transports: {
    [rhTestnet.id]: fallback(rhTestnet.rpcUrls.default.http.map((u) => http(u))),
    [rhMainnet.id]: fallback(rhMainnet.rpcUrls.default.http.map((u) => http(u))),
    [base.id]: http(),
    [arbitrum.id]: http(),
    [optimism.id]: http(),
    [polygon.id]: http(),
    [mainnet.id]: http(),
    [bsc.id]: http(),
    [avalanche.id]: http(),
  },
  ssr: true,
});
