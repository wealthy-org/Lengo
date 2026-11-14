"use client";
import { useEffect, useRef, useState } from "react";
import s from "./alert.module.css";

/** In-app HF warnings at 1.30 / 1.15 / <1, plus opt-in browser notifications while the app is open. */
const zoneOf = (hf: number) => (hf === Infinity || hf >= 1.3 ? 0 : hf >= 1.15 ? 1 : hf >= 1 ? 2 : 3);
const copy = [
  "",
  "Warning: health factor below 1.30. Consider topping up collateral or repaying.",
  "Danger: health factor below 1.15. A small price move can make this position liquidatable.",
  "Liquidatable: health factor below 1.00. A liquidator can repay up to 50% of your debt now.",
];

export default function HealthAlert({ hf, live }: { hf: number; live: boolean }) {
  const zone = zoneOf(hf);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  const last = useRef<{ zone: number; at: number }>({ zone: 0, at: 0 });

  useEffect(() => {
    setPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  }, []);

  useEffect(() => {
    if (!live || perm !== "granted") return;
    const now = Date.now();
    const worse = zone > last.current.zone;
    const cooled = now - last.current.at > 10 * 60_000;
    if (zone > 0 && (worse || cooled) && (worse || zone !== last.current.zone || cooled)) {
      new Notification("Lengo · position health", { body: `${copy[zone]} HF ${hf.toFixed(2)}`, icon: "/logo-sm.png", tag: "lengo-hf" });
      last.current = { zone, at: now };
    } else if (zone < last.current.zone) {
      last.current = { zone, at: last.current.at };
    }
  }, [zone, hf, live, perm]);

  if (!live && zone === 0) return null;
  return (
    <div className={`${s.bar} ${s["z" + zone]}`} role={zone ? "alert" : undefined}>
      <span className={s.dot} />
      <p>{zone ? copy[zone] : "Position healthy. Alerts trigger at HF 1.30, 1.15 and below 1.00."}</p>
      {perm === "default" && live && <button onClick={() => Notification.requestPermission().then(setPerm)}>Enable browser alerts</button>}
      {perm === "granted" && <em>Browser alerts on · only while this tab is open</em>}
      {perm === "denied" && <em>Browser alerts blocked in site settings</em>}
    </div>
  );
}
