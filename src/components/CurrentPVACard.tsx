import type { BreathPrediction, Alert } from "@/types/ventify";
import { PVA_LABELS, PVA_SHORT, SEVERITY_COLORS, formatTimestamp } from "@/lib/constants";
import AlertBadge from "./AlertBadge";

const PVA_COLORS: Record<string, string> = {
  flow_starvation:     "#FF3B30",
  double_trigger:      "#FF9500",
  ineffective_effort:  "#0A84FF",
  early_termination:   "#AF52DE",
  delayed_termination: "#FF6B00",
  air_trapping:        "#5E5CE6",
};

interface Props {
  prediction: BreathPrediction | null;
  recentAlerts: Alert[];
}

export default function CurrentPVACard({ prediction, recentAlerts }: Props) {
  const typeCounts = recentAlerts
    .filter(a => a.severity !== "Normal" && a.flags.length > 0)
    .reduce<Record<string, number>>((acc, a) => {
      const key = a.flags[0];
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

  const typeEntries = Object.entries(typeCounts).sort(([, a], [, b]) => b - a);
  const totalPVA    = typeEntries.reduce((s, [, n]) => s + n, 0);

  return (
    <div className="v-card rounded-2xl p-5">
      <p className="text-[11px] font-semibold uppercase tracking-widest mb-3"
        style={{ color: "var(--v-text-2)" }}>
        Current PVA Detection
      </p>

      {!prediction ? (
        <p className="text-[13px] mb-4" style={{ color: "var(--v-text-2)" }}>Waiting for data…</p>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3 mb-2">
            <p className="text-[16px] font-semibold leading-snug" style={{ color: "var(--v-text-1)" }}>
              {prediction.flags.length > 0
                ? PVA_LABELS[prediction.flags[0]] ?? prediction.flags[0]
                : "No PVA Detected"}
            </p>
            <AlertBadge severity={prediction.severity} pulse size="sm" />
          </div>

          <div className="flex items-center justify-between mb-1">
            <div>
              {/* Model confidence — blue accent, clearly not a vital sign */}
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.07em", color: "rgba(10,132,255,0.65)", textTransform: "uppercase", marginBottom: 4 }}>
                Model conf.
              </p>
              <div className="flex items-center gap-2">
                <div className="w-20 h-1 rounded-full overflow-hidden"
                  style={{ backgroundColor: "var(--v-surface-raised)" }}>
                  <div className="h-full rounded-full" style={{
                    width: `${Math.round(prediction.confidence * 100)}%`,
                    backgroundColor: "#0A84FF",
                  }} />
                </div>
                <span className="font-mono-nums text-[12px] font-medium" style={{ color: "#0A84FF" }}>
                  {Math.round(prediction.confidence * 100)}%
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: "var(--v-text-2)" }}>
                Breath #
              </p>
              <p className="font-mono-nums text-[12px] font-medium" style={{ color: "var(--v-text-1)" }}>
                {prediction.breath_idx.toLocaleString()}
              </p>
            </div>
          </div>

          <p className="text-[11px] mb-4" style={{ color: "var(--v-text-3)" }}>
            {formatTimestamp(prediction.timestamp_s)}
          </p>
        </>
      )}

      {/* Session PVA summary */}
      {typeEntries.length > 0 && (
        <div style={{ borderTop: "1px solid var(--v-divider)", paddingTop: 12 }}>
          <p className="text-[10px] uppercase tracking-widest mb-2"
            style={{ color: "var(--v-text-2)" }}>
            This session · {totalPVA} events
          </p>
          <div className="flex flex-col gap-1.5">
            {typeEntries.map(([flag, count]) => (
              <div key={flag} className="flex items-center justify-between">
                <span style={{ fontSize: 11, color: "var(--v-text-1)" }}>
                  {PVA_SHORT[flag] ?? flag}
                </span>
                <div className="flex items-center gap-2">
                  <div style={{
                    height: 4, borderRadius: 99,
                    width: Math.max(12, Math.round((count / totalPVA) * 56)),
                    backgroundColor: PVA_COLORS[flag] ?? "#888",
                    opacity: 0.75,
                  }} />
                  <span className="font-mono-nums text-[11px] font-semibold"
                    style={{ color: PVA_COLORS[flag] ?? "var(--v-text-2)", minWidth: 20, textAlign: "right" }}>
                    {count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
