export interface CsvWaveformPoint {
  time: number;
  pressure: number;
  flow: number;
  volume: number;
}

export interface DetectedBreath {
  idx: number;
  startIdx: number;
  endIdx: number;
  startTime: number;
  endTime: number;
  duration: number;
}

export interface BreathFeatures {
  breathIdx: number;
  pip: number;
  peep: number;
  vt: number;
  iTime: number;
  eTime: number;
  ieRatio: number;
  compliance: number | null;
  drivingPressure: number;
  peakFlow: number;
  flowAtEndInsp: number;
}

export type LFVote = 1 | 0;
export type PVALabel = "Normal" | "double_trigger" | "ineffective_effort" | "flow_starvation" | "early_termination" | "delayed_termination" | "air_trapping";

export interface LabelMatrixRow {
  breathIdx: number;
  lf_double_trigger: LFVote;
  lf_ineffective_effort: LFVote;
  lf_flow_starvation: LFVote;
  lf_early_termination: LFVote;
  lf_delayed_termination: LFVote;
  lf_air_trapping: LFVote;
  finalLabel: PVALabel;
  confidence: number;
  classProbabilities: Record<PVALabel, number>;
  firedLFs: string[];
  isUncertain: boolean;
}

export type PipelineStep = "upload" | "raw" | "layer1" | "layer2" | "snorkel" | "hla" | "result";

// HLA (Hysteresis Loop Analysis) — a second, methodologically independent,
// label-free classifier (Ang et al. 2024). Judges PV-loop geometry rather
// than time-domain features, so its taxonomy only partially overlaps
// PVALabel's — see HLA_TO_LF_LABEL in lib/demoPipeline.ts for the mapping.
export type HLALabel =
  | "normal" | "flow_asynchrony" | "reverse_triggering" | "premature_cycling"
  | "double_triggering" | "delayed_cycling" | "ineffective_effort" | "auto_triggering";

export interface HLAResult {
  breathIdx: number;
  label: HLALabel;
  nInsp: number;
  nExp: number;
  inspSlopes: number[];
  expSlopes: number[];
}
