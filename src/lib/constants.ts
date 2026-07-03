import type { Severity } from "@/types/ventify";

export const SEVERITY_COLORS: Record<Severity, {
  bg: string; text: string; pale: string; dot: string;
}> = {
  Normal:   { bg: "#34C759", text: "#FFFFFF", pale: "rgba(52,199,89,0.12)",   dot: "#34C759" },
  Elevated: { bg: "#FF9500", text: "#FFFFFF", pale: "rgba(255,149,0,0.12)",   dot: "#FF9500" },
  Critical: { bg: "#FF3B30", text: "#FFFFFF", pale: "rgba(255,59,48,0.10)",   dot: "#FF3B30" },
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

export function getSeverityFromInstability(value: number): Severity {
  if (value >= 60) return "Critical";
  if (value >= 30) return "Elevated";
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
