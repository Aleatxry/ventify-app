"use client";

import dynamic from "next/dynamic";
import type { CsvWaveformPoint } from "@/types/demo";

const StaticWaveformChart = dynamic(() => import("./StaticWaveformChart"), { ssr: false });

interface RawSectionProps {
  data: CsvWaveformPoint[];
  meta: { hz: number; hasTime: boolean; columns: string[] } | null;
  onNext: () => void;
  processing: boolean;
}

export default function RawSection({ data, meta, onNext, processing }: RawSectionProps) {
  const durationS = data.length > 0 ? (data[data.length - 1].time - data[0].time).toFixed(1) : "0";

  return (
    <div className="animate-fade-up v-card" style={{ padding: 24, borderRadius: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--v-accent)", textTransform: "uppercase", letterSpacing: "0.1em" }}>① Raw Waveform</span>
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--v-text-1)", marginBottom: 4 }}>
            Unprocessed ventilator signal
          </h3>
          <p style={{ fontSize: 13, color: "var(--v-text-2)" }}>
            {data.length.toLocaleString()} samples · {meta?.hz ?? "?"} Hz · {durationS}s
          </p>
          {meta && !meta.hasTime && (
            <p style={{ fontSize: 11, color: "var(--v-elevated)", marginTop: 4 }}>
              ⚠ No time column detected — time axis synthesized at {meta.hz} Hz
            </p>
          )}
          {meta?.columns && (
            <p style={{ fontSize: 11, color: "var(--v-text-3)", marginTop: 2 }}>
              Columns: {meta.columns.join(" · ")}
            </p>
          )}
        </div>
      </div>

      <StaticWaveformChart data={data} />

      <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={onNext}
          disabled={processing}
          style={{
            padding: "10px 20px",
            borderRadius: 10,
            border: "none",
            background: processing ? "var(--v-surface-raised)" : "var(--v-accent)",
            color: processing ? "var(--v-text-3)" : "#fff",
            fontSize: 14,
            fontWeight: 600,
            cursor: processing ? "not-allowed" : "pointer",
            transition: "all 200ms ease",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {processing ? (
            <>
              <svg className="animate-live-dot" width="8" height="8" viewBox="0 0 8 8" fill="none">
                <circle cx="4" cy="4" r="4" fill="var(--v-accent)"/>
              </svg>
              Segmenting breaths…
            </>
          ) : "Segment Breaths →"}
        </button>
      </div>
    </div>
  );
}
