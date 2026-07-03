"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import type { HourlyCapture } from "@/lib/mockHistory";
import { PVA_ABBREV } from "@/lib/mockHistory";
import { PVA_LABELS, WAVEFORM_COLORS } from "@/lib/constants";

const BrowserWaveform = dynamic(() => import("./PVABrowserWaveform"), { ssr: false });

interface PVABrowserProps {
  captures: HourlyCapture[];
  totalCaptures: number;
}

export default function PVABrowser({ captures, totalCaptures }: PVABrowserProps) {
  const pvaCaptures = captures.filter(c => c.flags.length > 0);
  const [idx, setIdx] = useState(() => Math.max(0, pvaCaptures.length - 1));
  const containerRef = useRef<HTMLDivElement>(null);

  const safeIdx = Math.min(Math.max(0, idx), Math.max(0, pvaCaptures.length - 1));

  const go = useCallback((delta: number) => {
    setIdx(i => Math.max(0, Math.min(pvaCaptures.length - 1, i + delta)));
  }, [pvaCaptures.length]);

  // Arrow-key navigation when the card has focus
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft")  { e.preventDefault(); go(-1); }
      if (e.key === "ArrowRight") { e.preventDefault(); go(+1); }
    }
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [go]);

  if (pvaCaptures.length === 0) {
    return (
      <div
        className="v-card rounded-2xl flex items-center justify-center"
        style={{ minHeight: 320, background: WAVEFORM_COLORS.background }}
      >
        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>No PVA detected in last 24h</p>
      </div>
    );
  }

  const cap       = pvaCaptures[safeIdx];
  const capDate   = new Date(cap.timestampS * 1000);
  const timeStr   = capDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const dateStr   = capDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  const hourLabel = `${String(cap.hour).padStart(2, "0")}:00`;
  const flagAbbrev = cap.flags.map(f => PVA_ABBREV[f] ?? f.toUpperCase()).join("+");

  const prevDisabled = safeIdx === 0;
  const nextDisabled = safeIdx === pvaCaptures.length - 1;

  // Model confidence — styled distinctly from vital signs
  const confPct = Math.round(cap.confidence * 100);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="v-card rounded-2xl overflow-hidden"
      style={{
        background: WAVEFORM_COLORS.background,
        outline: "none",
      }}
      onFocus={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 0 2px rgba(10,132,255,0.4)"; }}
      onBlur={e  => { (e.currentTarget as HTMLDivElement).style.boxShadow = ""; }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-3">
          <span style={{ fontSize: 12, fontWeight: 700, color: "#F5F5F7" }}>PVA Capture Browser</span>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
            {pvaCaptures.length} / {totalCaptures} with PVA · 24h
          </span>
        </div>

        {/* Navigation — minimum 44×44px touch targets */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button
            onClick={() => go(-1)}
            disabled={prevDisabled}
            aria-label="Previous capture"
            style={navBtn(prevDisabled)}
          >
            ‹
          </button>
          <span style={{
            fontSize: 12, fontWeight: 600,
            color: "rgba(255,255,255,0.55)",
            minWidth: 52, textAlign: "center",
            fontFamily: "Menlo, monospace",
          }}>
            {safeIdx + 1} / {pvaCaptures.length}
          </span>
          <button
            onClick={() => go(+1)}
            disabled={nextDisabled}
            aria-label="Next capture"
            style={navBtn(nextDisabled)}
          >
            ›
          </button>
        </div>
      </div>

      {/* Metadata row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "14px 20px 10px" }}>
        <div>
          {/* Hour + flag chips */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <span style={{
              fontFamily: "Menlo, monospace",
              fontSize: 10, fontWeight: 600,
              color: "rgba(255,255,255,0.35)",
              background: "rgba(255,255,255,0.05)",
              padding: "2px 8px", borderRadius: 6,
            }}>
              {hourLabel}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 700,
              color: "#FF9500",
              background: "rgba(255,149,0,0.10)",
              padding: "2px 8px", borderRadius: 6,
              border: "1px solid rgba(255,149,0,0.28)",
            }}>
              {flagAbbrev}
            </span>
          </div>

          {/* PVA type names */}
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {cap.flags.map(f => (
              <p key={f} style={{ fontSize: 14, fontWeight: 600, color: "#F5F5F7", lineHeight: 1.3 }}>
                {PVA_LABELS[f] ?? f}
              </p>
            ))}
          </div>

          <span style={{ fontFamily: "Menlo, monospace", fontSize: 10, color: "rgba(255,255,255,0.28)", marginTop: 5, display: "block" }}>
            {dateStr} {timeStr} · 10s · 25 Hz
          </span>
        </div>

        {/* Right: model confidence (visually distinct from vitals %) */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
          {/* Confidence: labelled "MODEL CONF." in accent blue, not severity-colored */}
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.07em", color: "rgba(10,132,255,0.6)", textTransform: "uppercase", marginBottom: 2 }}>
              Model conf.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 36, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${confPct}%`, borderRadius: 2, background: "#0A84FF" }} />
              </div>
              <span style={{ fontFamily: "Menlo, monospace", fontSize: 12, fontWeight: 700, color: "#0A84FF" }}>
                {confPct}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Waveform */}
      <div style={{ padding: "0 12px 16px" }}>
        <BrowserWaveform
          waveformData={cap.waveformData}
          pvaBands={cap.pvaBands}
          flagAbbrev={flagAbbrev}
          flags={cap.flags}
        />
      </div>

      {/* Footer: keyboard shortcut hint */}
      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.05)",
          padding: "7px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.18)" }}>
          Breath 1: normal context · Breaths 2–3: PVA highlighted
        </span>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.22)", fontFamily: "Menlo, monospace" }}>
          Click to focus · ← / → to navigate
        </span>
      </div>
    </div>
  );
}

function navBtn(disabled: boolean): React.CSSProperties {
  return {
    width: 44, height: 44, borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.10)",
    background: disabled ? "transparent" : "rgba(255,255,255,0.06)",
    color: disabled ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.75)",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
    transition: "background 150ms ease",
  };
}
