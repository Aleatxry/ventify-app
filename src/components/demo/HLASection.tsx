"use client";

import type { HLALabel, HLAResult, LabelMatrixRow } from "@/types/demo";
import { HLA_TO_LF_LABEL } from "@/lib/demoPipeline";
import { PVA_LABELS } from "@/lib/constants";

interface HLASectionProps {
  results: HLAResult[];
  snorkelMatrix: LabelMatrixRow[];
  onNext: () => void;
  processing: boolean;
}

const HLA_CONFIG: Record<HLALabel, { color: string; bg: string; label: string }> = {
  normal:              { color: "var(--v-normal)",   bg: "var(--v-normal-pale)",   label: "Normal" },
  flow_asynchrony:     { color: "var(--v-critical)", bg: "var(--v-critical-pale)", label: "Flow Asynchrony" },
  reverse_triggering:  { color: "#be185d",            bg: "#fdf2f8",                label: "Reverse Triggering" },
  premature_cycling:   { color: "#7c3aed",            bg: "#f5f3ff",                label: "Premature Cycling" },
  double_triggering:   { color: "#e07d10",            bg: "#fff7ed",                label: "Double Triggering" },
  delayed_cycling:     { color: "#b45309",            bg: "#fffbeb",                label: "Delayed Cycling" },
  ineffective_effort:  { color: "#0369a1",            bg: "#f0f9ff",                label: "Ineffective Effort" },
  auto_triggering:     { color: "#0f766e",             bg: "#f0fdfa",                label: "Auto Triggering" },
};

function AgreementBadge({ hla, snorkelLabel }: { hla: HLAResult; snorkelLabel: string }) {
  const mapped = HLA_TO_LF_LABEL[hla.label];

  if (mapped === null) {
    return (
      <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: "var(--v-surface-raised)", color: "var(--v-text-2)", border: "1px solid var(--v-divider)" }}>
        HLA-only type — no LF counterpart to compare
      </span>
    );
  }

  const agrees = mapped === snorkelLabel;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
      background: agrees ? "var(--v-normal-pale)" : "#fef3c7",
      color: agrees ? "var(--v-normal)" : "#92400e",
    }}>
      {agrees ? "✓ agrees with Snorkel" : "⚠ disagrees with Snorkel"}
    </span>
  );
}

function HLABreathRow({ hla, snorkel }: { hla: HLAResult; snorkel: LabelMatrixRow | undefined }) {
  const cfg = HLA_CONFIG[hla.label];
  const snorkelLabel = snorkel ? (snorkel.finalLabel === "Normal" ? "Normal" : snorkel.finalLabel) : "Normal";

  return (
    <div style={{
      borderRadius: 12, padding: "12px 14px", marginBottom: 8,
      background: hla.label !== "normal" ? cfg.bg : "var(--v-surface-raised)",
      border: "1px solid transparent",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, fontFamily: "Menlo, monospace", fontWeight: 700, color: "var(--v-text-1)", minWidth: 28 }}>
          #{hla.breathIdx + 1}
        </span>
        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: cfg.bg, color: cfg.color }}>
          {cfg.label}
        </span>
        <span style={{ marginLeft: "auto" }}>
          <AgreementBadge hla={hla} snorkelLabel={PVA_LABELS[snorkelLabel] ? snorkelLabel : snorkelLabel} />
        </span>
      </div>

      <div style={{ display: "flex", gap: 16, fontSize: 11, color: "var(--v-text-2)", fontFamily: "Menlo, monospace" }}>
        <span>insp: {hla.nInsp} segment{hla.nInsp === 1 ? "" : "s"} [{hla.inspSlopes.map(s => s.toFixed(2)).join(", ")}]</span>
        <span>exp: {hla.nExp} segment{hla.nExp === 1 ? "" : "s"} [{hla.expSlopes.map(s => s.toFixed(2)).join(", ")}]</span>
      </div>
    </div>
  );
}

export default function HLASection({ results, snorkelMatrix, onNext, processing }: HLASectionProps) {
  const flaggedCount = results.filter(r => r.label !== "normal").length;
  const comparable = results.filter(r => HLA_TO_LF_LABEL[r.label] !== null);
  const agreeCount = comparable.filter(r => {
    const s = snorkelMatrix.find(m => m.breathIdx === r.breathIdx);
    return s && HLA_TO_LF_LABEL[r.label] === s.finalLabel;
  }).length;
  const hlaOnlyCount = results.filter(r => r.label === "reverse_triggering" || r.label === "auto_triggering").length;

  return (
    <div className="animate-fade-up v-card" style={{ padding: 24, borderRadius: 20 }}>
      <div style={{ marginBottom: 20 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#be185d", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          ⑤ HLA — Hysteresis Loop Analysis
        </span>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--v-text-1)", margin: "4px 0" }}>
          {flaggedCount} / {results.length} breaths flagged by loop geometry
        </h3>
        <p style={{ fontSize: 13, color: "var(--v-text-2)" }}>
          A second, independent method (Ang et al. 2024) — judges the shape of each breath&apos;s
          pressure-volume loop rather than time-domain features. Where it agrees with Snorkel,
          that&apos;s convergent validity from two unrelated methods; where it doesn&apos;t, that&apos;s
          worth a clinician&apos;s second look.
        </p>
        <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 12, color: "var(--v-text-2)" }}>
          <span><strong style={{ color: "var(--v-normal)" }}>{agreeCount}</strong> / {comparable.length} comparable breaths agree with Snorkel</span>
          {hlaOnlyCount > 0 && (
            <span><strong style={{ color: "#be185d" }}>{hlaOnlyCount}</strong> reverse/auto-triggering — types Snorkel&apos;s LFs can&apos;t detect at all</span>
          )}
        </div>
      </div>

      <div>
        {results.map(r => (
          <HLABreathRow key={r.breathIdx} hla={r} snorkel={snorkelMatrix.find(m => m.breathIdx === r.breathIdx)} />
        ))}
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
