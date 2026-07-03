"use client";

import type { HourlyCapture, WaveformPoint, PVABand, BreathMetrics } from "./mockHistory";
import type { PVAFlag, Severity } from "@/types/ventify";
import type { PatientRollup, PatientRollupEntry } from "./rollupLoader";
import { FLAG_SEVERITY } from "./constants";
import { segmentBreaths } from "./demoPipeline";

const VALID_FLAGS = new Set([
  "flow_starvation", "double_trigger", "ineffective_effort",
  "early_termination", "delayed_termination", "air_trapping",
]);

interface BreathEntry {
  path: string;
  index: number;
  category: string;
  cluster_prob: number;
}

// Filename: {hash}_{day}_{HHMMSS}_WaveformExport.csv
function parseCaptureTime(filename: string): { hour: number; timestampS: number } {
  const parts = filename.split("_");
  // parts: [hash, day, HHMMSS, "WaveformExport.csv"]
  const hhmmss = parts[2];
  const day    = parseInt(parts[1], 10);
  const hour   = parseInt(hhmmss.slice(0, 2), 10);
  const minute = parseInt(hhmmss.slice(2, 4), 10);
  const second = parseInt(hhmmss.slice(4, 6), 10);
  // Use a stable base date so captures from different days sort correctly
  const base = new Date("2024-01-01T00:00:00Z").getTime() / 1000;
  return { hour, timestampS: base + day * 86400 + hour * 3600 + minute * 60 + second };
}

// CSV format: BOM + "Flow (l/min), Pressure (cmH2O), Volume (ml)" + blank + 250 data rows
function parseCSV(text: string): WaveformPoint[] {
  const lines = text.replace(/^﻿/, "").split("\n");
  const result: WaveformPoint[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("Flow")) continue;
    const parts = trimmed.split(",");
    if (parts.length < 3) continue;
    const flow     = parseFloat(parts[0]);
    const pressure = parseFloat(parts[1]);
    const volume   = parseFloat(parts[2]);
    if (isNaN(flow)) continue;
    result.push({
      time:     parseFloat((result.length * 0.04).toFixed(3)),
      flow,
      pressure,
      volume,
    });
  }
  return result;
}

// ---- Breath metrics computation from raw waveform ----

function computeBreathMetrics(waveform: WaveformPoint[]): BreathMetrics[] {
  const MIN_GAP = 20; // min 20 samples (0.8s) between breath starts
  const n = waveform.length;

  // Zero-crossings: flow neg→pos = inspiration starts
  const breathStarts: number[] = [];
  for (let i = 1; i < n; i++) {
    if (waveform[i - 1].flow < 0 && waveform[i].flow >= 0) {
      const last = breathStarts[breathStarts.length - 1] ?? -999;
      if (i - last > MIN_GAP) breathStarts.push(i);
    }
  }
  if (breathStarts.length < 2) return [];

  // Average duration of complete breaths (skip last partial)
  let totalDur = 0;
  for (let i = 0; i < breathStarts.length - 1; i++) {
    totalDur += breathStarts[i + 1] - breathStarts[i];
  }
  const avgDur = totalDur / (breathStarts.length - 1);

  // Start from first full breath (skip leading partial if capture began mid-expiration)
  const startIdx = waveform[0].flow < 0 ? 1 : 0;
  const metrics: BreathMetrics[] = [];

  for (let i = startIdx; i < breathStarts.length; i++) {
    const s   = breathStarts[i];
    const e   = i + 1 < breathStarts.length ? breathStarts[i + 1] : n;
    const len = e - s;

    // Skip final breath if clearly truncated at capture boundary
    if (i === breathStarts.length - 1 && len < avgDur * 0.65) continue;

    const seg = waveform.slice(s, e);
    if (seg.length < 8) continue;

    // Insp/exp split: first index where flow goes negative
    let ieSplit = seg.findIndex((p, j) => j > 0 && p.flow < 0);
    if (ieSplit < 1) ieSplit = Math.floor(seg.length * 2 / 3);

    const inspSeg = seg.slice(0, ieSplit);
    const expSeg  = seg.slice(ieSplit);
    if (inspSeg.length === 0) continue;

    const Ti = ieSplit * 0.04;
    const Te = (seg.length - ieSplit) * 0.04;
    const RR = 60 / (seg.length * 0.04);

    const pip  = Math.max(...inspSeg.map(p => p.pressure));
    const peepWin = expSeg.slice(-Math.max(3, Math.floor(expSeg.length / 4)));
    const peep = peepWin.length > 0
      ? peepWin.reduce((acc, p) => acc + p.pressure, 0) / peepWin.length
      : Math.min(...expSeg.map(p => p.pressure));
    const dp   = pip - peep;

    const vols = seg.map(p => p.volume);
    const vt   = Math.max(...vols) - Math.min(...vols);
    const comp = dp > 2 ? vt / dp : null;

    const pif  = Math.max(...inspSeg.map(p => p.flow));
    const pef  = expSeg.length > 0 ? Math.abs(Math.min(...expSeg.map(p => p.flow))) : 0;
    const map  = seg.reduce((acc, p) => acc + p.pressure, 0) / seg.length;

    metrics.push({
      breathNum:  metrics.length + 1,
      vt:         Math.round(vt),
      pip:        parseFloat(pip.toFixed(1)),
      peep:       parseFloat(peep.toFixed(1)),
      dp:         parseFloat(dp.toFixed(1)),
      compliance: comp !== null ? parseFloat(comp.toFixed(1)) : null,
      rr:         parseFloat(RR.toFixed(1)),
      ti:         parseFloat(Ti.toFixed(2)),
      te:         parseFloat(Te.toFixed(2)),
      ie:         Ti > 0 ? `1:${parseFloat((Te / Ti).toFixed(1))}` : "N/A",
      pif:        parseFloat(pif.toFixed(1)),
      pef:        parseFloat(pef.toFixed(1)),
      map:        parseFloat(map.toFixed(1)),
    });
  }

  return metrics;
}

export interface RealBedHistory {
  captures:         HourlyCapture[];
  totalCaptures:    number;
  patientHash:      string;
}

export async function loadRealCaptures(bedId: string): Promise<RealBedHistory | null> {
  try {
    // 1. Load rollup → find patient hash for this bedId
    const rollupRes = await fetch("/data/patient_rollup.json");
    if (!rollupRes.ok) return null;
    const rollup: PatientRollup = await rollupRes.json();

    const entries = Object.entries(rollup);
    const idx     = parseInt(bedId, 10) - 1;
    if (idx < 0 || idx >= entries.length) return null;
    const [patientHash, rollupData] = entries[idx];

    // 2. Load cluster_breaths
    const clusterRes = await fetch("/data/cluster_breaths.json");
    if (!clusterRes.ok) return null;
    const allBreaths: BreathEntry[] = await clusterRes.json();

    // 3. Group by capture path, filter to this patient
    const capMap = new Map<string, BreathEntry[]>();
    for (const b of allBreaths) {
      if (!b.path.startsWith(patientHash)) continue;
      if (!capMap.has(b.path)) capMap.set(b.path, []);
      capMap.get(b.path)!.push(b);
    }
    if (capMap.size === 0) return null;

    // 4. Load each CSV and build HourlyCapture
    const captures: HourlyCapture[] = [];

    await Promise.all(
      Array.from(capMap.entries()).map(async ([path, breaths]) => {
        try {
          const csvRes = await fetch(`/data/waveforms/${path}`);
          if (!csvRes.ok) return;
          const waveformData = parseCSV(await csvRes.text());
          if (waveformData.length === 0) return;

          const sorted   = [...breaths].sort((a, b) => a.index - b.index);
          const nBreaths = sorted.length;
          const duration = waveformData.length * 0.04; // ≈ 10s

          // PVA breaths only (ordered by breath index)
          const pvaBreaths = sorted.filter(b =>
            b.category !== "normal" && b.category !== "unclassified" && VALID_FLAGS.has(b.category)
          );

          // cluster_breaths.json only carries a breath INDEX, not its real
          // start/end time -- dividing duration evenly by breath count
          // assumed every breath is the same width, which real breaths
          // aren't (confirmed against actual capture charts: breath widths
          // visibly vary). Detect real breath boundaries in this capture's
          // own waveform instead, and use the ACTUAL breath at each index's
          // position for the highlight band's time range. Falls back to the
          // old even-division estimate only if detection finds fewer
          // breaths than the index needs (e.g. a differently-tuned JS
          // detector vs. the Python pipeline's own segmentation).
          const detected = segmentBreaths(waveformData);
          const pvaBands: PVABand[] = pvaBreaths.map(b => {
            const real = detected[b.index];
            return real
              ? { x1: parseFloat(real.startTime.toFixed(3)), x2: parseFloat(real.endTime.toFixed(3)), flag: b.category as PVAFlag }
              : {
                  x1: parseFloat(((b.index - 1) * duration / nBreaths).toFixed(3)),
                  x2: parseFloat((b.index * duration / nBreaths).toFixed(3)),
                  flag: b.category as PVAFlag,
                };
          });

          // Unique flags in appearance order
          const seenFlags = new Set<PVAFlag>();
          const flags: PVAFlag[] = [];
          for (const b of pvaBreaths) {
            if (!seenFlags.has(b.category as PVAFlag)) {
              seenFlags.add(b.category as PVAFlag);
              flags.push(b.category as PVAFlag);
            }
          }

          const hasCritical = flags.some(f => FLAG_SEVERITY[f] === "Critical");
          const severity: Severity = flags.length === 0 ? "Normal"
            : hasCritical ? "Critical" : "Elevated";

          const confidence = pvaBreaths.length > 0
            ? pvaBreaths.reduce((s, b) => s + b.cluster_prob, 0) / pvaBreaths.length
            : 0;

          const { hour, timestampS } = parseCaptureTime(path);

          captures.push({
            id:           path.replace("_WaveformExport.csv", ""),
            hour,
            timestampS,
            flags,
            confidence,
            severity,
            waveformData,
            pvaBands,
            breathMetrics: computeBreathMetrics(waveformData),
          });
        } catch {
          // skip individual CSV errors
        }
      })
    );

    if (captures.length === 0) return null;

    captures.sort((a, b) => a.timestampS - b.timestampS);

    return {
      captures,
      totalCaptures: captures.length,
      patientHash,
    };
  } catch {
    return null;
  }
}
