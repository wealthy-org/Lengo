import { defineChain, type Address, type Chain } from "viem";

export type NetworkMode = "testnet" | "mainnet";

const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11" as Address;

export const rhTestnet = defineChain({
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://46630.rpc.thirdweb.com", "https://rpc.testnet.chain.robinhood.com"],
    },
  },
  blockExplorers: { default: { name: "RH Testnet Explorer", url: "https://explorer.testnet.chain.robinhood.com" } },
  contracts: { multicall3: { address: MULTICALL3 } },
  testnet: true,
});

export const rhMainnet = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        process.env.NEXT_PUBLIC_RH_MAINNET_RPC || "https://4663.rpc.thirdweb.com",
        "https://rpc.mainnet.chain.robinhood.com",
      ],
    },
  },
  blockExplorers: { default: { name: "RH Explorer", url: "https://robinhoodchain.blockscout.com" } },
  contracts: { multicall3: { address: MULTICALL3 } },
  testnet: false,
});

const a = (v?: string) => (v && /^0x[0-9a-fA-F]{40}$/.test(v) ? (v as Address) : undefined);

export type NetworkDeployment = {
  mode: NetworkMode;
  chain: Chain;
  explorer: string;
  market?: Address;
  collateral?: Address;
  debtAsset?: Address;
  oracle?: Address;
  startBlock: bigint;
  collSymbol: "tBTC" | "WETH";
  debtSymbol: "tUSDC" | "USDG";
  collDecimals: number;
  debtDecimals: number;
  oracleLabel: string;
  simPrice: number;
  isDeployed: boolean;
};

// Verified RH Testnet (46630) fallback from contracts/deployments/46630.json
const TESTNET_DEFAULTS = {
  market: "0xA4f36BEb211186C42B0A6B50Cf85DB062C5e5E25" as Address,
  tBTC: "0x2e179ff76ef528821f2dE00D7079F1999ccdEB88" as Address,
  tUSDC: "0xe1f1C4292C7AED0D0E99DD1233607e776826762d" as Address,
  oracle: "0x7e4B30ef399EFE0fab110Ad9ADc3b39c8d19D5cE" as Address,
  startBlock: "153087385",
};

// Official Robinhood Chain Mainnet (4663) deployed contracts (contracts/deployments/4663.json)
export const MAINNET_WETH = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73" as Address;
export const MAINNET_USDG = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168" as Address;
const MAINNET_DEFAULTS = {
  market: "0x8f1CDFEa078D84d0a2f974c658f71CF4B54c5900" as Address,
  oracle: "0xAc892397986B84ff42894739F05fE884D1D4c6da" as Address,
  startBlock: "122296154",
};

const testnetMarket = a(process.env.NEXT_PUBLIC_LENGO_MARKET) ?? TESTNET_DEFAULTS.market;
const testnetColl = a(process.env.NEXT_PUBLIC_LENGO_TBTC) ?? TESTNET_DEFAULTS.tBTC;
const testnetDebt = a(process.env.NEXT_PUBLIC_LENGO_TUSDC) ?? TESTNET_DEFAULTS.tUSDC;
const testnetOracle = a(process.env.NEXT_PUBLIC_LENGO_ORACLE) ?? TESTNET_DEFAULTS.oracle;

const mainnetMarket = a(process.env.NEXT_PUBLIC_LENGO_MAINNET_MARKET) ?? MAINNET_DEFAULTS.market;
const mainnetColl = a(process.env.NEXT_PUBLIC_LENGO_MAINNET_COLLATERAL) ?? MAINNET_WETH;
const mainnetDebt = a(process.env.NEXT_PUBLIC_LENGO_MAINNET_DEBT) ?? MAINNET_USDG;
const mainnetOracle = a(process.env.NEXT_PUBLIC_LENGO_MAINNET_ORACLE) ?? MAINNET_DEFAULTS.oracle;

export const DEPLOYMENTS: Record<NetworkMode, NetworkDeployment> = {
  testnet: {
    mode: "testnet",
    chain: rhTestnet,
    explorer: rhTestnet.blockExplorers.default.url,
    market: testnetMarket,
    collateral: testnetColl,
    debtAsset: testnetDebt,
    oracle: testnetOracle,
    startBlock: BigInt(process.env.NEXT_PUBLIC_LENGO_START_BLOCK || TESTNET_DEFAULTS.startBlock),
    collSymbol: "tBTC",
    debtSymbol: "tUSDC",
    collDecimals: 8,
    debtDecimals: 6,
    oracleLabel: "DemoOracle",
    simPrice: 100_000,
    isDeployed: !!(testnetMarket && testnetColl && testnetDebt && testnetOracle),
  },
  mainnet: {
    mode: "mainnet",
    chain: rhMainnet,
    explorer: rhMainnet.blockExplorers.default.url,
    market: mainnetMarket,
    collateral: mainnetColl,
    debtAsset: mainnetDebt,
    oracle: mainnetOracle,
    startBlock: BigInt(process.env.NEXT_PUBLIC_LENGO_MAINNET_START_BLOCK || MAINNET_DEFAULTS.startBlock),
    collSymbol: "WETH",
    debtSymbol: "USDG",
    collDecimals: 18,
    debtDecimals: 6,
    oracleLabel: "Chainlink",
    simPrice: 1_700,
    isDeployed: !!(mainnetMarket && mainnetColl && mainnetDebt && mainnetOracle),
  },
};

/** Default network is Robinhood Chain Mainnet (4663) unless NEXT_PUBLIC_NETWORK=testnet is explicitly set. */
export const DEFAULT_NETWORK: NetworkMode =
  process.env.NEXT_PUBLIC_NETWORK === "testnet" ? "testnet" : "mainnet";

export const activeDeployment = DEPLOYMENTS[DEFAULT_NETWORK];
export const activeChain = activeDeployment.chain;

// Backwards-compatible exports for existing imports (resolved from DEFAULT_NETWORK on server)
export const EXPLORER = activeDeployment.explorer;
export const txUrl = (h: string, mode: NetworkMode = currentMode) => `${DEPLOYMENTS[mode].explorer}/tx/${h}`;
export const addrUrl = (addr: string, mode: NetworkMode = currentMode) => `${DEPLOYMENTS[mode].explorer}/address/${addr}`;

export const deployment = {
  market: testnetMarket,
  tBTC: testnetColl,
  tUSDC: testnetDebt,
  oracle: testnetOracle,
  startBlock: DEPLOYMENTS.testnet.startBlock,
};
export const isDeployed = DEPLOYMENTS.testnet.isDeployed;

// Client-side reactive network selector (defaults to DEFAULT_NETWORK = "testnet")
let currentMode: NetworkMode = DEFAULT_NETWORK;
const listeners = new Set<() => void>();

export function getNetworkMode(): NetworkMode {
  return currentMode;
}

export function setNetworkMode(next: NetworkMode) {
  if (currentMode === next) return;
  currentMode = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem("lengo:network", next);
    } catch {
      /* ignore storage errors */
    }
  }
  listeners.forEach((l) => l());
}

export function subscribeNetworkMode(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
