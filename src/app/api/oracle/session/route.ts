import { NextResponse } from "next/server";

const HARMONIC_SESSION_URL = "https://harmonicagent.solutions/api/keeper/session?tokens=NVDA,TSLA,AAPL";

export type HarmonicSessionItem = {
  symbol: string;
  token: string;
  canExec: boolean;
  verdict: "open" | "closed" | "halted" | "weekend" | "unknown";
  label: string;
  shortLabel: string;
  reason: string;
  rowAt: string;
  ageSec: number;
  quoteAgeSec: number;
  block: number;
  source: string;
  endpointUrl: string;
};

function formatVerdictLabel(verdict: string, canExec: boolean): { label: string; shortLabel: string } {
  if (verdict === "halted") return { label: "Market Halted", shortLabel: "Halted" };
  if (verdict === "open" && canExec) return { label: "Market Open", shortLabel: "Market Open" };
  if (verdict === "weekend") return { label: "Market Closed · Weekend", shortLabel: "Weekend Hold" };
  if (verdict === "closed") return { label: "Market Closed", shortLabel: "Market Closed" };
  return { label: canExec ? "Market Open" : "Market Closed", shortLabel: canExec ? "Market Open" : "Market Closed" };
}

function formatCleanReason(verdict: string, canExec: boolean, raw: string): string {
  const isoMatch = raw.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?Z/);
  let untilStr = "";
  if (isoMatch) {
    const d = new Date(isoMatch[0]);
    if (!Number.isNaN(d.getTime())) {
      untilStr = d.toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "UTC",
      }) + " UTC";
    }
  }
  if (verdict === "halted") {
    return "Trading halted by exchange session feed. Oracle price is frozen until resumption.";
  }
  if (verdict === "weekend") {
    return untilStr
      ? `24/5 equity session paused until ${untilStr}. Oracle holds last closing price.`
      : "24/5 equity session paused for weekend hold. Oracle holds last closing price.";
  }
  if (!canExec || verdict === "closed") {
    return untilStr
      ? `US market session closed until ${untilStr}. Oracle holds last session price.`
      : "US market session is currently closed. Oracle holds last closing print.";
  }
  return "Live 24/5 equity session active on Robinhood Chain.";
}

export async function GET() {
  try {
    const res = await fetch(HARMONIC_SESSION_URL, {
      headers: { accept: "application/json" },
      next: { revalidate: 30 },
    });
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `Upstream HTTP ${res.status}` }, { status: 502 });
    }
    const data = await res.json();
    const answers = Array.isArray(data?.answers) ? data.answers : [];
    const sessions: Record<string, HarmonicSessionItem> = {};
    const nowMs = Date.now();

    for (const a of answers) {
      if (!a?.symbol) continue;
      const sym = String(a.symbol).toUpperCase();
      const verdict = (a.verdict || "unknown") as HarmonicSessionItem["verdict"];
      const canExec = Boolean(a.canExec);
      const { label, shortLabel } = formatVerdictLabel(verdict, canExec);
      const rowAt = a.rowAt || a.at || new Date().toISOString();
      const computedAge = Math.max(0, Math.round((nowMs - new Date(rowAt).getTime()) / 1000));
      sessions[sym] = {
        symbol: sym,
        token: String(a.token || ""),
        canExec,
        verdict,
        label,
        shortLabel,
        reason: formatCleanReason(verdict, canExec, String(a.reason || a.rows?.oracle?.why || "")),
        rowAt,
        ageSec: typeof a.ageSec === "number" ? a.ageSec : computedAge,
        quoteAgeSec: typeof a.quoteAgeSec === "number" ? a.quoteAgeSec : computedAge,
        block: Number(a.block || a.rows?.chain?.block || 0),
        source: String(a.source || "HarmonicOracle"),
        endpointUrl: `https://harmonicagent.solutions/api/keeper/session/${sym}`,
      };
    }

    return NextResponse.json({
      ok: true,
      at: data?.at || new Date().toISOString(),
      upstream: HARMONIC_SESSION_URL,
      riskFeedContract: "0xd91e56a9999974a1319150cd6fa00bc87cc2d91d",
      sessions,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message || "Failed to reach Harmonic session oracle" },
      { status: 502 }
    );
  }
}
