import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { rhTestnet } from "./chain";

export const wagmiConfig = createConfig({
  chains: [rhTestnet],
  connectors: [injected()],
  transports: { [rhTestnet.id]: http() },
  ssr: true,
});
