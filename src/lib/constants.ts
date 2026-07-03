import type { Severity } from "@/types/ventify";

export const SEVERITY_COLORS: Record<Severity, {
  bg: string; text: string; pale: string; dot: string;
}> = {
  Normal:   { bg: "#34C759", text: "#FFFFFF", pale: "rgba(52,199,89,0.12)",   dot: "#34C759" },
  Elevated: { bg: "#FF9500", text: "#FFFFFF", pale: "rgba(255,149,0,0.12)",   dot: "#FF9500" },
  Critical: { bg: "#FF3B30", text: "#FFFFFF", pale: "rgba(255,59,48,0.10)",   dot: "#FF3B30" },
};

// Per-type clinical severity, independent of any one patient's averaged
// instability -- a flow_starvation/air_trapping breath is inherently more
// urgent than an ineffective_effort one, regardless of how it averages out
// over that patient's whole ICU stay. Single source of truth: was previously
// duplicated in realDataLoader.ts and mockHistory.ts.
export const FLAG_SEVERITY: Record<string, Severity> = {
  flow_starvation:     "Critical",
  air_trapping:        "Critical",
  double_trigger:      "Elevated",
  ineffective_effort:  "Elevated",
  early_termination:   "Elevated",
  delayed_termination: "Elevated",
};

export const PVA_LABELS: Record<string, string> = {
  double_trigger:      "Double Trigger",
  ineffective_effort:  "Ineffective Effort",
  flow_starvation:     "Flow Starvation",
  delayed_termination: "Delayed Termination",
  early_termination:   "Early Termination",
  air_trapping:        "Air Trapping",
};

export const PVA_SHORT: Record<string, string> = {
  double_trigger:      "Dbl. Trigger",
  ineffective_effort:  "Ineff. Effort",
  flow_starvation:     "Flow Starv.",
  delayed_termination: "Delayed Term.",
  early_termination:   "Early Term.",
  air_trapping:        "Air Trapping",
};

export const WAVEFORM_COLORS = {
  pressure:   "#FFD60A",
  flow:       "#30D158",
  volume:     "#0A84FF",
  background: "#0D1117",
  grid:       "rgba(255,255,255,0.06)",
  axis:       "rgba(255,255,255,0.4)",
};

export const WAVEFORM_WINDOW_S = 30;

// Thresholds calibrated against the real pipeline's patient-level mean
// instability (out_real/patient_rollup.json across all 78 real patients:
// range 1.8-28.5%, nobody crosses 30) -- the original 60/30 cutoffs meant
// every real patient always landed Normal regardless of who was shown,
// since patient-level mean instability is an average over their whole ICU
// stay and dilutes any single hot window. 25/12 puts the real distribution's
// actual top few percent into Critical/Elevated instead.
export function getSeverityFromInstability(value: number): Severity {
  if (value >= 25) return "Critical";
  if (value >= 12) return "Elevated";
  return "Normal";
}

export function getNewsColor(score: number): string {
  if (score >= 7) return "var(--v-critical)";
  if (score >= 5) return "var(--v-elevated)";
  return "var(--v-text-1)";
}

export function formatTimestamp(unixS: number): string {
  return new Date(unixS * 1000).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatMetric(value: number | null, decimals = 1): string {
  if (value === null || value === undefined) return "—";
  return value.toFixed(decimals);
}
