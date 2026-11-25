"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LastPriceAnimationMode,
  LineSeries,
  LineStyle,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import s from "./trading-chart.module.css";
import type { OHLCVCandle, Timeframe } from "../api/prices/history/route";

export type ChartData = {
  source: string;
  symbol: string;
  timeframe?: Timeframe;
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
  loading?: boolean;
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  isMainnet: boolean;
}

const formatPrice = (n: number, d = 2) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

const formatHudTime = (ts: number, tf: Timeframe) => {
  const date = new Date(ts * 1000);
  const d = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (tf === "1d") return d;
  const t = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${d} · ${t}`;
};

const formatVol = (v: number) => {
  if (!v || v <= 0) return "0";
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(2) + "M";
  if (v >= 1_000) return (v / 1_000).toFixed(1) + "K";
  return v.toFixed(0);
};

function CandleIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" style={{ flexShrink: 0 }}>
      <line x1="4.5" y1="1.5" x2="4.5" y2="14.5" />
      <rect x="2.5" y="4.5" width="4" height="6.5" fill="currentColor" rx="0.5" stroke="none" />
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

function computeEma(candles: OHLCVCandle[], period = 9): { time: UTCTimestamp; value: number }[] {
  if (candles.length === 0) return [];
  const k = 2 / (period + 1);
  let ema = candles[0].close;
  return candles.map((c, i) => {
    ema = i === 0 ? c.close : c.close * k + ema * (1 - k);
    return { time: c.time as UTCTimestamp, value: ema };
  });
}

const TF_LIST: { id: Timeframe; label: string; windowLabel: string }[] = [
  { id: "15m", label: "15M", windowLabel: "24h" },
  { id: "1h", label: "1H", windowLabel: "48h" },
  { id: "4h", label: "4H", windowLabel: "7d" },
  { id: "1d", label: "1D", windowLabel: "30d" },
];

export default function TradingChart({
  symbol,
  collSym,
  currentPrice,
  priceDigits,
  liqPrice,
  hist,
  loading = false,
  timeframe,
  onTimeframeChange,
  isMainnet,
}: TradingChartProps) {
  const [chartType, setChartType] = useState<"candles" | "line">("candles");
  const [showEma, setShowEma] = useState(true);
  const [hoveredTime, setHoveredTime] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mainSeriesRef = useRef<ISeriesApi<"Candlestick"> | ISeriesApi<"Area"> | null>(null);
  const emaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const volSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const liqLineRef = useRef<IPriceLine | null>(null);
  const lastViewKeyRef = useRef<string>("");

  // Build clean, strictly ascending candles (with live oracle price anchored on the latest bar)
  const candles = useMemo<OHLCVCandle[]>(() => {
    let baseList: OHLCVCandle[] = [];

    if (hist?.candles && hist.candles.length >= 2) {
      const scale = !isMainnet && currentPrice > 0 && hist.latest > 0 ? currentPrice / hist.latest : 1;
      const map = new Map<number, OHLCVCandle>();
      for (const c of hist.candles) {
        const t = Math.floor(c.time);
        map.set(t, {
          time: t,
          open: c.open * scale,
          high: c.high * scale,
          low: c.low * scale,
          close: c.close * scale,
          volume: c.volume,
        });
      }
      baseList = Array.from(map.values()).sort((a, b) => a.time - b.time);
    } else {
      const step = timeframe === "15m" ? 900 : timeframe === "4h" ? 14400 : timeframe === "1d" ? 86400 : 3600;
      const now = Math.floor(Date.now() / 1000 / step) * step;
      const count = 96;
      const base = currentPrice > 0 ? currentPrice : 100;
      let prev = base * 0.99;
      for (let i = 0; i < count; i++) {
        const t = now - (count - 1 - i) * step;
        const wiggle = (Math.sin(i / 3.2) + Math.cos(i / 1.7)) * 0.004 * base;
        const open = prev;
        const close = base * (0.99 + (i / count) * 0.01) + wiggle;
        const high = Math.max(open, close) + Math.abs(wiggle * 0.45) + base * 0.0015;
        const low = Math.min(open, close) - Math.abs(wiggle * 0.45) - base * 0.0015;
        baseList.push({ time: t, open, high, low, close, volume: 0 });
        prev = close;
      }
    }

    // Smoothly anchor latest bar close to live onchain price if within reasonable bounds
    if (baseList.length > 0 && currentPrice > 0) {
      const last = { ...baseList[baseList.length - 1] };
      if (Math.abs(currentPrice - last.close) / Math.max(last.close, 0.0001) < 0.08) {
        last.close = currentPrice;
        last.high = Math.max(last.high, currentPrice);
        last.low = Math.min(last.low, currentPrice);
        baseList = [...baseList.slice(0, -1), last];
      }
    }
    return baseList;
  }, [hist, isMainnet, currentPrice, timeframe]);

  const candleByTime = useMemo(() => {
    const m = new Map<number, OHLCVCandle>();
    for (const c of candles) m.set(c.time, c);
    return m;
  }, [candles]);

  const emaPoints = useMemo(() => computeEma(candles, 9), [candles]);
  const emaByTime = useMemo(() => {
    const m = new Map<number, number>();
    for (const p of emaPoints) m.set(Number(p.time), p.value);
    return m;
  }, [emaPoints]);

  const hasRealVolume = useMemo(() => candles.some((c) => c.volume > 0), [candles]);

  const precision = currentPrice >= 1000 ? 2 : currentPrice >= 2 ? 2 : 4;
  const minMove = precision === 4 ? 0.0001 : 0.01;

  // Initialize TradingView lightweight-charts Canvas engine
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#0e1412" },
        textColor: "#859a8e",
        fontFamily: 'ui-monospace, "JetBrains Mono", "SF Mono", Menlo, monospace',
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(36, 48, 43, 0.55)", style: LineStyle.Dotted },
        horzLines: { color: "rgba(36, 48, 43, 0.55)", style: LineStyle.Dotted },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "rgba(201, 242, 122, 0.36)",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "#1d2924",
        },
        horzLine: {
          color: "rgba(201, 242, 122, 0.36)",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "#1d2924",
        },
      },
      rightPriceScale: {
        borderColor: "#24302b",
        scaleMargins: { top: 0.11, bottom: 0.11 },
      },
      timeScale: {
        borderColor: "#24302b",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 5,
        barSpacing: 9,
        minBarSpacing: 2.5,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    chartRef.current = chart;

    const onCrosshair = (param: { time?: unknown }) => {
      if (!param || typeof param.time !== "number") {
        setHoveredTime((prev) => (prev === null ? null : null));
        return;
      }
      const t = param.time;
      setHoveredTime((prev) => (prev === t ? prev : t));
    };

    chart.subscribeCrosshairMove(onCrosshair);

    return () => {
      chart.unsubscribeCrosshairMove(onCrosshair);
      chart.remove();
      chartRef.current = null;
      mainSeriesRef.current = null;
      emaSeriesRef.current = null;
      volSeriesRef.current = null;
      liqLineRef.current = null;
    };
  }, []);

  // Rebuild series cleanly when chartType changes (Candles <-> Smooth Area)
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    if (mainSeriesRef.current) {
      chart.removeSeries(mainSeriesRef.current);
      mainSeriesRef.current = null;
      liqLineRef.current = null;
    }
    if (emaSeriesRef.current) {
      chart.removeSeries(emaSeriesRef.current);
      emaSeriesRef.current = null;
    }
    if (volSeriesRef.current) {
      chart.removeSeries(volSeriesRef.current);
      volSeriesRef.current = null;
    }

    const priceFormat = { type: "price" as const, precision, minMove };

    if (chartType === "candles") {
      mainSeriesRef.current = chart.addSeries(CandlestickSeries, {
        upColor: "#c9f27a",
        downColor: "#ff6b6b",
        borderUpColor: "#c9f27a",
        borderDownColor: "#ff6b6b",
        wickUpColor: "#c9f27a",
        wickDownColor: "#ff6b6b",
        priceLineColor: "#c9f27a",
        priceLineWidth: 1,
        priceLineStyle: LineStyle.Dotted,
        priceFormat,
      });
    } else {
      mainSeriesRef.current = chart.addSeries(AreaSeries, {
        lineColor: "#c9f27a",
        topColor: "rgba(201, 242, 122, 0.24)",
        bottomColor: "rgba(201, 242, 122, 0.0)",
        lineWidth: 2,
        lastPriceAnimation: LastPriceAnimationMode.Continuous,
        priceLineColor: "#c9f27a",
        priceLineWidth: 1,
        priceLineStyle: LineStyle.Dotted,
        priceFormat,
      });
    }

    emaSeriesRef.current = chart.addSeries(LineSeries, {
      color: "rgba(127, 224, 180, 0.82)",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      priceFormat,
    });

    volSeriesRef.current = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
      priceLineVisible: false,
      lastValueVisible: false,
    });
    chart.priceScale("vol").applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });
  }, [chartType, precision, minMove]);

  // Populate data, EMA, volume, and timeScale options
  useEffect(() => {
    const chart = chartRef.current;
    const main = mainSeriesRef.current;
    const ema = emaSeriesRef.current;
    const vol = volSeriesRef.current;
    if (!chart || !main || candles.length === 0) return;

    chart.applyOptions({
      rightPriceScale: {
        scaleMargins: { top: 0.11, bottom: hasRealVolume ? 0.21 : 0.10 },
      },
      timeScale: {
        timeVisible: timeframe !== "1d",
        secondsVisible: false,
      },
    });

    if (chartType === "candles") {
      (main as ISeriesApi<"Candlestick">).setData(
        candles.map((c) => ({
          time: c.time as UTCTimestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }))
      );
    } else {
      (main as ISeriesApi<"Area">).setData(
        candles.map((c) => ({
          time: c.time as UTCTimestamp,
          value: c.close,
        }))
      );
    }

    if (ema) {
      ema.setData(showEma && chartType === "candles" ? emaPoints : []);
    }

    if (vol) {
      vol.setData(
        hasRealVolume
          ? candles.map((c) => ({
              time: c.time as UTCTimestamp,
              value: c.volume,
              color: c.close >= c.open ? "rgba(201, 242, 122, 0.22)" : "rgba(255, 107, 107, 0.22)",
            }))
          : []
      );
    }

    // Focus visible viewport on the latest ~72 bars when switching market or timeframe
    const viewKey = `${symbol}:${timeframe}:${hist?.source ?? "fallback"}`;
    if (lastViewKeyRef.current !== viewKey) {
      lastViewKeyRef.current = viewKey;
      const total = candles.length;
      const visibleBars = Math.min(total, 72);
      chart.timeScale().setVisibleLogicalRange({
        from: Math.max(0, total - visibleBars),
        to: total + 4,
      });
    }
  }, [candles, chartType, emaPoints, showEma, hasRealVolume, timeframe, symbol, hist?.source]);

  // Sync Liquidation Price Line on the main series
  useEffect(() => {
    const main = mainSeriesRef.current;
    if (!main) return;

    if (liqLineRef.current) {
      main.removePriceLine(liqLineRef.current);
      liqLineRef.current = null;
    }

    if (liqPrice > 0) {
      liqLineRef.current = main.createPriceLine({
        price: liqPrice,
        color: "#ff6b6b",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "LIQ",
      });
    }
  }, [liqPrice, chartType, precision]);

  const activeCandle = (hoveredTime !== null ? candleByTime.get(hoveredTime) : undefined) ?? candles[candles.length - 1];
  const activeEma = activeCandle ? emaByTime.get(activeCandle.time) : undefined;
  const activeChange =
    activeCandle && activeCandle.open > 0
      ? ((activeCandle.close - activeCandle.open) / activeCandle.open) * 100
      : 0;

  const changePct = hist ? hist.changePct : 0;
  const tfMeta = TF_LIST.find((t) => t.id === timeframe) ?? TF_LIST[1];
  const hudDigits = currentPrice >= 1000 ? 2 : priceDigits;

  return (
    <div className={s.chartContainer}>
      {/* Top Bar: Live Price, Window Change, Source Status, and Trading Controls */}
      <div className={s.topBar}>
        <div className={s.priceGroup}>
          <div className={s.currentPrice}>
            {formatPrice(currentPrice > 0 ? currentPrice : activeCandle?.close || 0, priceDigits)}
          </div>
          <span className={`${s.changeBadge} ${changePct >= 0 ? s.changeUp : s.changeDown}`}>
            <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d={changePct >= 0 ? "M2 6.5L5 3.5L8 6.5" : "M2 3.5L5 6.5L8 3.5"} />
            </svg>
            {changePct >= 0 ? "+" : ""}
            {changePct.toFixed(2)}% ({tfMeta.windowLabel})
          </span>
          <span className={s.liveTag}>
            <i className={`${s.liveDot} ${loading ? s.loadingDot : ""}`} />
            {loading ? "Syncing…" : hist?.source === "pyth-pro" ? "Pyth Pro Live" : "Live Market Feed"}
          </span>
          {liqPrice > 0 && (
            <span className={s.liqLegend}>
              <i className={s.liqDot} />
              Liq {formatPrice(liqPrice, priceDigits)}
            </span>
          )}
        </div>

        <div className={s.controls}>
          {/* Real Multi-Timeframe Selector */}
          <div className={s.btnGroup} role="group" aria-label="Timeframe">
            {TF_LIST.map((t) => (
              <button
                key={t.id}
                className={timeframe === t.id ? s.activeBtn : ""}
                onClick={() => onTimeframeChange(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Smooth EMA-9 Overlay Toggle */}
          {chartType === "candles" && (
            <div className={s.btnGroup} role="group" aria-label="Indicator">
              <button
                className={showEma ? s.emaBtnOn : ""}
                onClick={() => setShowEma((v) => !v)}
                title="Toggle Smooth EMA 9 Curve"
              >
                <i className={s.emaDot} />
                <span>EMA 9</span>
              </button>
            </div>
          )}

          {/* Candles vs Smooth Area Toggle */}
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
              title="Smooth Area Chart"
            >
              <LineChartIcon />
              <span>Area</span>
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic OHLC + EMA HUD */}
      <div className={s.hudBar}>
        <div className={s.hudValues}>
          <span className={s.hudTime}>
            {activeCandle ? formatHudTime(activeCandle.time, timeframe) : "--"}
          </span>
          <span>
            O: <b>{activeCandle ? formatPrice(activeCandle.open, hudDigits) : "--"}</b>
          </span>
          <span>
            H: <b>{activeCandle ? formatPrice(activeCandle.high, hudDigits) : "--"}</b>
          </span>
          <span>
            L: <b>{activeCandle ? formatPrice(activeCandle.low, hudDigits) : "--"}</b>
          </span>
          <span>
            C:{" "}
            <b className={activeChange >= 0 ? s.up : s.down}>
              {activeCandle ? formatPrice(activeCandle.close, hudDigits) : "--"}
            </b>
          </span>
          <span>
            Chg:{" "}
            <b className={activeChange >= 0 ? s.up : s.down}>
              {activeChange >= 0 ? "+" : ""}
              {activeChange.toFixed(2)}%
            </b>
          </span>
          {showEma && chartType === "candles" && activeEma !== undefined && (
            <span>
              EMA9: <b className={s.mint}>{formatPrice(activeEma, hudDigits)}</b>
            </span>
          )}
          {hasRealVolume && activeCandle && activeCandle.volume > 0 && (
            <span>
              Vol: <b>{formatVol(activeCandle.volume)}</b>
            </span>
          )}
        </div>
        <div className={s.hudHint}>
          {collSym}/USD
        </div>
      </div>

      {/* 60fps TradingView lightweight-charts Canvas */}
      <div className={s.canvasWrap}>
        <div ref={containerRef} className={s.canvasInner} />
      </div>
    </div>
  );
}
