import type { Metadata } from "next";
import "./globals.css";
import Providers from "./Providers";

export const metadata: Metadata = {
  title: "Lengo · Cross-chain lending",
  description: "Borrow on Robinhood Chain, collateral and payout across chains via NEAR Intents.",
  icons: { icon: "/logo-mark.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
