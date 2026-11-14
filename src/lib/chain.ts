import { defineChain, type Address } from "viem";

export const rhTestnet = defineChain({
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.chain.robinhood.com"] } },
  blockExplorers: { default: { name: "RH Explorer", url: "https://explorer.testnet.chain.robinhood.com" } },
  testnet: true,
});

export const EXPLORER = rhTestnet.blockExplorers.default.url;
export const txUrl = (h: string) => `${EXPLORER}/tx/${h}`;
export const addrUrl = (a: string) => `${EXPLORER}/address/${a}`;

const a = (v?: string) => (v && /^0x[0-9a-fA-F]{40}$/.test(v) ? (v as Address) : undefined);

/** Deployment from env. Missing addresses = demo mode, clearly labeled in the UI. */
export const deployment = {
  market: a(process.env.NEXT_PUBLIC_LENGO_MARKET),
  tBTC: a(process.env.NEXT_PUBLIC_LENGO_TBTC),
  tUSDC: a(process.env.NEXT_PUBLIC_LENGO_TUSDC),
  oracle: a(process.env.NEXT_PUBLIC_LENGO_ORACLE),
  startBlock: BigInt(process.env.NEXT_PUBLIC_LENGO_START_BLOCK || "0"),
};
export const isDeployed = !!(deployment.market && deployment.tBTC && deployment.tUSDC && deployment.oracle);
