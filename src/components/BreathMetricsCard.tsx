import type { HourlyCapture, BreathMetrics } from "@/lib/mockHistory";

interface Props {
  captures: HourlyCapture[];
}

// Reference ranges for color-coding
function dpColor(dp: number): string {
  if (dp > 20) return "#FF3B30";
  if (dp > 15) return "#FF9500";
  return "var(--v-text-1)";
}
function compColor(c: number | null): string {
  if (c === null) return "var(--v-text-3)";
  if (c < 10) return "#FF3B30";
  if (c < 20) return "#FF9500";
  return "var(--v-text-1)";
}
function rrColor(rr: number): string {
  if (rr > 45) return "#FF3B30";
  if (rr > 35) return "#FF9500";
  return "var(--v-text-1)";
}

function mean(vals: number[]): number {
  if (vals.length === 0) return 0;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

function fmt(v: number, dp = 0): string {
  return v.toFixed(dp);
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

interface MetricTileProps {
  label: string;
  value: string;
  unit: string;
  color?: string;
}
function MetricTile({ label, value, unit, color = "var(--v-text-1)" }: MetricTileProps) {
  return (
    <div style={{
      padding: "9px 8px",
      backgroundColor: "var(--v-surface-raised)",
      borderRadius: 8,
    }}>
      <div style={{ fontSize: 9, fontWeight: 600, color: "var(--v-text-3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
        <span style={{ fontSize: 19, fontWeight: 700, color, fontFamily: "Menlo, monospace", letterSpacing: "-0.02em", lineHeight: 1 }}>
          {value}
        </span>
        <span style={{ fontSize: 9, color: "var(--v-text-3)", fontWeight: 500 }}>{unit}</span>
      </div>
    </div>
  );
}

export default function BreathMetricsCard({ captures }: Props) {
  // Use the most recent capture that has computed metrics
  const latest = [...captures]
    .sort((a, b) => b.timestampS - a.timestampS)
    .find(c => c.breathMetrics && c.breathMetrics.length > 0);

  if (!latest || !latest.breathMetrics || latest.breathMetrics.length === 0) {
    return (
      <div className="v-card rounded-2xl p-5">
        <p className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--v-text-2)" }}>
          Latest Breath Metrics
        </p>
        <p style={{ fontSize: 13, color: "var(--v-text-3)" }}>No waveform data available</p>
      </div>
    );
  }

  const ms = latest.breathMetrics;

  const avgVt   = Math.round(mean(ms.map(m => m.vt)));
  const avgPip  = parseFloat(mean(ms.map(m => m.pip)).toFixed(1));
  const avgPeep = parseFloat(mean(ms.map(m => m.peep)).toFixed(1));
  const avgDp   = parseFloat(mean(ms.map(m => m.dp)).toFixed(1));
  const avgRr   = parseFloat(mean(ms.map(m => m.rr)).toFixed(1));
  const compVals = ms.map(m => m.compliance).filter((c): c is number => c !== null);
  const avgComp = compVals.length > 0 ? parseFloat(mean(compVals).toFixed(1)) : null;

  // Show most common I:E ratio
  const ieMode = ms[0]?.ie ?? "—";

  return (
    <div className="v-card rounded-2xl p-5">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
        <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--v-text-2)" }}>
          Latest Breath Metrics
        </p>
        <span style={{ fontSize: 10, fontFamily: "Menlo, monospace", color: "var(--v-text-3)" }}>
          {formatTimestamp(latest.timestampS)} · {ms.length} breath{ms.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Primary metrics: 3×2 grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5, marginBottom: 5 }}>
        <MetricTile label="Vt" value={String(avgVt)} unit="mL" />
        <MetricTile label="PIP" value={fmt(avgPip, 1)} unit="cmH₂O" />
        <MetricTile label="PEEP" value={fmt(avgPeep, 1)} unit="cmH₂O" />
        <MetricTile label="ΔP" value={fmt(avgDp, 1)} unit="cmH₂O" color={dpColor(avgDp)} />
        <MetricTile
          label="Compliance"
          value={avgComp !== null ? fmt(avgComp, 1) : "—"}
          unit="mL/cmH₂O"
          color={compColor(avgComp)}
        />
        <MetricTile label="RR" value={fmt(avgRr, 1)} unit="bpm" color={rrColor(avgRr)} />
      </div>

      {/* Secondary row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 5, marginBottom: 12 }}>
        <MetricTile label="Ti" value={fmt(ms[0]?.ti ?? 0, 2)} unit="s" />
        <MetricTile label="I:E" value={ieMode} unit="" />
        <MetricTile label="PIF" value={fmt(mean(ms.map(m => m.pif)), 0)} unit="L/min" />
        <MetricTile label="MAP" value={fmt(mean(ms.map(m => m.map)), 1)} unit="cmH₂O" />
      </div>

      {/* Per-breath table */}
      {ms.length > 1 && (
        <div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "20px 52px 50px 50px 56px",
            gap: 0,
            paddingBottom: 5,
            borderBottom: "1px solid var(--v-divider)",
            marginBottom: 4,
          }}>
            {["#", "Vt", "ΔP", "C", "RR"].map(h => (
              <span key={h} style={{ fontSize: 9, fontWeight: 600, color: "var(--v-text-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</span>
            ))}
          </div>
          {ms.map(m => (
            <div key={m.breathNum} style={{
              display: "grid",
              gridTemplateColumns: "20px 52px 50px 50px 56px",
              gap: 0,
              padding: "3px 0",
              borderBottom: "1px solid rgba(255,255,255,0.03)",
            }}>
              <span style={{ fontSize: 10, color: "var(--v-text-3)", fontFamily: "Menlo, monospace" }}>{m.breathNum}</span>
              <span style={{ fontSize: 10, color: "var(--v-text-1)", fontFamily: "Menlo, monospace" }}>{m.vt}</span>
              <span style={{ fontSize: 10, fontFamily: "Menlo, monospace", color: dpColor(m.dp) }}>{fmt(m.dp, 1)}</span>
              <span style={{ fontSize: 10, fontFamily: "Menlo, monospace", color: compColor(m.compliance) }}>
                {m.compliance !== null ? fmt(m.compliance, 0) : "—"}
              </span>
              <span style={{ fontSize: 10, fontFamily: "Menlo, monospace", color: rrColor(m.rr) }}>{fmt(m.rr, 0)}</span>
            </div>
          ))}
          <p style={{ fontSize: 9, color: "var(--v-text-3)", marginTop: 6 }}>
            Vt=mL · ΔP=cmH₂O · C=mL/cmH₂O · RR=bpm
          </p>
        </div>
      )}

      {/* Clinical thresholds footnote */}
      <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--v-divider)" }}>
        <p style={{ fontSize: 9, color: "var(--v-text-3)", lineHeight: 1.5 }}>
          <span style={{ color: "#FF9500" }}>■</span> ΔP&gt;15 · <span style={{ color: "#FF3B30" }}>■</span> ΔP&gt;20 · C&lt;20 alert thresholds
        </p>
      </div>
    </div>
  );
}
