"use client";

import { useMemo, useState, useRef, useCallback } from "react";
import s from "./trading-chart.module.css";
import type { OHLCVCandle } from "../api/prices/history/route";

export type ChartData = {
  source: string;
  symbol: string;
  timestamps: number[];
  closes: number[];
  candles?: OHLCVCandle[];
  high: number;
  low: number;
  latest: number;
  changePct: number;
};

interface TradingChartProps {
  symbol: string;
  collSym: string;
  pairLabel: string;
  currentPrice: number;
  priceDigits: number;
  liqPrice: number;
  hist: ChartData | null;
  isMainnet: boolean;
}

const formatPrice = (n: number, d = 2) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

const formatTime = (ts: number) => {
  const date = new Date(ts * 1000);
  const m = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const t = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${m} ${t}`;
};

const formatVol = (v: number) => {
  if (!v || v === 0) return "0";
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "M";
  if (v >= 1_000) return (v / 1_000).toFixed(1) + "K";
  return v.toFixed(0);
};

function CandleIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" style={{ flexShrink: 0 }}>
      {/* Candle 1 (left) */}
      <line x1="4.5" y1="1.5" x2="4.5" y2="14.5" />
      <rect x="2.5" y="4.5" width="4" height="6.5" fill="currentColor" rx="0.5" stroke="none" />
      {/* Candle 2 (right) */}
      <line x1="11.5" y1="2.5" x2="11.5" y2="13.5" />
      <rect x="9.5" y="6" width="4" height="5" fill="none" stroke="currentColor" strokeWidth="1.2" rx="0.5" />
    </svg>
  );
}

function LineChartIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M1.5 12L5 7.5L9 10L14.5 3.5" />
      <circle cx="14.5" cy="3.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function TradingChart({
  collSym,
  currentPrice,
  priceDigits,
  liqPrice,
  hist,
  isMainnet,
}: TradingChartProps) {
  const [chartType, setChartType] = useState<"candles" | "line">("candles");
  const [timeframe, setTimeframe] = useState<"24h" | "48h">("48h");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Fallback synthetic candles if hist is still loading or empty
  const rawCandles = useMemo<OHLCVCandle[]>(() => {
    if (hist?.candles && hist.candles.length >= 2) {
      if (!isMainnet && currentPrice > 0 && hist.latest > 0) {
        const scale = currentPrice / hist.latest;
        return hist.candles.map((c) => ({
          time: c.time,
          open: c.open * scale,
          high: c.high * scale,
          low: c.low * scale,
          close: c.close * scale,
          volume: c.volume,
        }));
      }
      return hist.candles;
    }

    // Generate realistic fallback candles around currentPrice
    const now = Math.floor(Date.now() / 1000);
    const count = 48;
    const base = currentPrice > 0 ? currentPrice : 100;
    const items: OHLCVCandle[] = [];
    let prev = base * 0.98;

    for (let i = 0; i < count; i++) {
      const t = now - (count - 1 - i) * 3600;
      const wiggle = (Math.sin(i / 3) + Math.cos(i / 1.5)) * 0.006 * base;
      const open = prev;
      const close = base * (0.98 + (i / count) * 0.04) + wiggle;
      const high = Math.max(open, close) + Math.abs(wiggle * 0.5) + base * 0.002;
      const low = Math.min(open, close) - Math.abs(wiggle * 0.5) - base * 0.002;
      items.push({
        time: t,
        open,
        high,
        low,
        close,
        volume: 1000 + Math.floor(Math.sin(i) * 400 + 400),
      });
      prev = close;
    }
    return items;
  }, [hist, isMainnet, currentPrice]);

  // Sliced candles based on timeframe
  const candles = useMemo(() => {
    if (timeframe === "24h") {
      return rawCandles.slice(-24);
    }
    return rawCandles.slice(-48);
  }, [rawCandles, timeframe]);

  // Dimensions of SVG plot
  const W = 1000;
  const H = 320;
  const padLeft = 14;
  const padRight = 78; // Space for right Y-axis labels & price badge
  const padTop = 16;
  const padBottom = 26; // Space for bottom X-axis labels
  const plotW = W - padLeft - padRight;
  const plotH = H - padTop - padBottom;
  const volH = plotH * 0.22; // 22% height at bottom for volume bars
  const pricePlotH = plotH - volH - 10; // Main area for candles

  // Scale calculations
  const { minP, maxP, maxVol } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    let mv = 0;
    for (const c of candles) {
      if (c.low < min) min = c.low;
      if (c.high > max) max = c.high;
      if (c.volume > mv) mv = c.volume;
    }
    // Include currentPrice
    if (currentPrice > 0) {
      if (currentPrice < min) min = currentPrice;
      if (currentPrice > max) max = currentPrice;
    }
    // If liqPrice is within realistic range, include it
    if (liqPrice > 0 && liqPrice >= min * 0.6 && liqPrice <= max * 1.5) {
      if (liqPrice < min) min = liqPrice;
      if (liqPrice > max) max = liqPrice;
    }
    const range = Math.max(max - min, 0.001);
    // 5% headroom
    return {
      minP: min - range * 0.05,
      maxP: max + range * 0.05,
      maxVol: mv > 0 ? mv : 100,
    };
  }, [candles, currentPrice, liqPrice]);

  const yPrice = useCallback(
    (p: number) => {
      const fraction = (p - minP) / Math.max(maxP - minP, 0.0001);
      return padTop + pricePlotH - fraction * pricePlotH;
    },
    [minP, maxP, padTop, pricePlotH]
  );

  const priceFromY = useCallback(
    (y: number) => {
      const clampedY = Math.max(padTop, Math.min(padTop + pricePlotH, y));
      const fraction = (padTop + pricePlotH - clampedY) / pricePlotH;
      return minP + fraction * (maxP - minP);
    },
    [minP, maxP, padTop, pricePlotH]
  );

  const candleW = Math.max(3, (plotW / candles.length) * 0.65);
  const candleGap = plotW / candles.length;

  const getCandleX = useCallback(
    (i: number) => padLeft + i * candleGap + candleGap / 2,
    [padLeft, candleGap]
  );

  // Line path coordinates (for line mode)
  const linePoints = useMemo(() => {
    return candles.map((c, i) => `${getCleX(i).toFixed(1)},${yPrice(c.close).toFixed(1)}`).join(" ");
    function getCleX(i: number) {
      return padLeft + i * candleGap + candleGap / 2;
    }
  }, [candles, padLeft, candleGap, yPrice]);

  // Hover detection
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    const svgY = ((e.clientY - rect.top) / rect.height) * H;

    setCursorPos({ x: svgX, y: svgY });

    // Determine nearest candle index
    const relX = svgX - padLeft;
    const idx = Math.floor(relX / candleGap);
    if (idx >= 0 && idx < candles.length) {
      setHoverIdx(idx);
    } else {
      setHoverIdx(null);
    }
  };

  const handlePointerLeave = () => {
    setHoverIdx(null);
    setCursorPos(null);
  };

  // Active candle to show in HUD (hovered candle or latest candle)
  const activeCandle = hoverIdx !== null && candles[hoverIdx] ? candles[hoverIdx] : candles[candles.length - 1];
  const activeChange =
    activeCandle && activeCandle.open > 0
      ? ((activeCandle.close - activeCandle.open) / activeCandle.open) * 100
      : 0;

  // 48h / period overall change
  const firstCandle = candles[0];
  const lastCandle = candles[candles.length - 1];
  const overallChange =
    firstCandle && firstCandle.open > 0 && lastCandle
      ? ((lastCandle.close - firstCandle.open) / firstCandle.open) * 100
      : 0;

  // Grid levels (4 horizontal price lines)
  const gridLevels = useMemo(() => {
    return [0.1, 0.38, 0.68, 0.96].map((frac) => {
      const p = minP + frac * (maxP - minP);
      return { price: p, y: yPrice(p) };
    });
  }, [minP, maxP, yPrice]);

  // Time grid levels (4 vertical lines)
  const timeGridLevels = useMemo(() => {
    if (candles.length < 4) return [];
    const step = Math.floor(candles.length / 4);
    return [step, step * 2, step * 3, candles.length - 1].map((idx) => ({
      x: getCandleX(idx),
      time: candles[idx].time,
    }));
  }, [candles, getCandleX]);

  // Price under cursor
  const cursorPrice = cursorPos ? priceFromY(cursorPos.y) : null;
  const livePriceY = currentPrice > 0 ? yPrice(currentPrice) : null;
  const liqY = liqPrice > 0 ? yPrice(liqPrice) : null;

  return (
    <div className={s.chartContainer}>
      {/* Top Bar: Live Price, 48h change, and View Controls */}
      <div className={s.topBar}>
        <div className={s.priceGroup}>
          <div className={s.currentPrice}>
            {formatPrice(currentPrice > 0 ? currentPrice : activeCandle?.close || 0, priceDigits)}
          </div>
          <span
            className={`${s.changeBadge} ${overallChange >= 0 ? s.changeUp : s.changeDown}`}
          >
            <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline-block" }}>
              <path d={overallChange >= 0 ? "M2 6.5L5 3.5L8 6.5" : "M2 3.5L5 6.5L8 3.5"} />
            </svg>
            {overallChange >= 0 ? "+" : ""}
            {overallChange.toFixed(2)}%
          </span>
          <span className={s.liveTag}>
            <i className={s.liveDot} />
            {hist?.source === "pyth-pro" ? "Pyth Pro Live" : "Live Market Feed"}
          </span>
          {liqPrice > 0 && (
            <span className={s.liqLegend}>
              <i className={s.liqDot} />
              Liq {formatPrice(liqPrice, priceDigits)}
            </span>
          )}
        </div>

        <div className={s.controls}>
          {/* Timeframe toggle */}
          <div className={s.btnGroup} role="group" aria-label="Timeframe">
            <button
              className={timeframe === "24h" ? s.activeBtn : ""}
              onClick={() => setTimeframe("24h")}
            >
              24H
            </button>
            <button
              className={timeframe === "48h" ? s.activeBtn : ""}
              onClick={() => setTimeframe("48h")}
            >
              48H
            </button>
          </div>

          {/* Chart type toggle */}
          <div className={s.btnGroup} role="group" aria-label="Chart type">
            <button
              className={chartType === "candles" ? s.activeBtn : ""}
              onClick={() => setChartType("candles")}
              title="Candlestick Chart"
            >
              <CandleIcon />
              <span>Candles</span>
            </button>
            <button
              className={chartType === "line" ? s.activeBtn : ""}
              onClick={() => setChartType("line")}
              title="Line Chart"
            >
              <LineChartIcon />
              <span>Line</span>
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic Trading HUD: Displays O, H, L, C, Vol for hovered or latest candle */}
      <div className={s.hudBar}>
        <div className={s.hudValues}>
          <span className={s.hudTime}>
            {activeCandle ? formatTime(activeCandle.time) : "--"}
          </span>
          <span>
            O: <b>{activeCandle ? formatPrice(activeCandle.open, priceDigits) : "--"}</b>
          </span>
          <span>
            H: <b>{activeCandle ? formatPrice(activeCandle.high, priceDigits) : "--"}</b>
          </span>
          <span>
            L: <b>{activeCandle ? formatPrice(activeCandle.low, priceDigits) : "--"}</b>
          </span>
          <span>
            C:{" "}
            <b className={activeChange >= 0 ? s.up : s.down}>
              {activeCandle ? formatPrice(activeCandle.close, priceDigits) : "--"}
            </b>
          </span>
          <span>
            Chg:{" "}
            <b className={activeChange >= 0 ? s.up : s.down}>
              {activeChange >= 0 ? "+" : ""}
              {activeChange.toFixed(2)}%
            </b>
          </span>
          {activeCandle?.volume > 0 && (
            <span>
              Vol: <b>{formatVol(activeCandle.volume)}</b>
            </span>
          )}
        </div>
        <div className={s.hudTime}>
          {collSym}/USD · Robinhood Chain
        </div>
      </div>

      {/* SVG Interactive Trading Chart */}
      <div className={s.svgWrap}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className={s.svg}
          preserveAspectRatio="none"
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
        >
          <defs>
            {/* Background gradient for line chart mode */}
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c9f27a" stopOpacity="0.22" />
              <stop offset="85%" stopColor="#c9f27a" stopOpacity="0.0" />
            </linearGradient>
            {/* Filter for glowing markers */}
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Horizontal Grid Lines & Price Labels */}
          {gridLevels.map((gl, i) => (
            <g key={i}>
              <line
                x1={padLeft}
                x2={W - padRight}
                y1={gl.y}
                y2={gl.y}
                stroke="var(--line)"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <text
                x={W - padRight + 8}
                y={gl.y + 3.5}
                fill="var(--tx3)"
                fontSize="10"
                fontFamily="var(--mono)"
              >
                {formatPrice(gl.price, priceDigits)}
              </text>
            </g>
          ))}

          {/* Vertical Grid Lines & Time Labels */}
          {timeGridLevels.map((tl, i) => (
            <g key={i}>
              <line
                x1={tl.x}
                x2={tl.x}
                y1={padTop}
                y2={padTop + pricePlotH}
                stroke="var(--line)"
                strokeDasharray="2 4"
                strokeWidth="0.8"
              />
              <text
                x={tl.x}
                y={H - 8}
                textAnchor="middle"
                fill="var(--tx3)"
                fontSize="9"
                fontFamily="var(--mono)"
              >
                {formatTime(tl.time).split(" ")[1]}
              </text>
            </g>
          ))}

          {/* Volume Histogram (bottom 20%) */}
          {candles.map((c, i) => {
            const cx = getCandleX(i);
            const isUp = c.close >= c.open;
            const vHeight = maxVol > 0 ? (c.volume / maxVol) * volH : 2;
            const vy = padTop + plotH - vHeight;
            return (
              <rect
                key={`vol-${i}`}
                x={cx - candleW / 2}
                y={vy}
                width={candleW}
                height={Math.max(1.5, vHeight)}
                fill={isUp ? "#c9f27a" : "#ff6b6b"}
                fillOpacity="0.28"
              />
            );
          })}

          {/* Chart Data: Candlesticks Mode */}
          {chartType === "candles" &&
            candles.map((c, i) => {
              const cx = getCandleX(i);
              const isUp = c.close >= c.open;
              const col = isUp ? "#c9f27a" : "#ff6b6b";
              const yO = yPrice(c.open);
              const yC = yPrice(c.close);
              const yH = yPrice(c.high);
              const yL = yPrice(c.low);
              const bodyTop = Math.min(yO, yC);
              const bodyHeight = Math.max(2, Math.abs(yC - yO));
              const isHovered = hoverIdx === i;

              return (
                <g key={`candle-${i}`}>
                  {/* Wick */}
                  <line
                    x1={cx}
                    x2={cx}
                    y1={yH}
                    y2={yL}
                    stroke={col}
                    strokeWidth={isHovered ? "1.8" : "1.2"}
                  />
                  {/* Body */}
                  <rect
                    x={cx - candleW / 2}
                    y={bodyTop}
                    width={candleW}
                    height={bodyHeight}
                    rx="1"
                    fill={col}
                    stroke={isHovered ? "#fff" : col}
                    strokeWidth={isHovered ? "1" : "0"}
                  />
                </g>
              );
            })}

          {/* Chart Data: Line Mode */}
          {chartType === "line" && (
            <>
              <polygon
                points={`${padLeft},${padTop + pricePlotH} ${linePoints} ${W - padRight},${padTop + pricePlotH}`}
                fill="url(#areaGradient)"
              />
              <polyline
                points={linePoints}
                fill="none"
                stroke="#c9f27a"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}

          {/* Liquidation Price Line (if applicable) */}
          {liqY !== null && liqY >= padTop && liqY <= padTop + pricePlotH && (
            <g>
              <line
                x1={padLeft}
                x2={W - padRight}
                y1={liqY}
                y2={liqY}
                stroke="var(--red)"
                strokeDasharray="6 4"
                strokeWidth="1.4"
              />
              <rect
                x={W - padRight + 2}
                y={liqY - 9}
                width={70}
                height={18}
                fill="var(--panel)"
                stroke="var(--red)"
                strokeWidth="1"
                rx="2"
              />
              <text
                x={W - padRight + 8}
                y={liqY + 3.5}
                fill="var(--red)"
                fontSize="9.5"
                fontFamily="var(--mono)"
                fontWeight="bold"
              >
                LIQ {formatPrice(liqPrice, priceDigits)}
              </text>
            </g>
          )}

          {/* Current Live Price Line & Beacon */}
          {livePriceY !== null && (
            <g>
              <line
                x1={padLeft}
                x2={W - padRight}
                y1={livePriceY}
                y2={livePriceY}
                stroke="#c9f27a"
                strokeDasharray="3 3"
                strokeWidth="1.2"
                opacity="0.85"
              />
              {/* Pulsing Beacon Dot at the latest candle */}
              <circle
                cx={getCandleX(candles.length - 1)}
                y={livePriceY}
                r="3.5"
                fill="#c9f27a"
                filter="url(#glow)"
              />
              {/* Right Axis Live Price Badge */}
              <rect
                x={W - padRight + 2}
                y={livePriceY - 10}
                width={72}
                height={20}
                fill="#c9f27a"
                rx="2"
              />
              <text
                x={W - padRight + 6}
                y={livePriceY + 3.5}
                fill="#0e1412"
                fontSize="10"
                fontFamily="var(--mono)"
                fontWeight="bold"
              >
                {formatPrice(currentPrice, priceDigits)}
              </text>
            </g>
          )}

          {/* Interactive Crosshair & Cursor Tracking */}
          {cursorPos && hoverIdx !== null && candles[hoverIdx] && (
            <g>
              {/* Vertical Crosshair Line */}
              <line
                x1={getCandleX(hoverIdx)}
                x2={getCandleX(hoverIdx)}
                y1={padTop}
                y2={padTop + plotH}
                stroke="rgba(255, 255, 255, 0.45)"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              {/* Horizontal Crosshair Line */}
              <line
                x1={padLeft}
                x2={W - padRight}
                y1={cursorPos.y}
                y2={cursorPos.y}
                stroke="rgba(255, 255, 255, 0.45)"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              {/* Bottom Time Badge */}
              <rect
                x={getCandleX(hoverIdx) - 34}
                y={H - padBottom + 2}
                width={68}
                height={18}
                fill="var(--panel2)"
                stroke="var(--line2)"
                rx="2"
              />
              <text
                x={getCandleX(hoverIdx)}
                y={H - padBottom + 14}
                textAnchor="middle"
                fill="var(--tx)"
                fontSize="9"
                fontFamily="var(--mono)"
              >
                {formatTime(candles[hoverIdx].time).split(" ")[1]}
              </text>
              {/* Right Price Badge */}
              {cursorPrice !== null && (
                <g>
                  <rect
                    x={W - padRight + 2}
                    y={cursorPos.y - 9}
                    width={72}
                    height={18}
                    fill="var(--panel2)"
                    stroke="var(--line2)"
                    rx="2"
                  />
                  <text
                    x={W - padRight + 6}
                    y={cursorPos.y + 3.5}
                    fill="var(--tx)"
                    fontSize="9.5"
                    fontFamily="var(--mono)"
                  >
                    {formatPrice(cursorPrice, priceDigits)}
                  </text>
                </g>
              )}
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
