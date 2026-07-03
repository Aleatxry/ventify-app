import type { BedData, PVAFlag, Severity, Vitals, FluidBalance, WaveformPoint } from "@/types/ventify";
import { getSeverityFromInstability } from "./constants";
import { generateWaveform, appendToWaveformBuffer } from "./mockData";

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

function randn(mean = 0, std = 1) {
  const u1 = Math.random() || 1e-10;
  const u2 = Math.random() || 1e-10;
  return mean + std * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function getNewsTrend(trend: [string, number][]): "up" | "down" | "stable" {
  if (trend.length < 2) return "stable";
  const last = trend[trend.length - 1][1];
  const prev = trend[trend.length - 2][1];
  if (last - prev > 0.05) return "up";
  if (prev - last > 0.05) return "down";
  return "stable";
}

function buildBreathHistory(
  counts: Partial<Record<string, number>>,
  total: number,
  instability: number
): Severity[] {
  const normal = (counts.normal ?? 0) + (counts.unclassified ?? 0);
  const normalFrac = total > 0 ? normal / total : 1;
  return Array.from({ length: 10 }, () => {
    if (Math.random() < normalFrac) return "Normal";
    return instability > 0.4 ? "Critical" : "Elevated";
  });
}

function buildInitialWaveform(): WaveformPoint[] {
  let buf: WaveformPoint[] = [];
  for (let i = 9; i >= 0; i--) {
    const ts = Date.now() / 1000 - i * 2.5;
    const seg = generateWaveform("Normal");
    buf = appendToWaveformBuffer(buf, seg, ts, 30);
  }
  return buf;
}

export function mockVitals(instability: number): Vitals {
  const hr  = Math.round(clamp(randn(60 + instability * 80, 4), 45, 180));
  const sbp = Math.round(clamp(randn(130 - instability * 40, 5), 70, 200));
  const dbp = Math.round(clamp(randn(80  - instability * 20, 3), 40, 120));
  const spo2 = Math.round(clamp(randn(99 - instability * 12, 1.2), 70, 100));
  return { hr, sbp, dbp, map: Math.round((sbp + 2 * dbp) / 3), spo2 };
}

export function mockFluid(): FluidBalance {
  const intakeMl  = Math.round(clamp(randn(2200, 100), 1200, 3200));
  const outputMl  = Math.round(clamp(randn(1800, 100), 600, 2800));
  return { intakeMl, outputMl, netMl: intakeMl - outputMl };
}

// ---- Main mapper ----

export function rollupToBeds(rollup: PatientRollup): BedData[] {
  return Object.entries(rollup).map(([hash, data], index) => {
    const instValue = clamp(data.mean_instability * 100, 0, 100);
    const tier = getSeverityFromInstability(instValue);

    // Dominant PVA flag (skip normal / unclassified)
    const pvaCounts = Object.entries(data.category_counts)
      .filter(([k]) => k !== "normal" && k !== "unclassified")
      .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0));

    const dominantFlag = pvaCounts[0]
      ? PYTHON_FLAG_MAP[pvaCounts[0][0]]
      : undefined;

    const totalBreaths = data.n_breaths;
    const abnormal = totalBreaths
      - (data.category_counts.normal ?? 0)
      - (data.category_counts.unclassified ?? 0);
    const confidence = clamp(totalBreaths > 0 ? (abnormal / totalBreaths) * 1.4 : 0, 0, 0.95);

    const pvaSeverity: Severity = getSeverityFromInstability(instValue);

    const latestPrediction = dominantFlag && pvaSeverity !== "Normal"
      ? {
          breath_idx: totalBreaths,
          timestamp_s: Date.now() / 1000,
          flags: [dominantFlag],
          confidence: parseFloat(confidence.toFixed(2)),
          severity: pvaSeverity,
          metrics: {
            compliance: null,
            resistance: null,
            pip: parseFloat(clamp(22 + instValue * 0.28, 14, 46).toFixed(1)),
            vt:  Math.round(clamp(500 - instValue * 2.5, 280, 700)),
            driving_pressure: parseFloat(clamp(12 + instValue * 0.22, 7, 32).toFixed(1)),
          },
          waveform_segment: { time: [], flow: [], pressure: [], volume: [] },
        }
      : null;

    // Alerts from dominant category
    const recentAlerts = dominantFlag && pvaSeverity !== "Normal"
      ? [{
          id: `${hash.slice(0, 8)}-${totalBreaths}`,
          breath_idx: totalBreaths,
          timestamp_s: Date.now() / 1000,
          flags: [dominantFlag],
          severity: pvaSeverity,
          confidence: parseFloat(confidence.toFixed(2)),
        }]
      : [];

    const newsScore = Math.min(13, Math.round(data.mean_instability * 18));
    const newsTrend = getNewsTrend(data.instability_trend);
    const breathHistory = buildBreathHistory(data.category_counts, totalBreaths, data.mean_instability);

    return {
      bedId:      String(index + 1).padStart(2, "0"),
      patientId:  hash.substring(0, 8).toUpperCase(),
      isVentilated: true,
      latestPrediction,
      recentAlerts,
      instabilityIndex: { value: parseFloat(instValue.toFixed(1)), tier },
      breathHistory,
      waveformBuffer: buildInitialWaveform(),
      vitals: mockVitals(data.mean_instability),
      fluidBalance: mockFluid(),
      isConnected: true,
      newsScore,
      newsTrend,
      patientInfo: null,
      lastEventAt: new Date(Date.now() - Math.random() * 60000),
    };
  });
}
