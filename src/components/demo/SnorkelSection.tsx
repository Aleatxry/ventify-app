"use client";

import type { LabelMatrixRow, PVALabel } from "@/types/demo";
import { PVA_LABELS } from "@/lib/constants";

interface SnorkelSectionProps {
  matrix: LabelMatrixRow[];
  onNext: () => void;
  processing: boolean;
}

const CLASS_CONFIG: Record<PVALabel, { color: string; bg: string; short: string }> = {
  Normal:              { color: "var(--v-normal)",   bg: "var(--v-normal-pale)",   short: "Normal" },
  flow_starvation:     { color: "var(--v-critical)", bg: "var(--v-critical-pale)", short: "Flow Starv." },
  double_trigger:      { color: "#e07d10",            bg: "#fff7ed",                short: "Double Trig." },
  premature_cycling:   { color: "#7c3aed",            bg: "#f5f3ff",                short: "Premature Cyc." },
  ineffective_effort:  { color: "#0369a1",            bg: "#f0f9ff",                short: "Ineffective Eff." },
};

const LF_LABELS: Record<string, string> = {
  lf_dt_short_insp_high_ie:         "iTime < 0.5s และ IE > 0.7",
  lf_dt_very_short_insp_high_flow:  "iTime < 0.35s และ peakFlow > 50",
  lf_fs_end_flow_ratio:             "flowEnd/peak > 40% และ iTime > 0.4s",
  lf_fs_high_absolute_end_flow:     "flowEnd > 30 L/min และ iTime > 0.5s",
  lf_fs_prolonged_insp_with_flow:   "iTime > 0.8s และ flowEnd > 20",
  lf_pc_short_exp_high_ie:          "eTime < 0.8s และ IE > 0.5",
  lf_pc_very_high_ie_ratio:         "IE > 0.8 และ eTime < 1.0s",
  lf_ie_low_vt_with_effort:         "VT < 200 mL และ iTime > 0.3s",
  lf_ie_very_low_vt:                "VT < 100 mL",
};

const CLASS_ORDER: PVALabel[] = [
  "flow_starvation", "double_trigger", "premature_cycling", "ineffective_effort", "Normal",
];

function ProbBar({ label, prob }: { label: PVALabel; prob: number }) {
  const cfg = CLASS_CONFIG[label];
  if (prob === 0) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: cfg.color, width: 92, flexShrink: 0 }}>
        {cfg.short}
      </span>
      <div style={{ flex: 1, height: 6, borderRadius: 99, background: "var(--v-divider)", overflow: "hidden" }}>
        <div style={{ width: `${Math.round(prob * 100)}%`, height: "100%", borderRadius: 99, background: cfg.color, transition: "width 400ms ease" }} />
      </div>
      <span style={{ fontSize: 10, fontFamily: "Menlo, monospace", color: cfg.color, width: 30, textAlign: "right" }}>
        {Math.round(prob * 100)}%
      </span>
    </div>
  );
}

function BreathRow({ row }: { row: LabelMatrixRow }) {
  const cfg = CLASS_CONFIG[row.finalLabel];
  const hasVotes = row.firedLFs.length > 0;

  return (
    <div style={{
      borderRadius: 12, padding: "12px 14px", marginBottom: 8,
      background: row.isUncertain ? "#fffbeb" : row.finalLabel !== "Normal" ? cfg.bg : "var(--v-surface-raised)",
      border: row.isUncertain ? "1px solid #fbbf24" : "1px solid transparent",
    }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: hasVotes ? 10 : 0 }}>
        <span style={{ fontSize: 12, fontFamily: "Menlo, monospace", fontWeight: 700, color: "var(--v-text-1)", minWidth: 28 }}>
          #{row.breathIdx + 1}
        </span>

        {row.isUncertain && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 6, background: "#fef3c7", color: "#92400e" }}>
            ⚠ ไม่ชัดเจน — ให้แพทย์ยืนยัน
          </span>
        )}

        <span style={{
          marginLeft: "auto", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
          background: cfg.bg, color: cfg.color,
        }}>
          {row.finalLabel === "Normal" ? "Normal" : (PVA_LABELS[row.finalLabel] ?? row.finalLabel)}
        </span>
      </div>

      {/* Probability bars */}
      {hasVotes && (
        <div style={{ marginBottom: 8 }}>
          {CLASS_ORDER.map(cls => (
            <ProbBar key={cls} label={cls} prob={row.classProbabilities[cls] ?? 0} />
          ))}
        </div>
      )}

      {/* Fired LFs */}
      {row.firedLFs.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {row.firedLFs.map(name => (
            <span key={name} style={{
              fontSize: 10, padding: "2px 7px", borderRadius: 6,
              background: "var(--v-surface-raised)", color: "var(--v-text-2)", border: "1px solid var(--v-divider)",
            }}>
              {LF_LABELS[name] ?? name}
            </span>
          ))}
        </div>
      )}

      {!hasVotes && (
        <p style={{ fontSize: 11, color: "var(--v-text-3)", margin: 0 }}>ไม่มี rule fire — Normal</p>
      )}
    </div>
  );
}

export default function SnorkelSection({ matrix, onNext, processing }: SnorkelSectionProps) {
  const pvaCount      = matrix.filter(r => r.finalLabel !== "Normal").length;
  const uncertainCount = matrix.filter(r => r.isUncertain).length;

  return (
    <div className="animate-fade-up v-card" style={{ padding: 24, borderRadius: 20 }}>
      <div style={{ marginBottom: 20 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--v-elevated)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          ④ Labeling Functions — Weak Supervision
        </span>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--v-text-1)", margin: "4px 0" }}>
          {pvaCount} / {matrix.length} breaths น่าสงสัย
          {uncertainCount > 0 && (
            <span style={{ marginLeft: 10, fontSize: 13, fontWeight: 600, color: "#92400e" }}>
              ⚠ {uncertainCount} breath ที่ควรให้แพทย์ยืนยัน
            </span>
          )}
        </h3>
        <p style={{ fontSize: 13, color: "var(--v-text-2)" }}>
          แต่ละ breath แสดงโอกาสที่จะเป็น PVA แต่ละประเภท — ไม่ใช่การวินิจฉัย ให้แพทย์พิจารณาร่วม
        </p>
      </div>

      <div>
        {matrix.map(row => <BreathRow key={row.breathIdx} row={row} />)}
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
          }}
        >
          {processing ? "Finalizing…" : "View Results →"}
        </button>
      </div>
    </div>
  );
}
