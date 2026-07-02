import type {
  CsvWaveformPoint, DetectedBreath, BreathFeatures,
  LabelMatrixRow, PVALabel,
} from "@/types/demo";

// ─── CSV Parser ───────────────────────────────────────────────

export const DEFAULT_HZ = 25;

export interface ParseResult {
  data: CsvWaveformPoint[];
  hz: number;
  hasTime: boolean;
  detectedColumns: string[];
}

export function parseCSV(text: string): ParseResult {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error("CSV too short — need header + at least one data row");

  const rawHeaders = lines[0].split(",").map(h => h.trim());
  const headers    = rawHeaders.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ""));

  const find = (...candidates: string[]) => {
    for (const c of candidates) {
      const i = headers.findIndex(h => h.includes(c));
      if (i !== -1) return i;
    }
    return -1;
  };

  const ti = find("time", "timestamp", "seconds", "sec");
  const fi = find("flow", "fl");
  const pi = find("pressure", "paw", "pres");
  const vi = find("volume", "vol");

  if (fi === -1 || pi === -1 || vi === -1)
    throw new Error(`Cannot detect required columns (flow, pressure, volume) in header: "${lines[0]}"`);

  const hasTime = ti !== -1;
  const data: CsvWaveformPoint[] = [];

  for (let row = 1; row < lines.length; row++) {
    const cols = lines[row].split(",").map(c => parseFloat(c.trim()));
    const flow     = cols[fi];
    const pressure = cols[pi];
    const volume   = cols[vi];
    if (isNaN(flow) || isNaN(pressure) || isNaN(volume)) continue;
    const time = hasTime ? cols[ti] : (data.length / DEFAULT_HZ);
    data.push({ time, pressure, flow, volume });
  }

  if (data.length < 20) throw new Error("Parsed fewer than 20 valid rows — check CSV format");

  return {
    data,
    hz: hasTime ? Math.round(1 / (data[1].time - data[0].time)) : DEFAULT_HZ,
    hasTime,
    detectedColumns: rawHeaders,
  };
}

// ─── Layer 1: Breath Segmentation ────────────────────────────

const MIN_PTS        = 15;
const MIN_DURATION_S = 0.6;

function segmentByVolume(data: CsvWaveformPoint[]): DetectedBreath[] {
  const volumes = data.map(p => p.volume);
  const minVol  = Math.min(...volumes);
  const maxVol  = Math.max(...volumes);
  const troughThreshold = minVol + (maxVol - minVol) * 0.15;

  const starts: number[] = [];
  let inTrough = volumes[0] <= troughThreshold;
  for (let i = 1; i < data.length; i++) {
    const now = volumes[i] <= troughThreshold;
    if (!now && inTrough) starts.push(i);
    inTrough = now;
  }

  const breaths: DetectedBreath[] = [];
  for (let i = 0; i < starts.length - 1; i++) {
    const s = starts[i], e = starts[i + 1] - 1;
    if (e - s < MIN_PTS) continue;
    const duration = data[e].time - data[s].time;
    if (duration < MIN_DURATION_S) continue;
    breaths.push({ idx: breaths.length, startIdx: s, endIdx: e, startTime: data[s].time, endTime: data[e].time, duration });
  }
  return breaths;
}

function segmentByFlowZeroCrossing(data: CsvWaveformPoint[]): DetectedBreath[] {
  const FLOW_THRESHOLD = 2.0;
  const breaths: DetectedBreath[] = [];
  let start = 0;
  for (let i = 1; i < data.length; i++) {
    if (data[i].flow > FLOW_THRESHOLD && data[i - 1].flow <= FLOW_THRESHOLD) {
      if (i - start >= MIN_PTS) {
        const duration = data[i - 1].time - data[start].time;
        if (duration >= MIN_DURATION_S)
          breaths.push({ idx: breaths.length, startIdx: start, endIdx: i - 1, startTime: data[start].time, endTime: data[i - 1].time, duration });
      }
      start = i;
    }
  }
  return breaths;
}

export function segmentBreaths(data: CsvWaveformPoint[]): DetectedBreath[] {
  const volumes = data.map(p => p.volume);
  const range   = Math.max(...volumes) - Math.min(...volumes);
  const minFlow = Math.min(...data.map(p => p.flow));

  if (range > 50) {
    const v = segmentByVolume(data);
    if (v.length >= 1) return v;
  }
  if (minFlow < -5) return segmentByFlowZeroCrossing(data);
  return segmentByVolume(data);
}

// ─── Layer 2: Feature Extraction ─────────────────────────────
// Uses volume-peak as the insp/exp boundary — matches the training pipeline exactly

export function computeFeatures(data: CsvWaveformPoint[], breath: DetectedBreath): BreathFeatures {
  const slice     = data.slice(breath.startIdx, breath.endIdx + 1);
  const pressures = slice.map(p => p.pressure);
  const volumes   = slice.map(p => p.volume);

  const pip  = Math.max(...pressures);
  const peep = Math.min(...pressures);
  const dp   = pip - peep;
  const vt   = Math.max(...volumes) - Math.min(...volumes);

  // Split at volume peak — same method as training pipeline
  const peakVolIdx = volumes.indexOf(Math.max(...volumes));
  const insp = slice.slice(0, peakVolIdx + 1);
  const exp  = slice.slice(peakVolIdx);

  const iTime = insp.length > 1 ? insp[insp.length - 1].time - insp[0].time : 0;
  const eTime = exp.length  > 1 ? exp[exp.length - 1].time  - exp[0].time   : 0;

  const peakFlow = insp.length > 0 ? Math.max(...insp.map(p => p.flow)) : 0;

  // Flow at 80% of inspiration (flow_at_end_insp in training features)
  const cutoffTime = insp.length > 0 ? insp[0].time + iTime * 0.80 : 0;
  const lateInsp   = insp.filter(p => p.time >= cutoffTime);
  const flowAtEndInsp = lateInsp.length > 0
    ? lateInsp.reduce((s, p) => s + p.flow, 0) / lateInsp.length
    : 0;

  return {
    breathIdx:       breath.idx,
    pip:             +pip.toFixed(1),
    peep:            +peep.toFixed(1),
    vt:              +vt.toFixed(0),
    iTime:           +iTime.toFixed(3),
    eTime:           +eTime.toFixed(3),
    ieRatio:         eTime > 0 ? +(iTime / eTime).toFixed(2) : 0,
    compliance:      dp > 0 ? +(vt / dp).toFixed(1) : null,
    drivingPressure: +dp.toFixed(1),
    peakFlow:        +peakFlow.toFixed(1),
    flowAtEndInsp:   +flowAtEndInsp.toFixed(1),
  };
}

export function computeAllFeatures(data: CsvWaveformPoint[], breaths: DetectedBreath[]): BreathFeatures[] {
  return breaths.map(b => computeFeatures(data, b));
}

// ─── Snorkel-style Labeling Functions ────────────────────────────────────────
// Each LF votes for one PVA class or abstains (returns false).
// Multiple LFs per class give coverage from different angles.
// Final label = class with most votes; confidence = votes_winner / total_votes.

type PVAClass = Exclude<PVALabel, "Normal">;

interface LabelingFunction {
  name: string;
  label: PVAClass;
  fn: (f: BreathFeatures) => boolean;
}

const LABELING_FUNCTIONS: LabelingFunction[] = [
  // ── Double Trigger ─────────────────────────────────────────────
  // Short machine breath + patient immediately triggers another
  {
    name: "lf_dt_short_insp_high_ie",
    label: "double_trigger",
    fn: (f) => f.iTime < 0.5 && f.ieRatio > 0.7,
  },
  {
    name: "lf_dt_very_short_insp_high_flow",
    label: "double_trigger",
    fn: (f) => f.iTime < 0.35 && f.peakFlow > 50,
  },

  // ── Flow Starvation ────────────────────────────────────────────
  // Patient demands more flow than ventilator delivers — flow still high at end of insp
  {
    name: "lf_fs_end_flow_ratio",
    label: "flow_starvation",
    fn: (f) => f.peakFlow > 0 && (f.flowAtEndInsp / f.peakFlow) > 0.40 && f.iTime > 0.4,
  },
  {
    name: "lf_fs_high_absolute_end_flow",
    label: "flow_starvation",
    fn: (f) => f.flowAtEndInsp > 30 && f.iTime > 0.5,
  },
  {
    name: "lf_fs_prolonged_insp_with_flow",
    label: "flow_starvation",
    fn: (f) => f.iTime > 0.8 && f.ieRatio > 0.5 && f.flowAtEndInsp > 20,
  },

  // ── Premature Cycling ──────────────────────────────────────────
  // Ventilator stops delivering before patient finishes inspiring
  {
    name: "lf_pc_short_exp_high_ie",
    label: "premature_cycling",
    fn: (f) => f.eTime < 0.8 && f.eTime > 0.1 && f.ieRatio > 0.5,
  },
  {
    name: "lf_pc_very_high_ie_ratio",
    label: "premature_cycling",
    fn: (f) => f.ieRatio > 0.8 && f.eTime < 1.0,
  },

  // ── Ineffective Effort ─────────────────────────────────────────
  // Patient tries to breathe but ventilator does not trigger
  {
    name: "lf_ie_low_vt_with_effort",
    label: "ineffective_effort",
    fn: (f) => f.vt < 200 && f.iTime > 0.3,
  },
  {
    name: "lf_ie_very_low_vt",
    label: "ineffective_effort",
    fn: (f) => f.vt < 100,
  },
];

function applyLabelingFunctions(f: BreathFeatures): {
  label: PVALabel;
  confidence: number;
  fired: Partial<Record<PVAClass, boolean>>;
} {
  const counts: Partial<Record<PVAClass, number>> = {};
  const fired: Partial<Record<PVAClass, boolean>> = {};

  for (const lf of LABELING_FUNCTIONS) {
    if (lf.fn(f)) {
      counts[lf.label] = (counts[lf.label] ?? 0) + 1;
      fired[lf.label] = true;
    }
  }

  const totalVotes = (Object.values(counts) as number[]).reduce((a, b) => a + b, 0);

  if (totalVotes === 0) {
    return { label: "Normal", confidence: 1.0, fired: {} };
  }

  // Tie-break by clinical priority
  const priority: PVAClass[] = ["double_trigger", "flow_starvation", "premature_cycling", "ineffective_effort"];
  let winner: PVALabel = "Normal";
  let maxCount = 0;

  for (const cls of priority) {
    const count = counts[cls] ?? 0;
    if (count > maxCount) { maxCount = count; winner = cls; }
  }

  return { label: winner, confidence: +(maxCount / totalVotes).toFixed(3), fired };
}

export function classifyBreaths(
  _data: CsvWaveformPoint[],
  breaths: DetectedBreath[],
  features: BreathFeatures[],
): LabelMatrixRow[] {
  return features.map((f, i) => {
    const { label, confidence, fired } = applyLabelingFunctions(f);
    return {
      breathIdx:             breaths[i].idx,
      lf_double_trigger:     fired["double_trigger"]     ? 1 : 0,
      lf_ineffective_effort: fired["ineffective_effort"] ? 1 : 0,
      lf_flow_starvation:    fired["flow_starvation"]    ? 1 : 0,
      lf_premature_cycling:  fired["premature_cycling"]  ? 1 : 0,
      finalLabel:            label,
      confidence,
    };
  });
}

export function runSnorkel(
  data: CsvWaveformPoint[],
  breaths: DetectedBreath[],
  features: BreathFeatures[],
): LabelMatrixRow[] {
  return classifyBreaths(data, breaths, features);
}

// ─── Sample CSV Generator ─────────────────────────────────────

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function randn(m = 0, s = 1) {
  const u1 = Math.random() || 1e-9, u2 = Math.random() || 1e-9;
  return m + s * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

type BreathType = "normal" | "double_trigger" | "ineffective_effort" | "flow_starvation" | "premature_cycling";

export function generateSampleCSV(): string {
  const HZ = 25; const dt = 1 / HZ;

  const SPECS: { type: BreathType; period: number }[] = [
    { type: "normal",             period: 2.8 },
    { type: "normal",             period: 3.0 },
    { type: "double_trigger",     period: 3.2 },
    { type: "normal",             period: 2.9 },
    { type: "flow_starvation",    period: 3.1 },
    { type: "normal",             period: 2.7 },
    { type: "premature_cycling",  period: 2.3 },
    { type: "normal",             period: 3.0 },
    { type: "ineffective_effort", period: 3.0 },
    { type: "normal",             period: 2.8 },
    { type: "normal",             period: 2.9 },
    { type: "double_trigger",     period: 3.0 },
  ];

  const rows = ["time,pressure,flow,volume"];
  let t = 0;

  for (const spec of SPECS) {
    const n = Math.round(spec.period * HZ);
    const inspEnd = spec.period * 0.38;
    let vol = 0;

    for (let i = 0; i < n; i++) {
      const ti = i * dt;
      const isInsp = ti < inspEnd;

      let fBase = isInsp
        ? 42 * Math.sin(Math.PI * ti / inspEnd)
        : -22 * Math.sin(Math.PI * (ti - inspEnd) / (spec.period - inspEnd));

      if (spec.type === "double_trigger" && ti > spec.period * 0.78 && ti < spec.period * 0.95)
        fBase += 18 * Math.sin(Math.PI * (ti - spec.period * 0.78) / (spec.period * 0.17));
      if (spec.type === "flow_starvation" && isInsp) fBase = clamp(fBase, 0, 28 + randn(0, 1));
      if (spec.type === "premature_cycling" && !isInsp && ti - inspEnd < 0.3) fBase *= 0.2;

      const flow = clamp(fBase + randn(0, 0.8), -35, 60);

      let pBase = isInsp
        ? 8 + 18 * Math.sin(Math.PI * ti / inspEnd)
        : 8 + 3 * Math.exp(-4 * (ti - inspEnd) / (spec.period - inspEnd));
      if (spec.type === "ineffective_effort" && !isInsp && ti - inspEnd > 0.4 && ti - inspEnd < 0.9)
        pBase -= 4 * Math.sin(Math.PI * (ti - inspEnd - 0.4) / 0.5);

      const pressure = clamp(pBase + randn(0, 0.4), 3, 44);
      const dvol = (Math.abs(flow) / 60) * dt * 1000;
      vol = isInsp ? clamp(vol + dvol, 0, 650) : clamp(vol - dvol, 0, 650);

      rows.push(`${(t + ti).toFixed(3)},${pressure.toFixed(2)},${flow.toFixed(2)},${vol.toFixed(1)}`);
    }
    t += spec.period;
  }

  return rows.join("\n");
}
