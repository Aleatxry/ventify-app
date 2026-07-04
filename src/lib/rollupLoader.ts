import type { BedData, PVAFlag } from "@/types/ventify";
import { getSeverityFromInstability, FLAG_SEVERITY } from "./constants";
import { toPatientInfo, isHighRisk, type PatientMetadata } from "./patientMetadataLoader";

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

// ---- Main mapper — only uses real data from patient_rollup.json ----

export function rollupToBeds(rollup: PatientRollup, metadata?: PatientMetadata | null): BedData[] {
  return Object.entries(rollup).map(([hash, data], index) => {
    const instValue = clamp(data.mean_instability * 100, 0, 100);
    const baseTier  = getSeverityFromInstability(instValue);

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

    // "Normal" should mean no PVA at all, not just "the average happens to
    // be low" -- a patient can have a large real PVA fraction (e.g. bed 04:
    // 31.8% of breaths are real flow_starvation) and still average out
    // under the instability threshold, since mean_instability dilutes
    // across their WHOLE breath history. Any real PVA breath floors to at
    // least Elevated; old age or a lung-injury diagnosis does the same
    // (metadata is per-patient demographic/diagnosis data, out_real/
    // patient_metadata.json, separate from and additional to PVA data).
    // Both patients can still reach Critical on real PVA data alone.
    const metaEntry = metadata?.[hash];
    const highRisk  = isHighRisk(metaEntry);
    const tier      = (pvaBreadths > 0 || highRisk) && baseTier === "Normal" ? "Elevated" : baseTier;

    // Whether to SHOW a dominant PVA flag depends only on whether one exists
    // (any real, non-normal/unclassified breaths) -- NOT on the patient's
    // overall averaged instability tier, which dilutes across their whole
    // (mostly-normal) breath history and was previously suppressing real,
    // substantial PVA findings (e.g. 348 real delayed_termination breaths
    // out of 3354 total still averages out to an overall "Normal" tier).
    // Severity for the badge's color comes from the flag's OWN clinical
    // weight, same mapping realDataLoader.ts uses per-capture.
    const latestPrediction = dominantFlag
      ? {
          breath_idx:  totalBreaths,
          timestamp_s: Date.now() / 1000,
          flags:       [dominantFlag],
          confidence:  parseFloat(confidence.toFixed(2)),
          severity:    FLAG_SEVERITY[dominantFlag] ?? "Elevated",
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
      patientInfo:      metaEntry ? toPatientInfo(metaEntry) : null,
      // Real summary fields
      captureCount:     data.n_captures,
      totalBreaths:     data.n_breaths,
      pvaBreathFrac:    parseFloat(pvaBreathFrac.toFixed(3)),
      highRisk,
    };
  });
}
