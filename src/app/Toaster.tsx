"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { txUrl } from "@/lib/chain";
import s from "./toast.module.css";

type Toast = { id: number; kind: "ok" | "err" | "info"; title: string; detail?: string; hash?: string };
type Ctx = { push: (t: Omit<Toast, "id">) => void };

const ToastCtx = createContext<Ctx>({ push: () => {} });
export const useToast = () => useContext(ToastCtx);

let seq = 0;

/** Bottom-right stack of transaction results. Success toasts carry the tx hash as an explorer link (proof). */
export function Toaster({ children }: { children: React.ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = ++seq;
    setList((l) => [{ ...t, id }, ...l].slice(0, 4));
  }, []);
  const close = (id: number) => setList((l) => l.filter((x) => x.id !== id));
  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className={s.stack} aria-live="polite">
        {list.map((t) => <Item key={t.id} t={t} onClose={() => close(t.id)} />)}
      </div>
    </ToastCtx.Provider>
  );
}

function Item({ t, onClose }: { t: Toast; onClose: () => void }) {
  // success proofs stay longer so there's time to open the explorer
  useEffect(() => { const id = setTimeout(onClose, t.kind === "ok" ? 15_000 : 8_000); return () => clearTimeout(id); }, [t.kind, onClose]);
  return (
    <div className={`${s.toast} ${s[t.kind]}`} role={t.kind === "err" ? "alert" : "status"}>
      <i className={s.ico}>{t.kind === "ok" ? "✓" : t.kind === "err" ? "×" : "…"}</i>
      <div className={s.body}>
        <b>{t.title}</b>
        {t.detail && <p>{t.detail}</p>}
        {t.hash && (
          <a href={txUrl(t.hash)} target="_blank" rel="noreferrer" className={s.proof}>
            <span>Proof</span>{t.hash.slice(0, 10)}…{t.hash.slice(-8)}<em>View on explorer ↗</em>
          </a>
        )}
      </div>
      <button className={s.x} onClick={onClose} aria-label="Dismiss">×</button>
      {t.kind === "ok" && <span className={s.timer} />}
    </div>
  );
}
