import type { PVAFlag, Severity } from "@/types/ventify";
import { getSeverityFromInstability } from "./constants";

export type InstabilityClass = "Stable" | "Mild" | "Elevated" | "Critical";

// ---- Data types ----

export interface WaveformPoint {
  time: number;
  pressure: number;
  flow: number;
  volume: number;
}

export interface PVABand {
  x1: number;
  x2: number;
  flag?: PVAFlag;  // per-band override (used by real data loader)
}

/** One hourly 10-second capture from the ventilator */
export interface HourlyCapture {
  id: string;
  hour: number;          // 0–23
  timestampS: number;
  flags: PVAFlag[];      // empty = no PVA detected; max 4 types per capture
  confidence: number;    // 0–1, 0 if normal
  severity: Severity;
  waveformData: WaveformPoint[];  // 250 points, t = 0…9.96 s, 25 Hz
  pvaBands: PVABand[];            // highlight regions for PVA breaths
}

export interface HourlyBucket {
  hour: number;
  label: string;
  total: number;
  counts: Partial<Record<PVAFlag, number>>;
}

export const PVA_ABBREV: Record<string, string> = {
  flow_starvation:     "FS",
  double_trigger:      "DT",
  ineffective_effort:  "IE",
  early_termination:   "ET",
  delayed_termination: "DTM",
  air_trapping:        "AT",
};

// ---- PCV waveform constants ----

const DT            = 0.04;        // seconds per sample (25 Hz)
const N_SAMPLES     = 250;         // 10s × 25 Hz
const BREATH_PERIOD = 10 / 3;      // 3.333s → 3 breaths in 10s (~18 bpm)
const TI            = BREATH_PERIOD / 3;   // 1.111s inspiration  (I:E = 1:2)
const TE            = BREATH_PERIOD - TI;  // 2.222s expiration
const PEEP          = 5;           // cmH2O baseline
const PIP_BASE      = 22;          // cmH2O set pressure
const FLOW_PEAK     = 55;          // L/min peak inspiratory flow
const TAU_INSP      = 0.32;        // inspiratory flow time constant
const TAU_EXP       = 0.55;        // expiratory flow time constant

const PVA_FLAGS: PVAFlag[] = [
  "flow_starvation", "double_trigger", "ineffective_effort",
  "early_termination", "delayed_termination", "air_trapping",
];

const FLAG_SEVERITY: Record<PVAFlag, Severity> = {
  flow_starvation:     "Critical",
  double_trigger:      "Elevated",
  ineffective_effort:  "Elevated",
  early_termination:   "Elevated",
  delayed_termination: "Elevated",
  air_trapping:        "Critical",
};

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

// ---- Seeded RNG ----

function seededRng(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  return () => {
    h = (Math.imul(1664525, h) + 1013904223) | 0;
    return (h >>> 0) / 0x100000000;
  };
}

// ---- PCV waveform generator ----

function generatePCVCapture(
  flags: PVAFlag[],
  rng: () => number,
): { waveformData: WaveformPoint[]; pvaBands: PVABand[] } {
  const pip = PIP_BASE + (rng() - 0.5) * 4;
  const noise = () => (rng() - 0.5);

  const data: WaveformPoint[] = [];
  let vol = 0;

  for (let i = 0; i < N_SAMPLES; i++) {
    const t = i * DT;
    const breathNum = Math.floor(t / BREATH_PERIOD);  // 0, 1, 2
    const tB        = t - breathNum * BREATH_PERIOD;  // position within breath

    // Breath 0 is always normal context; breaths 1 and 2 carry PVA
    const isPVA = breathNum > 0 && flags.length > 0;

    // Per-type inspiratory timing adjustments
    let ti = TI;
    if (isPVA) {
      if (flags.includes("early_termination"))   ti = TI * 0.50;
      if (flags.includes("delayed_termination")) ti = TI * 1.65;
    }

    const isInsp  = tB < ti;
    const tPhase  = isInsp ? tB : tB - ti;
    const te_eff  = (isPVA && flags.includes("air_trapping")) ? TE * 0.48 : TE;

    // --- PRESSURE ---
    let pressure: number;
    if (isInsp) {
      // Fast rise to PIP, hold plateau
      pressure = PEEP + (pip - PEEP) * Math.min(1.0, tPhase / 0.10);

      if (isPVA && flags.includes("flow_starvation")) {
        // Concave dip mid-plateau: patient demand > set delivery
        pressure -= 4.5 * Math.sin(Math.PI * tPhase / ti);
      }
      if (isPVA && flags.includes("delayed_termination") && tPhase > ti * 0.65) {
        // Patient begins opposing ventilator during extended inspiration
        pressure -= 3.2 * ((tPhase - ti * 0.65) / (ti * 0.35));
      }
    } else {
      // Rapid exponential fall to PEEP
      pressure = PEEP + (pip - PEEP) * Math.exp(-tPhase / 0.12);

      if (isPVA && flags.includes("ineffective_effort")) {
        // Small negative notch mid-expiration (failed patient effort)
        const midStart = te_eff * 0.30;
        const midEnd   = te_eff * 0.65;
        if (tPhase > midStart && tPhase < midEnd) {
          const rel = (tPhase - midStart) / (midEnd - midStart);
          pressure -= 2.8 * Math.sin(Math.PI * rel);
        }
      }
    }

    // --- FLOW ---
    let flow: number;
    if (isInsp) {
      // PCV: decelerating inspiratory flow
      flow = FLOW_PEAK * Math.exp(-tPhase / TAU_INSP);

      if (isPVA && flags.includes("flow_starvation")) {
        // Scooped curve: doesn't decelerate normally
        flow = FLOW_PEAK * (
          0.55 * Math.exp(-tPhase / TAU_INSP) +
          0.40 * Math.sin(Math.PI * tPhase / ti)
        );
      }
      if (isPVA && flags.includes("delayed_termination") && tPhase > ti * 0.68) {
        // Patient exhaling against extended plateau → flow goes negative
        flow -= FLOW_PEAK * 0.55 * ((tPhase - ti * 0.68) / (ti * 0.32));
      }
    } else {
      // Negative exponential expiratory flow
      flow = -FLOW_PEAK * 0.80 * Math.exp(-tPhase / TAU_EXP);

      if (isPVA && flags.includes("air_trapping")) {
        // Incomplete expiration: attenuated flow, doesn't reach zero
        flow *= 0.42;
      }
      if (isPVA && flags.includes("ineffective_effort")) {
        const midStart = te_eff * 0.30;
        const midEnd   = te_eff * 0.65;
        if (tPhase > midStart && tPhase < midEnd) {
          const rel = (tPhase - midStart) / (midEnd - midStart);
          // Brief positive oscillation (failed effort spike)
          flow += 16 * Math.sin(Math.PI * rel);
        }
      }
      if (isPVA && flags.includes("early_termination") && tPhase > 0.10 && tPhase < 0.55) {
        // Post-expiratory positive spike: patient still inspiring after machine cycled off
        const rel = (tPhase - 0.10) / 0.45;
        flow += 24 * Math.sin(Math.PI * rel);
      }
      if (isPVA && flags.includes("double_trigger") && tPhase > 0.08 && tPhase < te_eff * 0.72) {
        // Second inspiratory effort begins very shortly after first expiration starts
        const rel = (tPhase - 0.08) / (te_eff * 0.64);
        flow += FLOW_PEAK * 0.88 * Math.sin(Math.PI * rel * 0.6) * Math.exp(-rel * 1.8);
      }
    }

    // Physiologic noise
    pressure += noise() * 0.45;
    flow      += noise() * 1.6;

    // --- VOLUME (integrate flow: L/min → mL/s) ---
    const dv = flow * DT * (1000 / 60);

    // Detect breath start to manage baseline
    if (i > 0 && tB < DT * 0.8) {
      // Breath boundary
      if (isPVA && flags.includes("air_trapping")) {
        // Volume doesn't return to zero — carry ~30% residual
        vol = Math.max(0, data[i - 1].volume * 0.30);
      } else {
        vol = 0;
      }
    } else {
      vol = Math.max(0, (i === 0 ? 0 : data[i - 1].volume) + dv);
    }

    // Double trigger: staircase volume — second inspiration stacks on top
    if (isPVA && flags.includes("double_trigger") && !isInsp && tPhase > 0.05) {
      const rel = (tPhase - 0.05) / (BREATH_PERIOD - ti - 0.05);
      const extraVol = 220 * Math.sin(Math.PI * clamp(rel * 0.55, 0, 1));
      vol = clamp(vol + extraVol, 0, 950);
    }

    data.push({
      time:     parseFloat(t.toFixed(3)),
      pressure: parseFloat(clamp(pressure, PEEP - 2, pip + 3).toFixed(2)),
      flow:     parseFloat(clamp(flow, -75, 85).toFixed(2)),
      volume:   parseFloat(clamp(vol, 0, 950).toFixed(1)),
    });
  }

  // PVA highlighted region: breaths 1 and 2
  const pvaBands: PVABand[] = flags.length > 0
    ? [
        { x1: parseFloat(BREATH_PERIOD.toFixed(3)),     x2: parseFloat((BREATH_PERIOD * 2).toFixed(3)) },
        { x1: parseFloat((BREATH_PERIOD * 2).toFixed(3)), x2: 9.96 },
      ]
    : [];

  return { waveformData: data, pvaBands };
}

// ---- Main generator ----

/** Classify instability from 24h captures — no numeric score, direct class. */
function classifyFromCaptures(captures: HourlyCapture[]): InstabilityClass {
  const pvaCaps    = captures.filter(c => c.flags.length > 0);
  const n          = pvaCaps.length;
  if (n === 0) return "Stable";
  const critCount  = pvaCaps.filter(c => c.severity === "Critical").length;
  const multiCount = pvaCaps.filter(c => c.flags.length >= 3).length;
  if (n >= 14 || critCount >= 4 || (critCount >= 2 && multiCount >= 2)) return "Critical";
  if (n >= 7  || critCount >= 1) return "Elevated";
  return "Mild";
}

export function generateBedHistory(
  bedId: string,
  instabilityValue: number,
): {
  captures: HourlyCapture[];
  hourlyBuckets: HourlyBucket[];
  totalCaptures: number;
  instabilityClass: InstabilityClass;
  viiTrend: "up" | "down" | "stable";
} {
  const rng = seededRng(bedId + "-history-v2");
  const now = Math.floor(Date.now() / 1000);

  const severity  = getSeverityFromInstability(instabilityValue);
  // Probability that any given hourly capture contains PVA
  const pvaProbability = severity === "Critical" ? 0.70 : severity === "Elevated" ? 0.40 : 0.15;

  // Pick one dominant flag (more likely to appear)
  const dominantFlag = PVA_FLAGS[Math.floor(rng() * PVA_FLAGS.length)];

  const captures: HourlyCapture[] = [];

  for (let hour = 0; hour < 24; hour++) {
    // Timestamp: this hour's capture time (random minute within the hour, 24h ago)
    const hourStart   = now - (23 - hour) * 3600;
    const timestampS  = hourStart + Math.floor(rng() * 3600);

    const hasPVA = rng() < pvaProbability;

    let flags: PVAFlag[] = [];
    let capSeverity: Severity = "Normal";
    let confidence = 0;

    if (hasPVA) {
      // 1–4 PVA types (dominant type included 70% of the time)
      const nTypes = 1 + Math.floor(rng() * Math.min(4, PVA_FLAGS.length));
      const pool = rng() < 0.70
        ? [dominantFlag, ...PVA_FLAGS.filter(f => f !== dominantFlag)]
        : [...PVA_FLAGS].sort(() => rng() - 0.5);

      flags = pool.slice(0, nTypes);
      capSeverity = flags.some(f => FLAG_SEVERITY[f] === "Critical") ? "Critical" : "Elevated";
      confidence  = 0.55 + rng() * 0.40;
    }

    const { waveformData, pvaBands } = generatePCVCapture(flags, rng);

    captures.push({
      id:           `${bedId}-h${hour}`,
      hour,
      timestampS,
      flags,
      confidence,
      severity:     capSeverity,
      waveformData,
      pvaBands,
    });
  }

  // Build hourly buckets for the bar chart
  const hourlyBuckets: HourlyBucket[] = captures.map(cap => ({
    hour:   cap.hour,
    label:  `${String(cap.hour).padStart(2, "0")}:00`,
    total:  cap.flags.length,
    counts: Object.fromEntries(cap.flags.map(f => [f, 1])) as Partial<Record<PVAFlag, number>>,
  }));

  // Compute VII trend: compare approximate instability of last hour vs 2 hours ago
  const nowHour = new Date().getHours();
  const currCap = captures.find(c => c.hour === nowHour);
  const prevCap = captures.find(c => c.hour === (nowHour + 23) % 24);
  const currLoad = currCap ? currCap.flags.length : 0;
  const prevLoad = prevCap ? prevCap.flags.length : 0;
  // Translate flag count delta into a rough VII delta (each flag ≈ 8–15 pts)
  const rawDelta = Math.round((currLoad - prevLoad) * (9 + rng() * 6));
  const viiDelta  = rawDelta;
  const viiTrend: "up" | "down" | "stable" =
    rawDelta > 2 ? "up" : rawDelta < -2 ? "down" : "stable";

  const instabilityClass = classifyFromCaptures(captures);

  return { captures, hourlyBuckets, totalCaptures: 24, instabilityClass, viiTrend };
}
