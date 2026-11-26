import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Lengo — Cross-Chain Lending on Robinhood Chain Mainnet (4663)";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CANDLES = [
  { h: 78, l: 24, o: 42, c: 66, up: true },
  { h: 84, l: 38, o: 66, c: 50, up: false },
  { h: 74, l: 30, o: 50, c: 68, up: true },
  { h: 96, l: 48, o: 68, c: 88, up: true },
  { h: 92, l: 44, o: 88, c: 60, up: false },
  { h: 86, l: 42, o: 60, c: 78, up: true },
  { h: 98, l: 54, o: 78, c: 92, up: true },
  { h: 94, l: 50, o: 92, c: 72, up: false },
  { h: 96, l: 56, o: 72, c: 90, up: true },
  { h: 106, l: 64, o: 90, c: 102, up: true },
];

export default async function OpenGraphImage() {
  let logoSrc: string | null = null;
  try {
    const buf = await readFile(join(process.cwd(), "public", "logo-sm.png"));
    logoSrc = `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    logoSrc = null;
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#0e1412",
          backgroundImage:
            "radial-gradient(circle at 82% 22%, rgba(201, 242, 122, 0.13), transparent 52%), radial-gradient(circle at 14% 85%, rgba(127, 224, 180, 0.09), transparent 48%)",
          padding: "34px 40px",
          color: "#f4f7ef",
          fontFamily: "ui-monospace, Menlo, monospace",
        }}
      >
        {/* Framed Bevel Terminal Shell */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            backgroundColor: "#141d19",
            border: "1px solid #33443b",
            boxShadow: "0 24px 60px rgba(0, 0, 0, 0.55)",
          }}
        >
          {/* Top Header Strip */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "18px 28px",
              borderBottom: "1px solid #24302b",
              backgroundColor: "#17201c",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              {logoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoSrc} alt="" width={34} height={34} style={{ borderRadius: "6px" }} />
              ) : (
                <div
                  style={{
                    width: "34px",
                    height: "34px",
                    borderRadius: "6px",
                    backgroundColor: "#c9f27a",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#0e1412",
                    fontWeight: 700,
                    fontSize: "18px",
                  }}
                >
                  L
                </div>
              )}
              <span style={{ fontSize: "20px", fontWeight: 700, letterSpacing: "0.16em", color: "#f4f7ef" }}>
                LENGO
              </span>
              <span style={{ fontSize: "13px", letterSpacing: "0.12em", color: "#859a8e" }}>
                / LENDING TERMINAL
              </span>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "7px 14px",
                border: "1px solid rgba(201, 242, 122, 0.42)",
                backgroundColor: "rgba(201, 242, 122, 0.08)",
                fontSize: "12px",
                letterSpacing: "0.12em",
                color: "#c9f27a",
              }}
            >
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: "#c9f27a",
                }}
              />
              <span>MAINNET BETA · ROBINHOOD CHAIN 4663</span>
            </div>
          </div>

          {/* Center Body Split */}
          <div
            style={{
              display: "flex",
              flex: 1,
              padding: "36px 34px",
              gap: "34px",
              alignItems: "stretch",
            }}
          >
            {/* Left Copy Column */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                flex: 1.25,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    fontSize: "12px",
                    letterSpacing: "0.14em",
                    color: "#7fe0b4",
                  }}
                >
                  <span>ROBINHOOD CHAIN × NEAR INTENTS</span>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    fontSize: "48px",
                    fontWeight: 700,
                    lineHeight: 1.08,
                    letterSpacing: "-0.02em",
                    fontFamily: "system-ui, -apple-system, sans-serif",
                  }}
                >
                  <span style={{ color: "#f4f7ef" }}>Isolated Crypto &amp;</span>
                  <span style={{ color: "#c9f27a" }}>Stock-Token Lending.</span>
                </div>

                <div
                  style={{
                    display: "flex",
                    fontSize: "18px",
                    lineHeight: 1.5,
                    color: "#b6c5ba",
                    fontFamily: "system-ui, -apple-system, sans-serif",
                    maxWidth: "560px",
                  }}
                >
                  Supply USDG to earn borrower interest, borrow against WETH collateral with keeperless Chainlink feeds, and route payouts across chains.
                </div>
              </div>

              {/* Contract Proof Badges */}
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "9px 14px",
                    backgroundColor: "#0e1412",
                    border: "1px solid #24302b",
                    fontSize: "12px",
                    letterSpacing: "0.08em",
                    color: "#f4f7ef",
                  }}
                >
                  <span style={{ color: "#859a8e" }}>MARKET</span>
                  <span>0x8f1C…5900</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "7px",
                    padding: "9px 14px",
                    backgroundColor: "#0e1412",
                    border: "1px solid #24302b",
                    fontSize: "12px",
                    letterSpacing: "0.08em",
                    color: "#7fe0b4",
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8.5L6.5 12L13 4.5" stroke="#7fe0b4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>SOURCIFY VERIFIED</span>
                </div>
              </div>
            </div>

            {/* Right Terminal Market Card */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                width: "430px",
                backgroundColor: "#0e1412",
                border: "1px solid #24302b",
                padding: "20px 22px",
              }}
            >
              {/* Market Pair Header */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingBottom: "14px",
                  borderBottom: "1px solid #24302b",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "18px", fontWeight: 700, color: "#f4f7ef", letterSpacing: "0.04em" }}>
                    WETH / USDG
                  </span>
                  <span style={{ fontSize: "11px", color: "#859a8e", letterSpacing: "0.1em" }}>
                    ISOLATED POOL · PYTH PRO + CHAINLINK
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    padding: "4px 10px",
                    border: "1px solid rgba(201, 242, 122, 0.45)",
                    color: "#c9f27a",
                    fontSize: "11px",
                    letterSpacing: "0.12em",
                  }}
                >
                  LIVE
                </div>
              </div>

              {/* Mini Candlestick Plot */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "space-between",
                  height: "136px",
                  padding: "14px 10px 8px",
                  borderBottom: "1px solid #24302b",
                }}
              >
                {CANDLES.map((c, idx) => {
                  const col = c.up ? "#c9f27a" : "#ff6b6b";
                  const top = 115 - c.h;
                  const wickH = c.h - c.l;
                  const bodyTop = 115 - Math.max(c.o, c.c);
                  const bodyH = Math.max(6, Math.abs(c.c - c.o));
                  return (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        position: "relative",
                        width: "24px",
                        height: "115px",
                        justifyContent: "center",
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          top: `${top}px`,
                          height: `${wickH}px`,
                          width: "2px",
                          backgroundColor: col,
                        }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          top: `${bodyTop}px`,
                          height: `${bodyH}px`,
                          width: "14px",
                          borderRadius: "2px",
                          backgroundColor: col,
                        }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* 2x2 Metrics */}
              <div style={{ display: "flex", flexWrap: "wrap", paddingTop: "12px", rowGap: "12px" }}>
                <div style={{ display: "flex", flexDirection: "column", width: "50%", gap: "4px" }}>
                  <span style={{ fontSize: "10px", color: "#859a8e", letterSpacing: "0.12em" }}>BORROW APR</span>
                  <span style={{ fontSize: "17px", color: "#c9f27a", fontWeight: 700 }}>8.00% FIXED</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", width: "50%", gap: "4px" }}>
                  <span style={{ fontSize: "10px", color: "#859a8e", letterSpacing: "0.12em" }}>MAX LTV / LIQ</span>
                  <span style={{ fontSize: "17px", color: "#f4f7ef", fontWeight: 700 }}>60% / 75%</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", width: "50%", gap: "4px" }}>
                  <span style={{ fontSize: "10px", color: "#859a8e", letterSpacing: "0.12em" }}>ORACLE FEED</span>
                  <span style={{ fontSize: "15px", color: "#f4f7ef" }}>Chainlink ETH/USD</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", width: "50%", gap: "4px" }}>
                  <span style={{ fontSize: "10px", color: "#859a8e", letterSpacing: "0.12em" }}>MARKETS</span>
                  <span style={{ fontSize: "15px", color: "#f4f7ef" }}>7 Isolated Live</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Strip */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "13px 28px",
              borderTop: "1px solid #24302b",
              backgroundColor: "#17201c",
              fontSize: "12px",
              letterSpacing: "0.12em",
              color: "#859a8e",
            }}
          >
            <span style={{ color: "#c9f27a" }}>LENGOAPP.TECH</span>
            <span>KEEPERLESS RISK ENGINE · NON-CUSTODIAL EXIT</span>
            <span>NEAR INTENTS 1CLICK</span>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
