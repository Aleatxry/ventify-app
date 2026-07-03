import type {
  CsvWaveformPoint, DetectedBreath, BreathFeatures,
  LabelMatrixRow, PVALabel, HLALabel, HLAResult,
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
  for (let i = 0; i < starts.length; i++) {
    const s = starts[i];
    // Last start has no "next start" to close it — without this, the trailing
    // breath in any recording is silently dropped rather than segmented
    // (confirmed: generateSampleCSV's 14th breath never appeared in output).
    // Trail it to the end of the data instead, same as every other breath.
    const e = i + 1 < starts.length ? starts[i + 1] - 1 : data.length - 1;
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

  // ── Early Termination (Premature Cycling) ─────────────────────
  // Ventilator stops delivering before patient finishes inspiring
  {
    name: "lf_et_short_exp_high_ie",
    label: "early_termination",
    fn: (f) => f.eTime < 0.8 && f.eTime > 0.1 && f.ieRatio > 0.5,
  },
  {
    name: "lf_et_very_high_ie_ratio",
    label: "early_termination",
    fn: (f) => f.ieRatio > 0.8 && f.eTime < 1.0,
  },

  // ── Delayed Termination ────────────────────────────────────────
  // Ventilator keeps inflating past when patient stopped wanting it
  {
    name: "lf_dtm_prolonged_itime",
    label: "delayed_termination",
    fn: (f) => f.iTime > 0.90 && f.ieRatio > 0.75,
  },
  {
    name: "lf_dtm_high_dp_long_insp",
    label: "delayed_termination",
    fn: (f) => f.drivingPressure > 14 && f.iTime > 0.80 && f.eTime < 0.70,
  },

  // ── Air Trapping ───────────────────────────────────────────────
  // Not enough expiratory time to exhale the delivered volume
  {
    name: "lf_at_short_etime_high_vt",
    label: "air_trapping",
    fn: (f) => f.eTime < 0.65 && f.vt > 320,
  },
  {
    name: "lf_at_very_short_etime",
    label: "air_trapping",
    fn: (f) => f.eTime < 0.50 && f.vt > 180,
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
  firedLFs: string[];
  classProbabilities: Record<PVALabel, number>;
  isUncertain: boolean;
} {
  const counts: Partial<Record<PVAClass, number>> = {};
  const fired: Partial<Record<PVAClass, boolean>> = {};
  const firedLFs: string[] = [];

  for (const lf of LABELING_FUNCTIONS) {
    if (lf.fn(f)) {
      counts[lf.label] = (counts[lf.label] ?? 0) + 1;
      fired[lf.label] = true;
      firedLFs.push(lf.name);
    }
  }

  const totalVotes = (Object.values(counts) as number[]).reduce((a, b) => a + b, 0);

  const classProbabilities: Record<PVALabel, number> = {
    Normal: 0, double_trigger: 0, flow_starvation: 0,
    early_termination: 0, ineffective_effort: 0,
    delayed_termination: 0, air_trapping: 0,
  };

  if (totalVotes === 0) {
    classProbabilities.Normal = 1.0;
    return { label: "Normal", confidence: 1.0, fired: {}, firedLFs: [], classProbabilities, isUncertain: false };
  }

  for (const [cls, count] of Object.entries(counts) as [PVAClass, number][]) {
    classProbabilities[cls] = +(count / totalVotes).toFixed(3);
  }

  const classesWithVotes = Object.keys(counts).length;
  const isUncertain = classesWithVotes > 1;

  // Tie-break by clinical priority
  const priority: PVAClass[] = ["double_trigger", "flow_starvation", "early_termination", "ineffective_effort", "delayed_termination", "air_trapping"];
  let winner: PVALabel = "Normal";
  let maxCount = 0;

  for (const cls of priority) {
    const count = counts[cls] ?? 0;
    if (count > maxCount) { maxCount = count; winner = cls; }
  }

  return {
    label: winner,
    confidence: +(maxCount / totalVotes).toFixed(3),
    fired, firedLFs, classProbabilities, isUncertain,
  };
}

export function classifyBreaths(
  _data: CsvWaveformPoint[],
  breaths: DetectedBreath[],
  features: BreathFeatures[],
): LabelMatrixRow[] {
  return features.map((f, i) => {
    const { label, confidence, fired, firedLFs, classProbabilities, isUncertain } = applyLabelingFunctions(f);
    return {
      breathIdx:             breaths[i].idx,
      lf_double_trigger:      fired["double_trigger"]      ? 1 : 0,
      lf_ineffective_effort:  fired["ineffective_effort"]  ? 1 : 0,
      lf_flow_starvation:     fired["flow_starvation"]     ? 1 : 0,
      lf_early_termination:   fired["early_termination"]   ? 1 : 0,
      lf_delayed_termination: fired["delayed_termination"] ? 1 : 0,
      lf_air_trapping:        fired["air_trapping"]        ? 1 : 0,
      finalLabel:            label,
      confidence,
      classProbabilities,
      firedLFs,
      isUncertain,
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

// ─── HLA: Hysteresis Loop Analysis (Ang et al. 2024) ─────────────────────────
// A SECOND, methodologically independent, label-free classifier — ports the
// same core/backend algorithm in ventsight_hla.py (DP-optimal piecewise
// P-vs-V regression per half-cycle + a nested F-test for segment count, then
// Table 1's segment-count/slope-sign/breakpoint-volume rules) into JS, so
// the demo can show it as its own level rather than calling the Python
// backend (matching how Layer1/Layer2/Snorkel above are already JS-native
// reimplementations, not calls into the real pipeline). Judges the loop's
// GEOMETRY, where the LFs above judge the TIME-domain shape — HLA also
// reaches reverse-triggering and auto-triggering, which the LFs can't.

const HLA_MIN_SEG_LEN = 3;
const HLA_MAX_SEG     = 5;
const HLA_F_CRIT       = 8.0;   // heuristic critical value, tuned on synthetic
                                // loops (see ventsight_hla.py) so a noisy 2-seg
                                // loop stays 2 and a real multi-kink loop splits
const HLA_SLOPE_TOL    = 1e-3;
const HLA_EPS_CLOSE    = 100.0; // mL — Ang 2024 uses 0.1 L; end-expiratory
                                // volume above this means the loop doesn't close

export const HLA_TO_LF_LABEL: Record<HLALabel, PVALabel | null> = {
  normal:              "Normal",
  flow_asynchrony:     "flow_starvation",
  reverse_triggering:  null,   // no LF counterpart — coverage HLA adds
  premature_cycling:   "early_termination",
  double_triggering:   "double_trigger",
  delayed_cycling:     "delayed_termination",
  ineffective_effort:  "ineffective_effort",
  auto_triggering:     null,   // no LF counterpart — coverage HLA adds
};

function lineFit(v: number[], p: number[]): [slope: number, intercept: number, rsse: number] {
  const n = v.length;
  const meanV = v.reduce((a, b) => a + b, 0) / n;
  const meanP = p.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (v[i] - meanV) * (p[i] - meanP); den += (v[i] - meanV) ** 2; }
  const m = den === 0 ? 0 : num / den;
  const c = meanP - m * meanV;
  let rsse = 0;
  for (let i = 0; i < n; i++) { const r = p[i] - (m * v[i] + c); rsse += r * r; }
  return [m, c, rsse];
}

/** err[i][j] = RSSE of ONE line over points i..j inclusive (Infinity if too short). */
function segErrors(v: number[], p: number[]): number[][] {
  const N = v.length;
  const err: number[][] = Array.from({ length: N }, () => new Array(N).fill(Infinity));
  for (let i = 0; i < N; i++)
    for (let j = i + HLA_MIN_SEG_LEN - 1; j < N; j++)
      err[i][j] = lineFit(v.slice(i, j + 1), p.slice(i, j + 1))[2];
  return err;
}

/** DP over precomputed segment errors -> optimal n-segment partition. */
function bestSeg(err: number[][], N: number, n: number): [rsse: number, bounds: [number, number][]] {
  if (N < n * HLA_MIN_SEG_LEN) return [Infinity, []];
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(N).fill(Infinity));
  const bp: number[][] = Array.from({ length: n + 1 }, () => new Array(N).fill(-1));
  for (let j = 0; j < N; j++) dp[1][j] = err[0][j];
  for (let k = 2; k <= n; k++)
    for (let j = 0; j < N; j++)
      for (let m = k - 1; m < j; m++) {
        const cand = dp[k - 1][m] + err[m + 1][j];
        if (cand < dp[k][j]) { dp[k][j] = cand; bp[k][j] = m; }
      }
  if (!isFinite(dp[n][N - 1])) return [Infinity, []];
  const bounds: [number, number][] = [];
  let j = N - 1;
  for (let k = n; k >= 1; k--) {
    const m = bp[k][j];
    bounds.push([k > 1 ? m + 1 : 0, j]);
    j = m;
  }
  bounds.reverse();
  return [dp[n][N - 1], bounds];
}

/** F-test piecewise fit of one half-cycle -> (n, per-segment slopes, internal
 * breakpoint volumes). A normal half-cycle needs 2 segments; asynchrony forces
 * more, but only if the RSSE reduction clears the noise floor (HLA_F_CRIT). */
function segmentLimb(v: number[], p: number[]): [n: number, slopes: number[], brkVols: number[]] {
  const N = v.length;
  if (N < 2 * HLA_MIN_SEG_LEN) return N >= 2 ? [1, [lineFit(v, p)[0]], []] : [1, [], []];
  const err = segErrors(v, p);
  const kmax = Math.min(HLA_MAX_SEG, Math.floor(N / HLA_MIN_SEG_LEN));
  const rsse: Record<number, number> = {};
  for (let k = 2; k <= kmax; k++) rsse[k] = bestSeg(err, N, k)[0];

  const meanP = p.reduce((a, b) => a + b, 0) / N;
  const tss = p.reduce((s, pi) => s + (pi - meanP) ** 2, 0);
  const df = N - 4;
  let n = 2;
  if (!(df <= 0 || tss <= 0 || !isFinite(rsse[2]) || rsse[2] / tss < 1e-3)) {
    const sigma2 = rsse[2] / df;
    while (n < kmax) {
      if (!isFinite(rsse[n + 1])) break;
      if ((rsse[n] - rsse[n + 1]) / sigma2 > HLA_F_CRIT) n++; else break;
    }
  }
  const [, bounds] = bestSeg(err, N, n);
  const slopes = bounds.map(([lo, hi]) => lineFit(v.slice(lo, hi + 1), p.slice(lo, hi + 1))[0]);
  const brkVols = bounds.slice(0, -1).map(([, hi]) => v[hi]);
  return [n, slopes, brkVols];
}

function hlaSigns(slopes: number[]): number[] {
  return slopes.map(s => (s > HLA_SLOPE_TOL ? 1 : s < -HLA_SLOPE_TOL ? -1 : 0));
}

function signsMatch(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/** One breath -> an HLAResult (see Table 1, ventsight_hla.py's classify_breath
 * for the same rules on the Python side). First matching rule wins. */
export function classifyHLA(data: CsvWaveformPoint[], breath: DetectedBreath): HLAResult {
  const slice = data.slice(breath.startIdx, breath.endIdx + 1);
  const volumes = slice.map(p => p.volume);
  const v0 = Math.min(...volumes);
  const peakVolIdx = volumes.indexOf(Math.max(...volumes));

  // Same peak-volume half-cycle split as computeFeatures above. Pressure is
  // left un-baselined here (unlike the Python side's PEEP subtraction) since
  // every rule below only reads segment SLOPES or volume differences, and an
  // OLS slope is invariant to a constant shift in either axis.
  const insp = slice.slice(0, peakVolIdx + 1);
  const exp  = slice.slice(peakVolIdx);
  const vi = insp.map(pt => pt.volume - v0), pi = insp.map(pt => pt.pressure);
  const ve = exp.map(pt => pt.volume - v0),  pe = exp.map(pt => pt.pressure);

  const fallback: HLAResult = { breathIdx: breath.idx, label: "normal", nInsp: 0, nExp: 0, inspSlopes: [], expSlopes: [] };
  if (vi.length < 2 * HLA_MIN_SEG_LEN || ve.length < 2 * HLA_MIN_SEG_LEN) return fallback;
  const vt = vi[vi.length - 1];
  if (vt <= 0) return fallback;

  const [ni, si] = segmentLimb(vi, pi);
  const [ne, se, bxe] = segmentLimb(ve, pe);
  const gi = hlaSigns(si), ge = hlaSigns(se);
  const base = { breathIdx: breath.idx, nInsp: ni, nExp: ne, inspSlopes: si, expSlopes: se };

  // AT — loop fails to close (non-zero end-expiratory volume, e.g. circuit leak)
  if (ve[ve.length - 1] > HLA_EPS_CLOSE) return { ...base, label: "auto_triggering" };

  // DT — 5 segments over inspiration, volume-stacking shape
  if (ni === 5 && si[0] > 0 && si[0] > si[1] && si[2] > si[1] && si[3] > si[2])
    return { ...base, label: "double_triggering" };

  // Inspiratory-limb asynchronies (FA / DC share a sign pattern; RT distinct)
  if (ni === 4) {
    if (signsMatch(gi, [1, -1, 1, 1])) {
      if (si[3] > 2 * si[2]) return { ...base, label: "delayed_cycling" };
      return { ...base, label: "flow_asynchrony" };
    }
    if (signsMatch(gi, [1, 1, -1, 1])) return { ...base, label: "reverse_triggering" };
  }

  // Expiratory-limb asynchronies (PC / IE), located by how far into
  // expiration the distortion sits relative to tidal volume
  if (ne === 4 && bxe.length) {
    const vN0 = ve[0];
    const drop1 = vN0 - bxe[0];
    const drop2 = bxe.length > 1 ? vN0 - bxe[1] : drop1;
    if (signsMatch(ge, [1, -1, 1, 1]) && drop1 < 0.5 * vt) return { ...base, label: "premature_cycling" };
    if (signsMatch(ge, [1, 1, -1, 1]) && drop2 > 0.5 * vt) return { ...base, label: "ineffective_effort" };
  }

  return { ...base, label: "normal" };
}

export function computeAllHLA(data: CsvWaveformPoint[], breaths: DetectedBreath[]): HLAResult[] {
  return breaths.map(b => classifyHLA(data, b));
}

// ─── Sample CSV Generator ─────────────────────────────────────

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function randn(m = 0, s = 1) {
  const u1 = Math.random() || 1e-9, u2 = Math.random() || 1e-9;
  return m + s * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

type BreathType = "normal" | "double_trigger" | "ineffective_effort" | "flow_starvation" | "early_termination" | "delayed_termination" | "air_trapping";

// period/inspFrac/peakFlow are chosen so each type's OWN computeFeatures()
// output actually crosses its OWN LABELING_FUNCTIONS thresholds above — the
// original version only perturbed flow/pressure cosmetically (a late flow
// blip for double_trigger, a pressure dip for ineffective_effort) without
// checking whether that moved the specific feature each LF reads. It didn't:
// e.g. ineffective_effort's LFs check tidal volume, but the old generator
// only perturbed pressure, so vt never dropped and the LF never fired for
// ANY of the 6 injected abnormal types (verified via a diagnostic route
// before this fix — every one landed as "Normal" through classifyBreaths).
interface BreathSpec { type: BreathType; period: number; inspFrac: number; peakFlow: number }

const SPECS: BreathSpec[] = [
  { type: "normal",              period: 2.8, inspFrac: 0.38, peakFlow: 42 },
  { type: "normal",              period: 3.0, inspFrac: 0.38, peakFlow: 42 },
  { type: "double_trigger",      period: 1.0, inspFrac: 0.30, peakFlow: 58 },
  { type: "normal",              period: 2.9, inspFrac: 0.38, peakFlow: 42 },
  { type: "flow_starvation",     period: 3.0, inspFrac: 0.45, peakFlow: 40 },
  { type: "normal",              period: 2.7, inspFrac: 0.38, peakFlow: 42 },
  { type: "early_termination",   period: 1.6, inspFrac: 0.78, peakFlow: 42 },
  { type: "delayed_termination", period: 2.3, inspFrac: 0.68, peakFlow: 42 },
  { type: "air_trapping",        period: 1.3, inspFrac: 0.65, peakFlow: 42 },
  { type: "normal",              period: 3.0, inspFrac: 0.38, peakFlow: 42 },
  { type: "ineffective_effort",  period: 2.6, inspFrac: 0.38, peakFlow: 13 },
  { type: "normal",              period: 2.8, inspFrac: 0.38, peakFlow: 42 },
  { type: "normal",              period: 2.9, inspFrac: 0.38, peakFlow: 42 },
  { type: "double_trigger",      period: 1.1, inspFrac: 0.30, peakFlow: 58 },
];

export function generateSampleCSV(): string {
  const HZ = 25; const dt = 1 / HZ;

  const rows = ["time,pressure,flow,volume"];
  let t = 0;

  for (const spec of SPECS) {
    const n = Math.round(spec.period * HZ);
    const inspEnd = spec.period * spec.inspFrac;
    let vol = 0;

    for (let i = 0; i < n; i++) {
      const ti = i * dt;
      const isInsp = ti < inspEnd;

      let fBase: number;
      if (spec.type === "flow_starvation" && isInsp) {
        // Clinical signature: flow stays demanded/high right up to the end
        // of inspiration instead of tapering off — a fast ramp then a
        // plateau near peakFlow, not a sine that decays back to 0.
        fBase = Math.min(spec.peakFlow, spec.peakFlow * (ti / (inspEnd * 0.3)));
      } else {
        fBase = isInsp
          ? spec.peakFlow * Math.sin(Math.PI * ti / inspEnd)
          : -22 * Math.sin(Math.PI * (ti - inspEnd) / (spec.period - inspEnd));
      }

      const flow = clamp(fBase + randn(0, 0.8), -35, 65);

      const pBase = isInsp
        ? 8 + 18 * Math.sin(Math.PI * ti / inspEnd)
        : 8 + 3 * Math.exp(-4 * (ti - inspEnd) / (spec.period - inspEnd));

      const pressure = clamp(pBase + randn(0, 0.4), 3, 44);
      const dvol = (Math.abs(flow) / 60) * dt * 1000;
      vol = isInsp ? clamp(vol + dvol, 0, 650) : clamp(vol - dvol, 0, 650);

      rows.push(`${(t + ti).toFixed(3)},${pressure.toFixed(2)},${flow.toFixed(2)},${vol.toFixed(1)}`);
    }
    t += spec.period;
  }

  return rows.join("\n");
}
