import type { BedData, PVAFlag, Severity } from "@/types/ventify";
import { getSeverityFromInstability } from "./constants";

// ---- JSON schema from ventsight_label.py ----

export interface PatientRollupEntry {
  n_breaths: number;
  n_captures: number;
  category_counts: Partial<Record<string, number>>;
  mean_instability: number;
  instability_trend: [string, number][];
}

export type PatientRollup = Record<string, PatientRollupEntry>;

// ---- Helpers ----

const PYTHON_FLAG_MAP: Record<string, PVAFlag> = {
  double_trigger:      "double_trigger",
  ineffective_effort:  "ineffective_effort",
  flow_starvation:     "flow_starvation",
  delayed_termination: "delayed_termination",
  early_termination:   "early_termination",
  air_trapping:        "air_trapping",
};

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function getInstabilityTrend(trend: [string, number][]): "up" | "down" | "stable" {
  if (trend.length < 2) return "stable";
  const last = trend[trend.length - 1][1];
  const prev = trend[trend.length - 2][1];
  if (last - prev > 0.05) return "up";
  if (prev - last > 0.05) return "down";
  return "stable";
}

// ---- Main mapper — only uses real data from patient_rollup.json ----

export function rollupToBeds(rollup: PatientRollup): BedData[] {
  return Object.entries(rollup).map(([hash, data], index) => {
    const instValue = clamp(data.mean_instability * 100, 0, 100);
    const tier      = getSeverityFromInstability(instValue);

    // Dominant PVA flag (skip normal / unclassified)
    const pvaCounts = Object.entries(data.category_counts)
      .filter(([k]) => k !== "normal" && k !== "unclassified")
      .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0));

    const dominantFlag = pvaCounts[0]
      ? PYTHON_FLAG_MAP[pvaCounts[0][0]]
      : undefined;

    const totalBreaths = data.n_breaths;
    const pvaBreadths  = totalBreaths
      - (data.category_counts.normal      ?? 0)
      - (data.category_counts.unclassified ?? 0);
    const pvaBreathFrac = totalBreaths > 0 ? pvaBreadths / totalBreaths : 0;
    const confidence    = clamp(pvaBreathFrac * 1.4, 0, 0.95);

    const pvaSeverity: Severity = getSeverityFromInstability(instValue);

    const latestPrediction = dominantFlag && pvaSeverity !== "Normal"
      ? {
          breath_idx:  totalBreaths,
          timestamp_s: Date.now() / 1000,
          flags:       [dominantFlag],
          confidence:  parseFloat(confidence.toFixed(2)),
          severity:    pvaSeverity,
          metrics: {
            compliance:       null,
            resistance:       null,
            pip:              0,
            vt:               0,
            driving_pressure: 0,
          },
          waveform_segment: { time: [], flow: [], pressure: [], volume: [] },
        }
      : null;

    return {
      bedId:            String(index + 1).padStart(2, "0"),
      patientId:        hash.substring(0, 8).toUpperCase(),
      isVentilated:     true,
      latestPrediction,
      recentAlerts:     [],
      instabilityIndex: { value: parseFloat(instValue.toFixed(1)), tier },
      breathHistory:    [],
      waveformBuffer:   [],
      vitals:           null,
      fluidBalance:     null,
      isConnected:      true,
      newsScore:        0,
      newsTrend:        getInstabilityTrend(data.instability_trend),
      patientInfo:      null,
      // Real summary fields
      captureCount:     data.n_captures,
      totalBreaths:     data.n_breaths,
      pvaBreathFrac:    parseFloat(pvaBreathFrac.toFixed(3)),
    };
  });
}
