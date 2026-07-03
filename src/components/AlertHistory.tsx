"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { HourlyCapture } from "@/lib/mockHistory";
import { PVA_ABBREV } from "@/lib/mockHistory";
import { PVA_SHORT, SEVERITY_COLORS } from "@/lib/constants";

const BrowserWaveform = dynamic(() => import("./PVABrowserWaveform"), { ssr: false });

// ---- types ----

export interface HourBucket {
  hour: number;
  label: string;
  total: number;
  counts: Record<string, number>;
  dominantSeverity: "Critical" | "Elevated" | "Normal";
}

/** Build stable hourly buckets from seeded captures (not from live alert stream). */
function buildBucketsFromCaptures(captures: HourlyCapture[]): HourBucket[] {
  return captures.map(cap => ({
    hour:   cap.hour,
    label:  `${String(cap.hour).padStart(2, "0")}:00`,
    total:  cap.flags.length,   // 0–4 PVA types per capture
    counts: Object.fromEntries(cap.flags.map(f => [f, 1])),
    dominantSeverity: cap.severity === "Critical" ? "Critical"
                    : cap.severity === "Elevated"  ? "Elevated"
                    : "Normal",
  }));
}

// ---- component ----

interface Props {
  captures: HourlyCapture[];
}

const GREEN_NORMAL = "#34C759";

export default function AlertHistory({ captures }: Props) {
  const [openHour, setOpenHour] = useState<number | null>(null);
  const buckets  = buildBucketsFromCaptures(captures);
  const nowHour  = new Date().getHours();
  const totalPVA = captures.filter(c => c.flags.length > 0).length;

  // Build lookup: hour → capture
  const captureByHour = Object.fromEntries(captures.map(c => [c.hour, c]));

  // Show hours newest→oldest
  const sorted = [
    ...buckets.slice(nowHour + 1).reverse(),
    ...buckets.slice(0, nowHour + 1).reverse(),
  ];

  function toggle(h: number) {
    setOpenHour(prev => (prev === h ? null : h));
  }

  return (
    <div className="v-card rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: "1px solid var(--v-divider)" }}>
        <p className="text-[11px] font-semibold uppercase tracking-widest"
          style={{ color: "var(--v-text-2)" }}>
          24-Hour PVA Timeline
        </p>
        <span className="text-[11px]" style={{ color: "var(--v-text-3)" }}>
          {totalPVA} / 24 captures with PVA
        </span>
      </div>

      {/* Accordion rows — newest hour first */}
      <div style={{ borderTop: "1px solid var(--v-divider)" }}>
        {sorted.map(bucket => {
          const isOpen    = openHour === bucket.hour;
          const isCurrent = bucket.hour === nowHour;
          const hasPVA    = bucket.total > 0;
          const sev       = bucket.dominantSeverity;
          const entries   = Object.entries(bucket.counts).sort(([, a], [, b]) => b - a);
          const capture   = captureByHour[bucket.hour];
          const capHasPVA = capture ? capture.flags.length > 0 : false;

          const abbrev = capture
            ? capture.flags.map(f => PVA_ABBREV[f] ?? f).join("+")
            : "";

          // Row background tint: scaled to severity weight (historical, desaturated)
          const rowBg = !hasPVA ? "transparent"
            : sev === "Critical" && bucket.total >= 3 ? "rgba(255,59,48,0.09)"
            : sev === "Critical"                       ? "rgba(255,59,48,0.05)"
            : sev === "Elevated" && bucket.total >= 2  ? "rgba(255,149,0,0.07)"
            : "rgba(255,149,0,0.03)";

          // Historical tag colors: outline style, not solid fill (reserve solid red for live alarms)
          const tagColor   = sev === "Critical" ? "rgba(255,100,90,0.8)" : "rgba(255,160,50,0.85)";
          const tagBorder  = sev === "Critical" ? "rgba(255,59,48,0.30)" : "rgba(255,149,0,0.28)";
          const tagBg      = sev === "Critical" ? "rgba(255,59,48,0.07)" : "rgba(255,149,0,0.07)";

          return (
            <div key={bucket.hour} style={{ borderBottom: "1px solid var(--v-divider)" }}>
              {/* Row header */}
              <button
                onClick={() => toggle(bucket.hour)}
                style={{
                  width: "100%", display: "flex", alignItems: "center",
                  gap: 12, padding: "10px 20px",
                  background: isOpen
                    ? (hasPVA ? rowBg || "rgba(255,255,255,0.04)" : "rgba(52,199,89,0.05)")
                    : rowBg,
                  border: "none", cursor: "pointer",
                  textAlign: "left",
                  transition: "background 150ms ease",
                }}
              >
                {/* Severity dot — desaturated for historical; green glow for normal */}
                <span style={{
                  width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                  backgroundColor: hasPVA
                    ? (sev === "Critical" ? "rgba(255,100,90,0.85)" : "rgba(255,160,50,0.85)")
                    : GREEN_NORMAL,
                  boxShadow: !hasPVA ? "0 0 6px rgba(52,199,89,0.55)" : undefined,
                }} />

                {/* Time label */}
                <span style={{
                  fontFamily: "Menlo, monospace", fontSize: 11,
                  color: isCurrent ? "var(--v-accent)" : hasPVA ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.35)",
                  minWidth: 44, fontWeight: isCurrent ? 700 : 400,
                }}>
                  {bucket.label}
                  {isCurrent && <span style={{ marginLeft: 4, fontSize: 9, color: "var(--v-accent)" }}>▶</span>}
                </span>

                {/* Content */}
                {hasPVA ? (
                  <div className="flex items-center gap-1.5 flex-1 flex-wrap">
                    {entries.map(([flag]) => (
                      <span key={flag} style={{
                        fontSize: 10, padding: "1px 6px", borderRadius: 5,
                        fontWeight: 600,
                        background: tagBg,
                        color: tagColor,
                        border: `1px solid ${tagBorder}`,
                      }}>
                        {PVA_SHORT[flag] ?? flag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span style={{ fontSize: 11, flex: 1, color: GREEN_NORMAL, opacity: 0.55 }}>
                    Normal
                  </span>
                )}

                {/* Chevron */}
                <span style={{
                  fontSize: 10, color: "rgba(255,255,255,0.25)",
                  transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 200ms ease",
                  flexShrink: 0,
                }}>▾</span>
              </button>

              {/* Static 10-second capture waveform */}
              {isOpen && capture && (
                <div style={{
                  padding: "0 10px 14px",
                  background: capHasPVA ? "rgba(0,0,0,0.25)" : "rgba(52,199,89,0.03)",
                  borderTop: "1px solid rgba(255,255,255,0.04)",
                }}>
                  <p style={{
                    fontSize: 10, padding: "8px 4px 6px",
                    color: capHasPVA ? "rgba(255,255,255,0.3)" : "rgba(52,199,89,0.55)",
                  }}>
                    {capHasPVA
                      ? `PVA capture · ${bucket.label} · ${abbrev} · 10s at 25 Hz`
                      : `Normal capture · ${bucket.label} · no PVA · 10s at 25 Hz`}
                  </p>
                  <BrowserWaveform
                    waveformData={capture.waveformData}
                    pvaBands={capture.pvaBands}
                    flagAbbrev={abbrev}
                    flags={capture.flags}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
