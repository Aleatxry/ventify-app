export type Severity = "Normal" | "Elevated" | "Critical";

export type PVAFlag =
  | "double_trigger"
  | "ineffective_effort"
  | "flow_starvation"
  | "delayed_termination"
  | "early_termination"
  | "air_trapping";

export interface BreathMetrics {
  compliance: number | null;
  resistance: number | null;
  pip: number;
  vt: number;
  driving_pressure: number;
}

export interface WaveformSegment {
  time: number[];
  flow: number[];
  pressure: number[];
  volume: number[];
}

export interface BreathPrediction {
  breath_idx: number;
  timestamp_s: number;
  flags: PVAFlag[];
  confidence: number;
  severity: Severity;
  metrics: BreathMetrics;
  waveform_segment: WaveformSegment;
}

export interface InstabilityIndex {
  value: number;
  tier: Severity;
}

export interface Alert {
  id: string;
  breath_idx: number;
  timestamp_s: number;
  flags: PVAFlag[];
  severity: Severity;
  confidence: number;
}

export interface WaveformPoint {
  t: number;
  pressure: number;
  flow: number;
  volume: number;
}

export interface Vitals {
  hr: number;
  sbp: number;
  dbp: number;
  map: number;
  spo2: number;
}

export interface FluidBalance {
  intakeMl: number;
  outputMl: number;
  netMl: number;
}

export interface PatientInfo {
  age: number;
  gender: "ช" | "ญ";
  weightKg: number | null;
  heightCm: number | null;
  bmi: number | null;
  pdx: string;
  sdx: string;
  operations: string[];
  dayOnVent: number;
}

export interface BedData {
  bedId: string;
  patientId: string;
  isVentilated: boolean;
  latestPrediction: BreathPrediction | null;
  recentAlerts: Alert[];
  instabilityIndex: InstabilityIndex;
  breathHistory: Severity[];
  waveformBuffer: WaveformPoint[];
  vitals: Vitals | null;
  fluidBalance: FluidBalance | null;
  isConnected: boolean;
  newsScore: number;
  newsTrend: "up" | "down" | "stable";
  patientInfo: PatientInfo | null;
  lastEventAt?: Date;
}
