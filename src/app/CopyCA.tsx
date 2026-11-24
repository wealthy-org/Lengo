"use client";
import { useState } from "react";
import s from "./landing.module.css";

export default function CopyCA({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(address);
    } catch {
      const el = document.createElement("textarea");
      el.value = address;
      el.setAttribute("readonly", "");
      el.style.position = "absolute";
      el.style.left = "-9999px";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      className={`${s.ca} ${copied ? s.caCopied : ""}`}
      title="Copy contract address"
      aria-label={`Copy contract address ${address}`}
    >
      <span className={s.caTag}>TOKEN CA</span>
      <code className={s.caAddr}>{address}</code>
      <em className={s.caAction}>
        {copied ? (
          <>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            COPIED
          </>
        ) : (
          <>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <rect x="9" y="9" width="13" height="13" rx="1" />
              <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
            </svg>
            COPY
          </>
        )}
      </em>
    </button>
  );
}
