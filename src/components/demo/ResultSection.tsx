"use client";

import type { LabelMatrixRow } from "@/types/demo";
import { PVA_LABELS } from "@/lib/constants";
import AlertBadge from "@/components/AlertBadge";

interface ResultSectionProps {
  matrix: LabelMatrixRow[];
  onReset: () => void;
}

const PVA_KEYS = ["double_trigger", "ineffective_effort", "flow_starvation", "premature_cycling"] as const;

export default function ResultSection({ matrix, onReset }: ResultSectionProps) {
  const normal = matrix.filter(r => r.finalLabel === "Normal").length;
  const pva    = matrix.length - normal;

  const typeCounts = Object.fromEntries(
    PVA_KEYS.map(k => [k, matrix.filter(r => r.finalLabel === k).length])
  );

  return (
    <div className="animate-fade-up v-card" style={{ padding: 24, borderRadius: 20 }}>
      <div style={{ marginBottom: 20 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--v-normal)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          ⑤ Classification Results
        </span>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--v-text-1)", margin: "4px 0" }}>
          Pipeline complete
        </h3>
        <p style={{ fontSize: 13, color: "var(--v-text-2)" }}>
          {matrix.length} breaths analyzed · {pva} PVA events detected ({Math.round(pva / matrix.length * 100)}%)
        </p>
      </div>

      {/* Summary tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Total Breaths", value: matrix.length, color: "var(--v-text-1)" },
          { label: "Normal",        value: normal,         color: "var(--v-normal)" },
          { label: "PVA Events",    value: pva,            color: pva > 0 ? "var(--v-critical)" : "var(--v-text-1)" },
        ].map(t => (
          <div key={t.label} style={{ background: "var(--v-surface-raised)", borderRadius: 14, padding: "16px 20px" }}>
            <p style={{ fontSize: 11, color: "var(--v-text-2)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{t.label}</p>
            <p style={{ fontSize: 36, fontWeight: 700, color: t.color, fontFamily: "Menlo, monospace" }}>{t.value}</p>
          </div>
        ))}
      </div>

      {/* PVA type breakdown */}
      {pva > 0 && (
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--v-text-2)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>PVA Type Breakdown</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {PVA_KEYS.filter(k => typeCounts[k] > 0).map(k => {
              const pct = Math.round(typeCounts[k] / matrix.length * 100);
              return (
                <div key={k}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: "var(--v-text-1)" }}>{PVA_LABELS[k]}</span>
                    <span style={{ fontSize: 12, fontFamily: "Menlo, monospace", color: "var(--v-critical)" }}>{typeCounts[k]} breaths</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: "var(--v-surface-raised)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: "var(--v-critical)", borderRadius: 3, transition: "width 600ms ease" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Per-breath result table */}
      <div style={{ overflowX: "auto", marginBottom: 20 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--v-divider)" }}>
              {["Breath", "Classification", "Confidence", "Severity"].map(h => (
                <th key={h} style={{ padding: "6px 12px", textAlign: h === "Confidence" || h === "Severity" ? "center" : "left", fontSize: 10, fontWeight: 700, color: "var(--v-text-3)", textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map(row => {
              const isPVA = row.finalLabel !== "Normal";
              return (
                <tr key={row.breathIdx} style={{ borderBottom: "1px solid var(--v-divider)", background: isPVA ? "var(--v-critical-pale)" : "transparent" }}>
                  <td style={{ padding: "8px 12px", fontFamily: "Menlo, monospace", fontWeight: 600, color: "var(--v-text-1)" }}>#{row.breathIdx + 1}</td>
                  <td style={{ padding: "8px 12px", color: isPVA ? "var(--v-critical)" : "var(--v-normal)", fontWeight: isPVA ? 600 : 400 }}>
                    {isPVA ? (PVA_LABELS[row.finalLabel] ?? row.finalLabel) : "Normal"}
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "center", fontFamily: "Menlo, monospace", color: "var(--v-text-2)" }}>
                    {Math.round(row.confidence * 100)}%
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "center" }}>
                    <AlertBadge severity={isPVA ? "Critical" : "Normal"} size="sm" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ fontSize: 12, color: "var(--v-text-3)" }}>
          Results based on Snorkel programmatic labeling — not validated for clinical use
        </p>
        <button
          onClick={onReset}
          style={{
            padding: "10px 20px", borderRadius: 10, border: "1px solid var(--v-divider)",
            background: "var(--v-surface-raised)", color: "var(--v-text-1)",
            fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "all 200ms ease",
          }}
        >
          ↩ Upload Another
        </button>
      </div>
    </div>
  );
}
