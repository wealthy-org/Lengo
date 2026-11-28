"use client";
import { useEffect, useState } from "react";
import type { HarmonicSessionItem } from "@/app/api/oracle/session/route";

export function useHarmonicSessions() {
  const [sessions, setSessions] = useState<Record<string, HarmonicSessionItem>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/oracle/session");
        if (!res.ok) return;
        const j = await res.json();
        if (!cancelled && j?.ok && j?.sessions) {
          setSessions(j.sessions);
        }
      } catch {
        // ignore transient errors
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return { sessions, loading };
}
