"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { HourlyCapture } from "@/lib/mockHistory";
import { PVA_ABBREV } from "@/lib/mockHistory";
import { PVA_SHORT } from "@/lib/constants";

const BrowserWaveform = dynamic(() => import("./PVABrowserWaveform"), { ssr: false });

interface Props {
  captures: HourlyCapture[];
}

const GREEN_NORMAL = "#34C759";

function formatCaptureTime(timestampS: number, allCaptures: HourlyCapture[]): string {
  const d = new Date(timestampS * 1000);
  const timeStr = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  // Show date too if captures span multiple calendar days
  const first = new Date(allCaptures[0].timestampS * 1000);
  const last  = new Date(allCaptures[allCaptures.length - 1].timestampS * 1000);
  const multiDay = last.getDate() !== first.getDate()
    || last.getMonth() !== first.getMonth();
  if (multiDay) {
    const dateStr = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
    return `${dateStr} ${timeStr}`;
  }
  return timeStr;
}

export default function AlertHistory({ captures }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  // Newest capture first
  const sorted = [...captures].sort((a, b) => b.timestampS - a.timestampS);
  const totalPVA = captures.filter(c => c.flags.length > 0).length;

  function toggle(id: string) {
    setOpenId(prev => (prev === id ? null : id));
  }

  return (
    <div className="v-card rounded-2xl overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: "1px solid var(--v-divider)" }}
      >
        <p
          className="text-[11px] font-semibold uppercase tracking-widest"
          style={{ color: "var(--v-text-2)" }}
        >
          Capture Timeline
        </p>
        <span className="text-[11px]" style={{ color: "var(--v-text-3)" }}>
          {totalPVA} / {captures.length} with PVA
        </span>
      </div>

      {/* Capture rows — newest first */}
      <div style={{ borderTop: "1px solid var(--v-divider)" }}>
        {sorted.map(cap => {
          const isOpen  = openId === cap.id;
          const hasPVA  = cap.flags.length > 0;
          const sev     = cap.severity;
          const abbrev  = cap.flags.map(f => PVA_ABBREV[f] ?? f).join("+");
          const timeLabel = formatCaptureTime(cap.timestampS, captures);

          const rowBg = !hasPVA ? "transparent"
            : sev === "Critical" && cap.flags.length >= 2 ? "rgba(255,59,48,0.09)"
            : sev === "Critical"                          ? "rgba(255,59,48,0.05)"
            : cap.flags.length >= 2                       ? "rgba(255,149,0,0.07)"
            : "rgba(255,149,0,0.03)";

          const tagColor  = sev === "Critical" ? "rgba(255,100,90,0.8)" : "rgba(255,160,50,0.85)";
          const tagBorder = sev === "Critical" ? "rgba(255,59,48,0.30)" : "rgba(255,149,0,0.28)";
          const tagBg     = sev === "Critical" ? "rgba(255,59,48,0.07)" : "rgba(255,149,0,0.07)";

          return (
            <div key={cap.id} style={{ borderBottom: "1px solid var(--v-divider)" }}>
              <button
                onClick={() => toggle(cap.id)}
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
                {/* Severity dot */}
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
                  color: hasPVA ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.35)",
                  minWidth: 70, fontWeight: 400,
                }}>
                  {timeLabel}
                </span>

                {/* PVA flag chips or Normal */}
                {hasPVA ? (
                  <div className="flex items-center gap-1.5 flex-1 flex-wrap">
                    {cap.flags.map(flag => (
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

              {/* Expanded waveform */}
              {isOpen && (
                <div style={{
                  padding: "0 10px 14px",
                  background: hasPVA ? "rgba(0,0,0,0.25)" : "rgba(52,199,89,0.03)",
                  borderTop: "1px solid rgba(255,255,255,0.04)",
                }}>
                  <p style={{
                    fontSize: 10, padding: "8px 4px 6px",
                    color: hasPVA ? "rgba(255,255,255,0.3)" : "rgba(52,199,89,0.55)",
                  }}>
                    {hasPVA
                      ? `PVA · ${timeLabel} · ${abbrev} · 10s @ 25 Hz`
                      : `Normal · ${timeLabel} · no PVA · 10s @ 25 Hz`}
                  </p>
                  <BrowserWaveform
                    waveformData={cap.waveformData}
                    pvaBands={cap.pvaBands}
                    flagAbbrev={abbrev}
                    flags={cap.flags}
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
