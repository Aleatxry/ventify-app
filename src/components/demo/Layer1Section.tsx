"use client";

import dynamic from "next/dynamic";
import type { CsvWaveformPoint, DetectedBreath } from "@/types/demo";

const StaticWaveformChart = dynamic(() => import("./StaticWaveformChart"), { ssr: false });

interface Layer1SectionProps {
  data: CsvWaveformPoint[];
  breaths: DetectedBreath[];
  onNext: () => void;
  processing: boolean;
}

export default function Layer1Section({ data, breaths, onNext, processing }: Layer1SectionProps) {
  return (
    <div className="animate-fade-up v-card" style={{ padding: 24, borderRadius: 20 }}>
      <div style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--v-elevated)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          ② Layer 1 — Breath Segmentation
        </span>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--v-text-1)", margin: "4px 0" }}>
          {breaths.length} breath cycles detected
        </h3>
        <p style={{ fontSize: 13, color: "var(--v-text-2)" }}>
          Zero-crossing detection on Flow signal (threshold 2 L/min) — shaded bands show individual breath boundaries
        </p>
      </div>

      <StaticWaveformChart data={data} breaths={breaths} />

      {/* Breath metrics table */}
      <div style={{ marginTop: 20, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--v-divider)" }}>
              {["Breath", "Start (s)", "End (s)", "Duration (s)", "Est. VT (mL)"].map(h => (
                <th key={h} style={{ padding: "6px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--v-text-3)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {breaths.slice(0, 8).map(b => {
              const slice   = data.slice(b.startIdx, b.endIdx + 1);
              const volVals = slice.map(p => p.volume);
              const vtEst   = (Math.max(...volVals) - Math.min(...volVals)).toFixed(0);
              return (
                <tr key={b.idx} style={{ borderBottom: "1px solid var(--v-divider)" }}>
                  <td style={{ padding: "8px 12px", fontWeight: 600, color: "var(--v-text-1)", fontFamily: "Menlo, monospace" }}>#{b.idx + 1}</td>
                  <td style={{ padding: "8px 12px", color: "var(--v-text-2)", fontFamily: "Menlo, monospace" }}>{b.startTime.toFixed(2)}</td>
                  <td style={{ padding: "8px 12px", color: "var(--v-text-2)", fontFamily: "Menlo, monospace" }}>{b.endTime.toFixed(2)}</td>
                  <td style={{ padding: "8px 12px", color: "var(--v-text-2)", fontFamily: "Menlo, monospace" }}>{b.duration.toFixed(2)}</td>
                  <td style={{ padding: "8px 12px", color: "var(--v-text-1)", fontFamily: "Menlo, monospace" }}>{vtEst}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {breaths.length > 8 && (
          <p style={{ fontSize: 11, color: "var(--v-text-3)", marginTop: 6, paddingLeft: 12 }}>
            + {breaths.length - 8} more breaths
          </p>
        )}
      </div>

      <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={onNext}
          disabled={processing}
          style={{
            padding: "10px 20px", borderRadius: 10, border: "none",
            background: processing ? "var(--v-surface-raised)" : "var(--v-accent)",
            color: processing ? "var(--v-text-3)" : "#fff",
            fontSize: 14, fontWeight: 600,
            cursor: processing ? "not-allowed" : "pointer",
            transition: "all 200ms ease",
            display: "flex", alignItems: "center", gap: 8,
          }}
        >
          {processing ? "Extracting features…" : "Extract Features →"}
        </button>
      </div>
    </div>
  );
}
