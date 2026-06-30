import type { BreathMetrics } from "@/types/ventify";
import { formatMetric } from "@/lib/constants";

interface MetricsPanelProps {
  metrics: BreathMetrics | null;
}

const METRICS = [
  { key: "compliance",       label: "Compliance",       unit: "mL/cmH₂O", decimals: 1 },
  { key: "resistance",       label: "Resistance",       unit: "cmH₂O/L/s", decimals: 1 },
  { key: "pip",              label: "PIP",              unit: "cmH₂O",    decimals: 1 },
  { key: "vt",               label: "Tidal Volume",     unit: "mL",       decimals: 0 },
  { key: "driving_pressure", label: "Driving Pressure", unit: "cmH₂O",   decimals: 1 },
] as const;

export default function MetricsPanel({ metrics }: MetricsPanelProps) {
  return (
    <div className="v-card rounded-2xl p-5">
      <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--v-text-2)" }}>
        Latest Breath Metrics
      </p>

      <div className="flex flex-col gap-2.5">
        {METRICS.map(({ key, label, unit, decimals }) => {
          const raw = metrics ? (metrics[key] as number | null) : null;
          const value = formatMetric(raw, decimals);

          return (
            <div key={key} className="flex items-center justify-between">
              <span className="text-[13px]" style={{ color: "var(--v-text-2)" }}>
                {label}
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono-nums text-[14px] font-medium" style={{ color: "var(--v-text-1)" }}>
                  {value}
                </span>
                {value !== "—" && (
                  <span className="text-[11px]" style={{ color: "var(--v-text-3)" }}>
                    {unit}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
