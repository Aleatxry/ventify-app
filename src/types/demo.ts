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
export type PVALabel = "Normal" | "double_trigger" | "ineffective_effort" | "flow_starvation" | "premature_cycling";

export interface LabelMatrixRow {
  breathIdx: number;
  lf_double_trigger: LFVote;
  lf_ineffective_effort: LFVote;
  lf_flow_starvation: LFVote;
  lf_premature_cycling: LFVote;
  finalLabel: PVALabel;
  confidence: number;
  classProbabilities: Record<PVALabel, number>;
  firedLFs: string[];
  isUncertain: boolean;
}

export type PipelineStep = "upload" | "raw" | "layer1" | "layer2" | "snorkel" | "result";
