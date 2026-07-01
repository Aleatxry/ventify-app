"use client";

import type { LabelMatrixRow, LFVote } from "@/types/demo";
import { PVA_LABELS } from "@/lib/constants";

interface SnorkelSectionProps {
  matrix: LabelMatrixRow[];
  onNext: () => void;
  processing: boolean;
}

const LF_DEFS = [
  { key: "lf_double_trigger"    as const, name: "Double Trigger",     rule: "Second positive flow peak detected after primary peak decays" },
  { key: "lf_ineffective_effort" as const, name: "Ineffective Effort", rule: "Pressure dip >4 cmH₂O during expiration with peak flow <20 L/min" },
  { key: "lf_flow_starvation"   as const, name: "Flow Starvation",    rule: "End-inspiration flow >65% of peak (not tapering normally)" },
  { key: "lf_premature_cycling" as const, name: "Premature Cycling",  rule: "Expiration time <0.85 s (breath terminated too early)" },
];

function VoteChip({ vote }: { vote: LFVote }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 24, height: 24, borderRadius: 6, fontSize: 11, fontWeight: 700,
      background: vote === 1 ? "var(--v-critical-pale)" : "var(--v-surface-raised)",
      color:      vote === 1 ? "var(--v-critical)"      : "var(--v-text-3)",
    }}>
      {vote === 1 ? "✓" : "—"}
    </span>
  );
}

function LabelChip({ label }: { label: LabelMatrixRow["finalLabel"] }) {
  const isPVA = label !== "Normal";
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99,
      background: isPVA ? "var(--v-critical-pale)" : "var(--v-normal-pale)",
      color:      isPVA ? "var(--v-critical)"      : "var(--v-normal)",
      whiteSpace: "nowrap",
    }}>
      {isPVA ? (PVA_LABELS[label] ?? label) : "Normal"}
    </span>
  );
}

export default function SnorkelSection({ matrix, onNext, processing }: SnorkelSectionProps) {
  const pvaCount = matrix.filter(r => r.finalLabel !== "Normal").length;

  return (
    <div className="animate-fade-up v-card" style={{ padding: 24, borderRadius: 20 }}>
      <div style={{ marginBottom: 20 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--v-elevated)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          ④ Snorkel — Programmatic Labeling
        </span>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--v-text-1)", margin: "4px 0" }}>
          {pvaCount} / {matrix.length} breaths flagged as PVA
        </h3>
        <p style={{ fontSize: 13, color: "var(--v-text-2)" }}>
          4 expert-defined labeling functions vote independently — first positive vote wins
        </p>
      </div>

      {/* LF rule cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginBottom: 24 }}>
        {LF_DEFS.map((lf, i) => {
          const fires = matrix.filter(r => r[lf.key] === 1).length;
          return (
            <div key={lf.key} style={{ background: "var(--v-surface-raised)", borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--v-text-3)" }}>LF{i + 1}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--v-text-1)" }}>{lf.name}</span>
                <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: fires > 0 ? "var(--v-critical)" : "var(--v-text-3)" }}>
                  {fires}×
                </span>
              </div>
              <p style={{ fontSize: 11, color: "var(--v-text-2)", lineHeight: 1.5 }}>{lf.rule}</p>
            </div>
          );
        })}
      </div>

      {/* Label matrix */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--v-divider)" }}>
              <th style={{ padding: "6px 12px", textAlign: "left",  fontSize: 10, fontWeight: 700, color: "var(--v-text-3)", textTransform: "uppercase" }}>Breath</th>
              {LF_DEFS.map((lf, i) => (
                <th key={lf.key} style={{ padding: "6px 12px", textAlign: "center", fontSize: 10, fontWeight: 700, color: "var(--v-text-3)", textTransform: "uppercase", whiteSpace: "nowrap" }}>LF{i+1}</th>
              ))}
              <th style={{ padding: "6px 12px", textAlign: "center", fontSize: 10, fontWeight: 700, color: "var(--v-text-3)", textTransform: "uppercase" }}>Label</th>
              <th style={{ padding: "6px 12px", textAlign: "right",  fontSize: 10, fontWeight: 700, color: "var(--v-text-3)", textTransform: "uppercase" }}>Conf.</th>
            </tr>
          </thead>
          <tbody>
            {matrix.map(row => (
              <tr
                key={row.breathIdx}
                className={row.finalLabel !== "Normal" ? "animate-slide-in" : ""}
                style={{ borderBottom: "1px solid var(--v-divider)", background: row.finalLabel !== "Normal" ? "var(--v-critical-pale)" : "transparent" }}
              >
                <td style={{ padding: "8px 12px", fontFamily: "Menlo, monospace", fontWeight: 600, color: "var(--v-text-1)" }}>#{row.breathIdx + 1}</td>
                {LF_DEFS.map(lf => (
                  <td key={lf.key} style={{ padding: "8px 12px", textAlign: "center" }}>
                    <VoteChip vote={row[lf.key]} />
                  </td>
                ))}
                <td style={{ padding: "8px 12px", textAlign: "center" }}>
                  <LabelChip label={row.finalLabel} />
                </td>
                <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "Menlo, monospace", fontSize: 12, color: "var(--v-text-2)" }}>
                  {Math.round(row.confidence * 100)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
