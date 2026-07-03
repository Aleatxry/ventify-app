"use client";

import type { HourlyCapture, WaveformPoint, PVABand, InstabilityClass } from "./mockHistory";
import type { PVAFlag, Severity } from "@/types/ventify";
import type { PatientRollup, PatientRollupEntry } from "./rollupLoader";

const FLAG_SEVERITY: Record<string, Severity> = {
  flow_starvation:     "Critical",
  double_trigger:      "Elevated",
  ineffective_effort:  "Elevated",
  early_termination:   "Elevated",
  delayed_termination: "Elevated",
  air_trapping:        "Critical",
};

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

function classifyFromRollup(data: PatientRollupEntry): InstabilityClass {
  const inst     = data.mean_instability;
  const totalPVA = data.n_breaths
    - (data.category_counts.normal      ?? 0)
    - (data.category_counts.unclassified ?? 0);
  const hasCritical = ((data.category_counts.flow_starvation ?? 0)
                     + (data.category_counts.air_trapping    ?? 0)) > 0;
  if (inst >= 0.40 || (hasCritical && totalPVA / Math.max(data.n_breaths, 1) > 0.3)) return "Critical";
  if (inst >= 0.15 || hasCritical) return "Elevated";
  if (totalPVA > 0) return "Mild";
  return "Stable";
}

function viiTrendFromRollup(data: PatientRollupEntry): "up" | "down" | "stable" {
  const trend = data.instability_trend;
  if (trend.length < 2) return "stable";
  const last = trend[trend.length - 1][1];
  const prev = trend[trend.length - 2][1];
  if (last - prev >  0.05) return "up";
  if (prev - last >  0.05) return "down";
  return "stable";
}

export interface RealBedHistory {
  captures:         HourlyCapture[];
  totalCaptures:    number;
  instabilityClass: InstabilityClass;
  viiTrend:         "up" | "down" | "stable";
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

          // Per-breath bands with flag embedded
          const pvaBands: PVABand[] = pvaBreaths.map(b => ({
            x1:   parseFloat(((b.index - 1) * duration / nBreaths).toFixed(3)),
            x2:   parseFloat((b.index       * duration / nBreaths).toFixed(3)),
            flag: b.category as PVAFlag,
          }));

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
            id:          path.replace("_WaveformExport.csv", ""),
            hour,
            timestampS,
            flags,
            confidence,
            severity,
            waveformData,
            pvaBands,
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
      totalCaptures:    captures.length,
      instabilityClass: classifyFromRollup(rollupData),
      viiTrend:         viiTrendFromRollup(rollupData),
    };
  } catch {
    return null;
  }
}
