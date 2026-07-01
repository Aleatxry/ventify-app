import type {
  CsvWaveformPoint, DetectedBreath, BreathFeatures,
  LabelMatrixRow, LFVote, PVALabel,
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

// ─── Model Inference (PyTorch MLP via ONNX) ──────────────────────────────────

interface ModelMeta {
  classes: PVALabel[];
  feature_cols: string[];
  scaler_mean: number[];
  scaler_scale: number[];
}

type OrtSession = Awaited<ReturnType<typeof import("onnxruntime-web").InferenceSession.create>>;

let cachedSession: OrtSession | null = null;
let cachedMeta: ModelMeta | null = null;

async function loadOnnxModel(): Promise<{ session: OrtSession; meta: ModelMeta }> {
  if (cachedSession && cachedMeta) return { session: cachedSession, meta: cachedMeta };

  const [metaRes] = await Promise.all([fetch("/model/pva_model_meta.json")]);
  cachedMeta = await metaRes.json() as ModelMeta;

  const { InferenceSession, env } = await import("onnxruntime-web");
  env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/";
  cachedSession = await InferenceSession.create("/model/pva_classifier.onnx", { executionProviders: ["wasm"] });

  return { session: cachedSession, meta: cachedMeta };
}

function featuresToArray(f: BreathFeatures): number[] {
  return [f.pip, f.peep, f.vt, f.drivingPressure, f.iTime, f.eTime, f.ieRatio, f.peakFlow, f.flowAtEndInsp];
}

function softmax(logits: number[]): number[] {
  const max = Math.max(...logits);
  const exps = logits.map(x => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map(x => x / sum);
}

export async function classifyBreaths(
  _data: CsvWaveformPoint[],
  breaths: DetectedBreath[],
  features: BreathFeatures[],
): Promise<LabelMatrixRow[]> {
  const { session, meta } = await loadOnnxModel();
  const { Tensor } = await import("onnxruntime-web");

  const results: LabelMatrixRow[] = [];

  for (let i = 0; i < breaths.length; i++) {
    const raw = featuresToArray(features[i]);

    // Apply same StandardScaler as training
    const scaled = raw.map((v, j) => (v - meta.scaler_mean[j]) / meta.scaler_scale[j]);

    const inputTensor = new Tensor("float32", new Float32Array(scaled), [1, scaled.length]);
    const output = await session.run({ features: inputTensor });
    const logits = Array.from(output["logits"].data as Float32Array);
    const probs = softmax(logits);

    const classIdx = probs.indexOf(Math.max(...probs));
    const label = meta.classes[classIdx] ?? "Normal";
    const confidence = probs[classIdx];

    const dt: LFVote = label === "double_trigger"     ? 1 : 0;
    const ie: LFVote = label === "ineffective_effort" ? 1 : 0;
    const fs: LFVote = label === "flow_starvation"    ? 1 : 0;
    const pc: LFVote = label === "premature_cycling"  ? 1 : 0;

    results.push({
      breathIdx: breaths[i].idx,
      lf_double_trigger: dt, lf_ineffective_effort: ie,
      lf_flow_starvation: fs, lf_premature_cycling: pc,
      finalLabel: label as PVALabel,
      confidence: +confidence.toFixed(3),
    });
  }

  return results;
}

// sync stub — model is async-only; kept for type compatibility
export function runSnorkel(
  _data: CsvWaveformPoint[],
  breaths: DetectedBreath[],
  _features: BreathFeatures[],
): LabelMatrixRow[] {
  return breaths.map(b => ({
    breathIdx: b.idx, lf_double_trigger: 0, lf_ineffective_effort: 0,
    lf_flow_starvation: 0, lf_premature_cycling: 0,
    finalLabel: "Normal" as PVALabel, confidence: 0,
  }));
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
