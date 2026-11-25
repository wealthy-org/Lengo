import type { Metadata } from "next";
import "./globals.css";
import Providers from "./Providers";

const TITLE = "Lengo — Cross-Chain Lending on Robinhood Chain";
const DESC =
  "Mainnet Beta (4663): Supply USDG, borrow against WETH collateral with keeperless Chainlink oracles, and route cross-chain payouts via NEAR Intents.";

export const metadata: Metadata = {
  metadataBase: new URL("https://lengoapp.tech"),
  title: {
    default: TITLE,
    template: "%s · Lengo",
  },
  description: DESC,
  applicationName: "Lengo",
  openGraph: {
    title: TITLE,
    description: DESC,
    url: "https://lengoapp.tech",
    siteName: "Lengo",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    site: "@lengoapp",
    creator: "@lengoapp",
    title: TITLE,
    description: DESC,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
