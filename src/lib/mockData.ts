"use client";

import type { BreathPrediction, BedData, Severity, PVAFlag, Vitals, WaveformPoint, FluidBalance, PatientInfo } from "@/types/ventify";
import { getSeverityFromInstability } from "./constants";

function randn(mean = 0, std = 1): number {
  const u1 = Math.random() || 1e-10;
  const u2 = Math.random() || 1e-10;
  return mean + std * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

type SeverityWeights = [number, number, number]; // [Normal%, Elevated%, Critical%]

interface BedConfig {
  bedId: string;
  patientId: string;
  isVentilated: boolean;
  weights: SeverityWeights;
  baseHr: number;
  baseSbp: number;
  baseDbp: number;
  baseSpo2: number;
  baseNews: number;
  baseInstability: number;
  newsTrend: "up" | "down" | "stable";
  baseNetIO: number;
  patientInfo: PatientInfo | null;
}

const BED_CONFIGS: BedConfig[] = [
  {
    bedId: "01", patientId: "KW2847", isVentilated: true,
    weights: [0.05, 0.30, 0.65], baseHr: 107, baseSbp: 97, baseDbp: 46, baseSpo2: 90,
    baseNews: 13, baseInstability: 74, newsTrend: "up", baseNetIO: 1820,
    patientInfo: {
      age: 87, gender: "ช", weightKg: 45, heightCm: 160, bmi: 17.6,
      pdx: "Aspiration pneumonia (J69.0)",
      sdx: "Septic shock (A41.9)",
      operations: ["Endotracheal intubation", "Mechanical ventilation"],
      dayOnVent: 3,
    },
  },
  {
    bedId: "03", patientId: "PM5531", isVentilated: true,
    weights: [0.55, 0.38, 0.07], baseHr: 80, baseSbp: 122, baseDbp: 76, baseSpo2: 99,
    baseNews: 5, baseInstability: 26, newsTrend: "up", baseNetIO: 210,
    patientInfo: {
      age: 62, gender: "ญ", weightKg: 58, heightCm: 155, bmi: 24.1,
      pdx: "COPD exacerbation (J44.1)",
      sdx: "Type 2 respiratory failure (J96.0)",
      operations: ["Non-invasive ventilation", "Mechanical ventilation"],
      dayOnVent: 7,
    },
  },
  {
    bedId: "05", patientId: "RN7714", isVentilated: true,
    weights: [0.35, 0.52, 0.13], baseHr: 140, baseSbp: 107, baseDbp: 83, baseSpo2: 97,
    baseNews: 12, baseInstability: 52, newsTrend: "down", baseNetIO: 960,
    patientInfo: {
      age: 54, gender: "ช", weightKg: 72, heightCm: 170, bmi: 24.9,
      pdx: "Acute respiratory distress syndrome (J80)",
      sdx: "Community-acquired pneumonia (J18.9)",
      operations: ["Endotracheal intubation", "Mechanical ventilation", "Central venous catheter"],
      dayOnVent: 12,
    },
  },
  {
    bedId: "06", patientId: "BT9023", isVentilated: false,
    weights: [1.00, 0.00, 0.00], baseHr: 88, baseSbp: 137, baseDbp: 76, baseSpo2: 98,
    baseNews: 7, baseInstability: 0, newsTrend: "down", baseNetIO: -180,
    patientInfo: {
      age: 70, gender: "ญ", weightKg: 63, heightCm: 158, bmi: 25.2,
      pdx: "Heart failure (I50.0)",
      sdx: "Hypertension (I10)",
      operations: ["Cardiac monitoring"],
      dayOnVent: 0,
    },
  },
  {
    bedId: "07", patientId: "HK4482", isVentilated: true,
    weights: [0.82, 0.15, 0.03], baseHr: 109, baseSbp: 112, baseDbp: 98, baseSpo2: 99,
    baseNews: 3, baseInstability: 12, newsTrend: "stable", baseNetIO: 70,
    patientInfo: {
      age: 41, gender: "ช", weightKg: 80, heightCm: 175, bmi: 26.1,
      pdx: "Post-operative respiratory support",
      sdx: "Colorectal surgery (Z96.89)",
      operations: ["Endotracheal intubation", "Mechanical ventilation"],
      dayOnVent: 2,
    },
  },
  {
    bedId: "09", patientId: "SL3391", isVentilated: true,
    weights: [0.15, 0.55, 0.30], baseHr: 95, baseSbp: 105, baseDbp: 65, baseSpo2: 94,
    baseNews: 9, baseInstability: 63, newsTrend: "up", baseNetIO: 1240,
    patientInfo: {
      age: 76, gender: "ญ", weightKg: 50, heightCm: 152, bmi: 21.6,
      pdx: "Sepsis (A41.9)",
      sdx: "Acute kidney injury (N17.9)",
      operations: ["Endotracheal intubation", "Mechanical ventilation", "Renal replacement therapy"],
      dayOnVent: 9,
    },
  },
];

function pickSeverity(weights: SeverityWeights): Severity {
  const r = Math.random();
  if (r < weights[2]) return "Critical";
  if (r < weights[2] + weights[1]) return "Elevated";
  return "Normal";
}

const PVA_FLAGS: PVAFlag[] = ["double_trigger", "ineffective_effort", "flow_starvation", "premature_cycling"];

function generateWaveform(severity: Severity, breathPeriod = 2.4) {
  const HZ = 20;
  const n = Math.round(breathPeriod * HZ);
  const time: number[] = [];
  const pressure: number[] = [];
  const flow: number[] = [];
  const volume: number[] = [];

  const inspEnd = breathPeriod * 0.4;
  let vol = 0;

  for (let i = 0; i < n; i++) {
    const t = i / HZ;
    time.push(parseFloat(t.toFixed(3)));

    const pBase = t < inspEnd
      ? 8 + 18 * Math.sin(Math.PI * t / inspEnd)
      : 8 + 4 * Math.exp(-4 * (t - inspEnd) / (breathPeriod - inspEnd));

    const doubleArtifact =
      severity === "Critical" && t > breathPeriod * 0.82 && Math.random() < 0.6
        ? 10 * Math.sin(Math.PI * (t - breathPeriod * 0.82) / (breathPeriod * 0.18))
        : 0;

    pressure.push(parseFloat(clamp(pBase + doubleArtifact + randn(0, 0.7), 3, 45).toFixed(2)));

    const fInsp = t < inspEnd ? 42 * Math.sin(Math.PI * t / inspEnd) : 0;
    const fExp  = t >= inspEnd ? -26 * Math.sin(Math.PI * (t - inspEnd) / (breathPeriod - inspEnd)) : 0;
    const noise = severity === "Elevated" ? randn(0, 3.5) : randn(0, 1);
    const fVal  = fInsp + fExp + noise;
    flow.push(parseFloat(clamp(fVal, -38, 65).toFixed(2)));

    const dt = 1 / HZ;
    if (t < inspEnd) {
      vol = clamp(vol + (Math.abs(fVal) / 60) * dt * 1000, 0, 720);
    } else {
      vol = clamp(vol - (Math.abs(fVal) / 60) * dt * 1000, 0, 720);
    }
    volume.push(parseFloat(vol.toFixed(1)));
  }

  return { time, flow, pressure, volume };
}

function generateBreath(config: BedConfig, breathIdx: number): BreathPrediction {
  const severity = pickSeverity(config.weights);
  const flags: PVAFlag[] = severity === "Normal" ? [] : [PVA_FLAGS[Math.floor(Math.random() * PVA_FLAGS.length)]];
  const waveformSegment = generateWaveform(severity);

  return {
    breath_idx: breathIdx,
    timestamp_s: Date.now() / 1000,
    flags,
    confidence: clamp(randn(0.78, 0.09), 0.5, 0.99),
    severity,
    metrics: {
      compliance: parseFloat(clamp(randn(config.baseInstability > 55 ? 28 : 42, 6), 12, 80).toFixed(1)),
      resistance: parseFloat(clamp(randn(12, 3), 4, 32).toFixed(1)),
      pip: parseFloat(clamp(randn(26, 4), 14, 46).toFixed(1)),
      vt: parseFloat(clamp(randn(500, 55), 280, 720).toFixed(0)),
      driving_pressure: parseFloat(clamp(randn(16, 3), 7, 32).toFixed(1)),
    },
    waveform_segment: waveformSegment,
  };
}

function generateFluidBalance(config: BedConfig, currentNet: number): FluidBalance {
  const intakeMl  = Math.round(clamp(randn(2100, 80), 1200, 3200));
  const netMl     = Math.round(clamp(currentNet + randn(0, 15), -800, 3500));
  const outputMl  = Math.round(clamp(intakeMl - netMl, 400, 2800));
  return { intakeMl, outputMl, netMl };
}

function generateVitals(config: BedConfig): Vitals {
  const sbp = Math.round(clamp(randn(config.baseSbp, 4), 70, 200));
  const dbp = Math.round(clamp(randn(config.baseDbp, 3), 40, 120));
  return {
    hr:   Math.round(clamp(randn(config.baseHr, 4), 40, 200)),
    sbp,
    dbp,
    map:  Math.round((sbp + 2 * dbp) / 3),
    spo2: Math.round(clamp(randn(config.baseSpo2, 1.2), 70, 100)),
  };
}

function appendToWaveformBuffer(
  buffer: WaveformPoint[],
  segment: { time: number[]; pressure: number[]; flow: number[]; volume: number[] },
  timestampS: number,
  windowS: number
): WaveformPoint[] {
  const newPoints: WaveformPoint[] = segment.time.map((t, i) => ({
    t: timestampS + t,
    pressure: segment.pressure[i],
    flow: segment.flow[i],
    volume: segment.volume[i],
  }));
  const cutoff = (Date.now() / 1000) - windowS;
  return [...buffer, ...newPoints].filter(p => p.t >= cutoff);
}

export type BedUpdateCallback = (bedId: string, patch: Partial<BedData>) => void;

export function createMockWard(onUpdate: BedUpdateCallback) {
  const intervals: ReturnType<typeof setTimeout>[] = [];
  const breathCounters: Record<string, number> = {};
  const instabilityValues: Record<string, number> = {};
  const netIOValues: Record<string, number> = {};

  BED_CONFIGS.forEach(cfg => {
    breathCounters[cfg.bedId] = 1000 + Math.floor(Math.random() * 600);
    instabilityValues[cfg.bedId] = cfg.baseInstability + randn(0, 5);
    netIOValues[cfg.bedId] = cfg.baseNetIO + randn(0, 30);
  });

  function getInitialData(): BedData[] {
    return BED_CONFIGS.map(cfg => {
      const vitals = generateVitals(cfg);
      const instValue = clamp(instabilityValues[cfg.bedId], 0, 100);
      const tier = getSeverityFromInstability(instValue);
      const breathHistory: Severity[] = Array.from({ length: 10 }, () => pickSeverity(cfg.weights));

      let waveformBuffer: WaveformPoint[] = [];
      if (cfg.isVentilated) {
        for (let i = 9; i >= 0; i--) {
          const ts = (Date.now() / 1000) - i * 2.5;
          const seg = generateWaveform(pickSeverity(cfg.weights));
          waveformBuffer = appendToWaveformBuffer(waveformBuffer, seg, ts, 30);
        }
      }

      return {
        bedId: cfg.bedId,
        patientId: cfg.patientId,
        isVentilated: cfg.isVentilated,
        latestPrediction: cfg.isVentilated ? generateBreath(cfg, breathCounters[cfg.bedId]) : null,
        recentAlerts: [],
        instabilityIndex: { value: parseFloat(instValue.toFixed(1)), tier },
        breathHistory,
        waveformBuffer,
        vitals,
        fluidBalance: generateFluidBalance(cfg, netIOValues[cfg.bedId]),
        isConnected: true,
        newsScore: cfg.baseNews,
        newsTrend: cfg.newsTrend,
        patientInfo: cfg.patientInfo,
      };
    });
  }

  function scheduleBed(cfg: BedConfig, currentBuffers: Map<string, WaveformPoint[]>) {
    const delay = 2200 + Math.random() * 800;
    const t = setTimeout(() => {
      breathCounters[cfg.bedId]++;
      const prediction = generateBreath(cfg, breathCounters[cfg.bedId]);

      instabilityValues[cfg.bedId] = clamp(
        instabilityValues[cfg.bedId] + randn(0, 3.5),
        0, 100
      );
      const instValue = instabilityValues[cfg.bedId];
      const tier = getSeverityFromInstability(instValue);

      let buf = currentBuffers.get(cfg.bedId) ?? [];
      buf = appendToWaveformBuffer(buf, prediction.waveform_segment, prediction.timestamp_s, 30);
      currentBuffers.set(cfg.bedId, buf);

      const alertEntry = prediction.flags.length > 0 || prediction.severity !== "Normal"
        ? [{
            id: `${cfg.bedId}-${prediction.breath_idx}`,
            breath_idx: prediction.breath_idx,
            timestamp_s: prediction.timestamp_s,
            flags: prediction.flags,
            severity: prediction.severity,
            confidence: prediction.confidence,
          }]
        : [];

      onUpdate(cfg.bedId, {
        latestPrediction: prediction,
        instabilityIndex: { value: parseFloat(instValue.toFixed(1)), tier },
        waveformBuffer: buf,
        ...(alertEntry.length > 0 ? { recentAlerts: alertEntry } : {}),
      });

      scheduleBed(cfg, currentBuffers);
    }, delay);
    intervals.push(t);
  }

  function start(initialBuffers: Map<string, WaveformPoint[]>) {
    BED_CONFIGS.forEach(cfg => {
      if (cfg.isVentilated) scheduleBed(cfg, initialBuffers);
    });

    const vitalsInterval = setInterval(() => {
      BED_CONFIGS.forEach(cfg => {
        netIOValues[cfg.bedId] = clamp(netIOValues[cfg.bedId] + randn(0, 20), -800, 3500);
        onUpdate(cfg.bedId, {
          vitals: generateVitals(cfg),
          fluidBalance: generateFluidBalance(cfg, netIOValues[cfg.bedId]),
        });
      });
    }, 5000);
    intervals.push(vitalsInterval);
  }

  function stop() {
    intervals.forEach(id => clearTimeout(id as unknown as number));
    intervals.length = 0;
  }

  return { start, stop, getInitialData };
}
