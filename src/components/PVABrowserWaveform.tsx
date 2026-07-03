"use client";

import {
  ComposedChart, Line, XAxis, YAxis, ResponsiveContainer,
  CartesianGrid, ReferenceArea, ReferenceLine, Tooltip,
} from "recharts";
import type { WaveformPoint, PVABand } from "@/lib/mockHistory";
import type { PVAFlag } from "@/types/ventify";

interface Props {
  waveformData: WaveformPoint[];
  pvaBands: PVABand[];
  flagAbbrev: string;
  flags?: PVAFlag[];
}

// Pastel fill colors — adapted from PDF reference (light-theme fills → dark-theme equivalent)
const FILL_COLOR: Record<string, string> = {
  flow_starvation:     "rgba(255,160,75,0.22)",   // peach/orange
  double_trigger:      "rgba(80,190,255,0.18)",   // sky blue
  ineffective_effort:  "rgba(165,110,255,0.18)",  // lavender
  early_termination:   "rgba(180,165,145,0.20)",  // gray-tan
  delayed_termination: "rgba(255,100,110,0.20)",  // salmon/pink
  air_trapping:        "rgba(255,140,195,0.18)",  // light pink
};

// Accent colors for labels and legend text (readable on dark bg)
export const FLAG_COLOR: Record<string, string> = {
  flow_starvation:     "#FF9500",
  double_trigger:      "#5AC8FA",
  ineffective_effort:  "#BF7FFF",
  early_termination:   "#A0927A",
  delayed_termination: "#FF6060",
  air_trapping:        "#FF7DC3",
};

const FLAG_ABBREV: Record<string, string> = {
  flow_starvation:     "FS",
  double_trigger:      "DT",
  ineffective_effort:  "IE",
  early_termination:   "ET",
  delayed_termination: "DTM",
  air_trapping:        "AT",
};

const FLAG_LABEL: Record<string, string> = {
  flow_starvation:     "Flow Starvation",
  double_trigger:      "Double Trigger",
  ineffective_effort:  "Ineffective Effort",
  early_termination:   "Early Termination",
  delayed_termination: "Delayed Termination",
  air_trapping:        "Air Trapping",
};

const C = {
  flow:     "#FFD60A",
  pressure: "#0A84FF",
  volume:   "#64D2FF",
  bg:       "#0D1117",
  grid:     "rgba(255,255,255,0.05)",
  axis:     "rgba(255,255,255,0.45)",
  zeroLine: "rgba(255,255,255,0.45)",
  peepLine: "rgba(10,132,255,0.65)",
};

/** Assign one flag per PVA breath band. Uses band.flag if present (real data), else cycles. */
function buildBandAssignments(pvaBands: PVABand[], flags: PVAFlag[]) {
  if (flags.length === 0) return [];
  return pvaBands.map((band, i) => ({
    x1:   band.x1,
    x2:   band.x2,
    flag: band.flag ?? flags[i % flags.length],
  }));
}

// ---- Panel ----

interface PanelProps {
  data: WaveformPoint[];
  dataKey: keyof Omit<WaveformPoint, "time">;
  color: string;
  yLabel: string;
  unit: string;
  bands?: { x1: number; x2: number; flag: PVAFlag }[];
  showLabels?: boolean;
  showXAxis: boolean;
  refLine?: { y: number; color: string };
}

function Panel({ data, dataKey, color, yLabel, unit, bands, showLabels, showXAxis, refLine }: PanelProps) {
  const height = showXAxis ? 100 : 86;

  return (
    <div>
      <div style={{ paddingLeft: 4, marginBottom: 2, display: "flex", alignItems: "baseline", gap: 4 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: C.axis, textTransform: "uppercase", letterSpacing: "0.07em" }}>
          {yLabel}
        </span>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)" }}>({unit})</span>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: 36 }}>
          <CartesianGrid strokeDasharray="2 4" stroke={C.grid} vertical={false} />

          {/* PVA highlighted bands — span full height of this panel */}
          {bands?.map((b, i) => (
            <ReferenceArea
              key={i}
              x1={b.x1}
              x2={b.x2}
              fill={FILL_COLOR[b.flag] ?? "rgba(255,149,0,0.18)"}
              stroke="none"
              label={showLabels ? {
                value: FLAG_ABBREV[b.flag] ?? b.flag.toUpperCase(),
                position: "insideTop",
                fill: FLAG_COLOR[b.flag] ?? "#FF9500",
                fontSize: 10,
                fontWeight: 700,
              } : undefined}
            />
          ))}

          {/* Zero / PEEP reference line */}
          {refLine && (
            <ReferenceLine
              y={refLine.y}
              stroke={refLine.color}
              strokeDasharray="4 5"
              strokeWidth={1.5}
            />
          )}

          <XAxis
            dataKey="time"
            type="number"
            domain={["dataMin", "dataMax"]}
            hide={!showXAxis}
            tickCount={7}
            tick={showXAxis ? { fontSize: 9, fill: C.axis } : false}
            tickLine={showXAxis}
            axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
            tickFormatter={v => `${Number(v).toFixed(1)}`}
          />
          <YAxis
            tick={{ fontSize: 8, fill: C.axis }}
            tickLine={false}
            axisLine={false}
            width={30}
            tickCount={3}
          />
          <Tooltip
            contentStyle={{
              background: "#1A1F2E",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              fontSize: 10,
              color: "#F5F5F7",
            }}
            labelFormatter={v => `t = ${Number(v).toFixed(2)}s`}
            formatter={(v) => [typeof v === "number" ? `${v.toFixed(2)} ${unit}` : v, yLabel]}
          />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            dot={false}
            strokeWidth={1.6}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---- Main component ----

export default function PVABrowserWaveform({ waveformData, pvaBands, flags = [] }: Props) {
  const bands  = buildBandAssignments(pvaBands, flags);
  const hasPVA = flags.length > 0;

  return (
    <div style={{
      background: C.bg,
      borderRadius: 12,
      padding: "10px 6px 6px",
      display: "flex",
      flexDirection: "column",
      gap: 0,
    }}>
      {/* Legend chips — pastel fill matching the chart highlight color */}
      {hasPVA && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          flexWrap: "wrap", padding: "0 6px 10px",
        }}>
          {flags.map(flag => {
            const ac   = FLAG_COLOR[flag]  ?? "#FF9500";
            const fill = FILL_COLOR[flag] ?? "rgba(255,149,0,0.18)";
            return (
              <span key={flag} style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                fontSize: 10, fontWeight: 700,
                color: ac,
                background: fill,
                border: `1px solid ${ac}50`,
                padding: "2px 8px",
                borderRadius: 6,
              }}>
                <span style={{
                  display: "inline-block",
                  width: 6, height: 6,
                  borderRadius: "50%",
                  background: ac,
                  flexShrink: 0,
                }} />
                {FLAG_ABBREV[flag]} — {FLAG_LABEL[flag]}
              </span>
            );
          })}
        </div>
      )}

      {/* Flow — bands + labels at top of highlighted region */}
      <Panel
        data={waveformData}
        dataKey="flow"
        color={C.flow}
        yLabel="Flow"
        unit="L/min"
        bands={bands}
        showLabels={true}
        showXAxis={false}
        refLine={{ y: 0, color: C.zeroLine }}
      />

      <div style={{ height: 1, background: "rgba(255,255,255,0.04)", margin: "2px 0" }} />

      {/* Pressure — same bands, no label */}
      <Panel
        data={waveformData}
        dataKey="pressure"
        color={C.pressure}
        yLabel="Pressure"
        unit="cmH₂O"
        bands={bands}
        showLabels={false}
        showXAxis={false}
        refLine={{ y: 5, color: C.peepLine }}
      />

      <div style={{ height: 1, background: "rgba(255,255,255,0.04)", margin: "2px 0" }} />

      {/* Volume — same bands, no label, x-axis shown */}
      <Panel
        data={waveformData}
        dataKey="volume"
        color={C.volume}
        yLabel="Volume"
        unit="mL"
        bands={bands}
        showLabels={false}
        showXAxis={true}
      />

      <p style={{ textAlign: "right", fontSize: 9, color: "rgba(255,255,255,0.2)", paddingRight: 12, marginTop: 2 }}>
        time (s)
      </p>
    </div>
  );
}
