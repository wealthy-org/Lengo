import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { DEFAULT_NETWORK, rhMainnet, rhTestnet } from "./chain";

// Put the default network first so wagmi always initializes on RH Testnet (46630) by default.
const chains = DEFAULT_NETWORK === "mainnet" ? ([rhMainnet, rhTestnet] as const) : ([rhTestnet, rhMainnet] as const);

export const wagmiConfig = createConfig({
  chains,
  connectors: [injected()],
  transports: {
    [rhTestnet.id]: http(rhTestnet.rpcUrls.default.http[0]),
    [rhMainnet.id]: http(rhMainnet.rpcUrls.default.http[0]),
  },
  ssr: true,
});
