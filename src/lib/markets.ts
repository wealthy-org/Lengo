import type { Address } from "viem";
import manifest from "../../contracts/deployments/4663-markets.json";
import { DEPLOYMENTS } from "./chain";

export type MarketSpec = {
  id: string;
  pair: string;
  collSymbol: string;
  debtSymbol: string;
  category: "Crypto" | "Stable" | "Robinhood Stock" | "Testnet";
  sub: string;
  collateral: Address;
  debtAsset: Address;
  chainlinkFeed?: Address;
  feedLabel?: string;
  collateralCapLabel?: string;
  supplyCapLabel?: string;
  uiMultiplier?: string;
  isSeeded?: boolean;
  market?: Address;
  oracle?: Address;
  collDecimals: number;
  debtDecimals: number;
  maxLtv: number;
  liqThreshold: number;
  apr: number;
  maxOracleAge: number;
  fallbackPrice: number;
};

const a = (v?: string) => (v && /^0x[0-9a-fA-F]{40}$/.test(v) ? (v as Address) : undefined);
const deployedMap = (manifest?.markets ?? {}) as Record<string, string>;
const USDG = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168" as Address;
const ORACLE = (a(process.env.NEXT_PUBLIC_LENGO_MAINNET_ORACLE) ?? manifest.oracle) as Address;

export const MAINNET_MARKETS: MarketSpec[] = [
  {
    id: "WETH",
    pair: "WETH/USDG",
    collSymbol: "WETH",
    debtSymbol: "USDG",
    category: "Crypto",
    sub: "Crypto · 60% LTV · 8.0% APR",
    collateral: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",
    debtAsset: USDG,
    chainlinkFeed: "0x78F3556b67E17Df817D51Ef5a990cDaF09E8d3A9",
    feedLabel: "ETH / USD",
    collateralCapLabel: "25 WETH",
    supplyCapLabel: "50,000 USDG",
    isSeeded: true,
    market: a(process.env.NEXT_PUBLIC_LENGO_MAINNET_MARKET) ?? a(deployedMap.WETH),
    oracle: ORACLE,
    collDecimals: 18,
    debtDecimals: 6,
    maxLtv: 0.60,
    liqThreshold: 0.75,
    apr: 0.08,
    maxOracleAge: 7200,
    fallbackPrice: 1690,
  },
  {
    id: "cbBTC",
    pair: "cbBTC/USDG",
    collSymbol: "cbBTC",
    debtSymbol: "USDG",
    category: "Crypto",
    sub: "Coinbase BTC · 65% LTV · 7.5% APR",
    collateral: "0xCEC185eB182c47d1bA1EFc84e6959e18cd620Be4",
    debtAsset: USDG,
    chainlinkFeed: "0x0009cD492adf8167f9eEBf1293556A673530a21a",
    feedLabel: "CBBTC / USD",
    collateralCapLabel: "1 cbBTC",
    supplyCapLabel: "50,000 USDG",
    isSeeded: true,
    market: a(deployedMap.cbBTC),
    oracle: ORACLE,
    collDecimals: 8,
    debtDecimals: 6,
    maxLtv: 0.65,
    liqThreshold: 0.78,
    apr: 0.075,
    maxOracleAge: 90000,
    fallbackPrice: 60000,
  },
  {
    id: "WBTC",
    pair: "WBTC/USDG",
    collSymbol: "WBTC",
    debtSymbol: "USDG",
    category: "Crypto",
    sub: "Wrapped BTC · 65% LTV · 7.5% APR",
    collateral: "0x6bac06600D220Ac5Ac281AD1f504D2Cf0F90F6e6",
    debtAsset: USDG,
    chainlinkFeed: "0x62107b0d3adA75fc1697fD342d99eed947a3aA5E",
    feedLabel: "WBTC / USD",
    collateralCapLabel: "1 WBTC",
    supplyCapLabel: "50,000 USDG",
    isSeeded: true,
    market: a(deployedMap.WBTC),
    oracle: ORACLE,
    collDecimals: 8,
    debtDecimals: 6,
    maxLtv: 0.65,
    liqThreshold: 0.78,
    apr: 0.075,
    maxOracleAge: 90000,
    fallbackPrice: 60000,
  },
  {
    id: "USDe",
    pair: "USDe/USDG",
    collSymbol: "USDe",
    debtSymbol: "USDG",
    category: "Stable",
    sub: "Ethena · 80% LTV · 6.5% APR",
    collateral: "0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34",
    debtAsset: USDG,
    chainlinkFeed: "0xb9fB4e65744E4178894f7C61CF80E8a48A5f224a",
    feedLabel: "USDE / USD",
    collateralCapLabel: "50,000 USDe",
    supplyCapLabel: "50,000 USDG",
    isSeeded: true,
    market: a(deployedMap.USDe),
    oracle: ORACLE,
    collDecimals: 18,
    debtDecimals: 6,
    maxLtv: 0.80,
    liqThreshold: 0.88,
    apr: 0.065,
    maxOracleAge: 7200,
    fallbackPrice: 1.0,
  },
  {
    id: "NVDA",
    pair: "NVDA/USDG",
    collSymbol: "NVDA",
    debtSymbol: "USDG",
    category: "Robinhood Stock",
    sub: "Equity 24/7 · 50% LTV · 9.0% APR",
    collateral: "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC",
    debtAsset: USDG,
    chainlinkFeed: "0x321A36e441DfBadA01Aa6f9884F14a344E133D1F",
    feedLabel: "Robinhood NVDA (24/7)",
    collateralCapLabel: "300 NVDA",
    supplyCapLabel: "50,000 USDG",
    uiMultiplier: "1.000775",
    isSeeded: true,
    market: a(deployedMap.NVDA),
    oracle: ORACLE,
    collDecimals: 18,
    debtDecimals: 6,
    maxLtv: 0.50,
    liqThreshold: 0.65,
    apr: 0.09,
    maxOracleAge: 90000,
    fallbackPrice: 153,
  },
  {
    id: "TSLA",
    pair: "TSLA/USDG",
    collSymbol: "TSLA",
    debtSymbol: "USDG",
    category: "Robinhood Stock",
    sub: "Equity 24/7 · 50% LTV · 9.0% APR",
    collateral: "0x322F0929c4625eD5bAd873c95208D54E1c003b2d",
    debtAsset: USDG,
    chainlinkFeed: "0x39eDf5ef54150A30d2C4F1b982FbB8f93050BC37",
    feedLabel: "Robinhood TSLA (24/7)",
    collateralCapLabel: "150 TSLA",
    supplyCapLabel: "50,000 USDG",
    uiMultiplier: "1.000000",
    isSeeded: true,
    market: a(deployedMap.TSLA),
    oracle: ORACLE,
    collDecimals: 18,
    debtDecimals: 6,
    maxLtv: 0.50,
    liqThreshold: 0.65,
    apr: 0.09,
    maxOracleAge: 90000,
    fallbackPrice: 381,
  },
  {
    id: "AAPL",
    pair: "AAPL/USDG",
    collSymbol: "AAPL",
    debtSymbol: "USDG",
    category: "Robinhood Stock",
    sub: "Equity · 55% LTV · 8.5% APR",
    collateral: "0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9",
    debtAsset: USDG,
    chainlinkFeed: "0x6B22A786bAa607d76728168703a39Ea9C99f2cD0",
    feedLabel: "Robinhood AAPL / USD (US market hours)",
    collateralCapLabel: "150 AAPL",
    supplyCapLabel: "50,000 USDG",
    uiMultiplier: "1.001091",
    isSeeded: true,
    market: a(deployedMap.AAPL),
    oracle: ORACLE,
    collDecimals: 18,
    debtDecimals: 6,
    maxLtv: 0.55,
    liqThreshold: 0.70,
    apr: 0.085,
    maxOracleAge: 90000,
    fallbackPrice: 353,
  },
];

export const TESTNET_MARKET: MarketSpec = {
  id: "tBTC",
  pair: "tBTC/tUSDC",
  collSymbol: "tBTC",
  debtSymbol: "tUSDC",
  category: "Testnet",
  sub: "RH Testnet · 60% LTV · 8.0% APR",
  collateral: DEPLOYMENTS.testnet.collateral!,
  debtAsset: DEPLOYMENTS.testnet.debtAsset!,
  market: DEPLOYMENTS.testnet.market,
  oracle: DEPLOYMENTS.testnet.oracle,
  collDecimals: 8,
  debtDecimals: 6,
  maxLtv: 0.60,
  liqThreshold: 0.75,
  apr: 0.08,
  maxOracleAge: 300,
  fallbackPrice: 100000,
};
