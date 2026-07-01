"use client";

import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import type { BreathFeatures } from "@/types/demo";

interface Layer2SectionProps {
  features: BreathFeatures[];
  onNext: () => void;
  processing: boolean;
}

function Sparkline({ data, dataKey, color, label, unit }: {
  data: BreathFeatures[];
  dataKey: keyof BreathFeatures;
  color: string;
  label: string;
  unit: string;
}) {
  const vals = data.map(f => f[dataKey] ?? 0) as number[];
  const min  = Math.min(...vals);
  const max  = Math.max(...vals);
  return (
    <div style={{ background: "var(--v-surface-raised)", borderRadius: 12, padding: 12 }}>
      <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--v-text-2)", marginBottom: 8 }}>
        {label}
        <span style={{ fontWeight: 400, color: "var(--v-text-3)", marginLeft: 4 }}>({unit})</span>
      </p>
      <ResponsiveContainer width="100%" height={56}>
        <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <YAxis domain={[min * 0.9, max * 1.1]} hide />
          <XAxis dataKey="breathIdx" hide />
          <Tooltip
            contentStyle={{ background: "#1C1C1E", border: "1px solid #38383A", borderRadius: 6, fontSize: 10 }}
            labelFormatter={v => `Breath #${Number(v) + 1}`}
            formatter={(v) => [typeof v === "number" ? `${v} ${unit}` : v, label]}
          />
          <Line type="monotone" dataKey={dataKey as string} stroke={color} dot={{ r: 2.5, fill: color }} strokeWidth={1.5} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

const COLS = [
  { key: "pip",             label: "PIP",              unit: "cmH₂O" },
  { key: "peep",            label: "PEEP",             unit: "cmH₂O" },
  { key: "vt",              label: "VT",               unit: "mL"     },
  { key: "iTime",           label: "I-time",           unit: "s"      },
  { key: "eTime",           label: "E-time",           unit: "s"      },
  { key: "ieRatio",         label: "I:E",              unit: ""       },
  { key: "compliance",      label: "Compliance",       unit: "mL/cmH₂O"},
  { key: "drivingPressure", label: "ΔP",               unit: "cmH₂O" },
  { key: "peakFlow",        label: "Peak Flow",        unit: "L/min"  },
] as const;

export default function Layer2Section({ features, onNext, processing }: Layer2SectionProps) {
  return (
    <div className="animate-fade-up v-card" style={{ padding: 24, borderRadius: 20 }}>
      <div style={{ marginBottom: 20 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#30D158", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          ③ Layer 2 — Feature Extraction
        </span>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--v-text-1)", margin: "4px 0" }}>
          Biomechanical features per breath
        </h3>
        <p style={{ fontSize: 13, color: "var(--v-text-2)" }}>
          9 features derived from waveform morphology — used as input to the labeling model
        </p>
      </div>

      {/* Sparklines */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 24 }}>
        <Sparkline data={features} dataKey="drivingPressure" color="#FFD60A" label="Driving Pressure" unit="cmH₂O" />
        <Sparkline data={features} dataKey="compliance"      color="#30D158" label="Compliance"       unit="mL/cmH₂O" />
        <Sparkline data={features} dataKey="ieRatio"         color="#0A84FF" label="I:E Ratio"        unit="" />
        <Sparkline data={features} dataKey="peakFlow"        color="#FF9F0A" label="Peak Flow"        unit="L/min" />
      </div>

      {/* Full feature table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--v-divider)" }}>
              <th style={{ padding: "6px 10px", textAlign: "left", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--v-text-3)", whiteSpace: "nowrap" }}>#</th>
              {COLS.map(c => (
                <th key={c.key} style={{ padding: "6px 10px", textAlign: "right", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--v-text-3)", whiteSpace: "nowrap" }}>
                  {c.label}{c.unit ? ` (${c.unit})` : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {features.map(f => (
              <tr key={f.breathIdx} style={{ borderBottom: "1px solid var(--v-divider)" }}>
                <td style={{ padding: "7px 10px", fontWeight: 600, color: "var(--v-text-2)", fontFamily: "Menlo, monospace" }}>
                  {f.breathIdx + 1}
                </td>
                {COLS.map(c => {
                  const v = f[c.key];
                  return (
                    <td key={c.key} style={{ padding: "7px 10px", textAlign: "right", color: "var(--v-text-1)", fontFamily: "Menlo, monospace" }}>
                      {v === null || v === undefined ? <span style={{ color: "var(--v-text-3)" }}>—</span> : v}
                    </td>
                  );
                })}
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
          {processing ? "Running Snorkel…" : "Run Snorkel →"}
        </button>
      </div>
    </div>
  );
}
