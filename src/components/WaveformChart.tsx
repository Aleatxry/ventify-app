"use client";

import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer,
  CartesianGrid, Tooltip, ReferenceArea,
} from "recharts";
import type { WaveformPoint, Alert } from "@/types/ventify";
import { WAVEFORM_COLORS, SEVERITY_COLORS } from "@/lib/constants";

interface WaveformChartProps {
  buffer: WaveformPoint[];
  alerts: Alert[];
}

interface ChartRow {
  t: number;
  pressure: number;
  flow: number;
  volume: number;
}

function prepareData(buffer: WaveformPoint[]): ChartRow[] {
  const now = Date.now() / 1000;
  return buffer
    .map(p => ({
      t: parseFloat((p.t - now).toFixed(2)),
      pressure: p.pressure,
      flow: p.flow,
      volume: p.volume,
    }))
    .filter(p => p.t >= -10 && p.t <= 0)
    .sort((a, b) => a.t - b.t);
}

function timeFormatter(v: number) {
  if (v === 0) return "Now";
  return `${Math.abs(v).toFixed(0)}s`;
}

const xDomain: [number, number] = [-10, 0];

interface MiniChartProps {
  data: ChartRow[];
  dataKey: "pressure" | "flow" | "volume";
  color: string;
  yLabel: string;
  yUnit: string;
  showXAxis?: boolean;
  pvaBands: { x1: number; x2: number; severity: string }[];
}

function MiniChart({ data, dataKey, color, yLabel, yUnit, showXAxis = false, pvaBands }: MiniChartProps) {
  return (
    <div style={{ height: showXAxis ? 120 : 100 }}>
      <div className="flex items-center gap-2 pl-2 mb-1">
        <span
          className="text-[9px] uppercase tracking-widest font-semibold"
          style={{ color: WAVEFORM_COLORS.axis }}
        >
          {yLabel}
        </span>
        <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.25)" }}>
          {yUnit}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={showXAxis ? 100 : 80}>
        <AreaChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: 40 }}>
          <defs>
            <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={color} stopOpacity={0.25} />
              <stop offset="95%" stopColor={color} stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke={WAVEFORM_COLORS.grid}
            strokeDasharray="none"
            vertical={false}
          />
          {pvaBands.map((band, i) => (
            <ReferenceArea
              key={i}
              x1={band.x1}
              x2={band.x2}
              fill={
                band.severity === "Critical"
                  ? SEVERITY_COLORS.Critical.pale
                  : band.severity === "Elevated"
                  ? SEVERITY_COLORS.Elevated.pale
                  : "transparent"
              }
              strokeOpacity={0}
            />
          ))}
          <XAxis
            dataKey="t"
            type="number"
            domain={xDomain}
            tickFormatter={timeFormatter}
            tick={showXAxis ? { fill: WAVEFORM_COLORS.axis, fontSize: 9 } : false}
            axisLine={{ stroke: WAVEFORM_COLORS.grid }}
            tickLine={false}
            hide={!showXAxis}
          />
          <YAxis
            tick={{ fill: WAVEFORM_COLORS.axis, fontSize: 9 }}
            axisLine={false}
            tickLine={false}
            width={36}
            tickCount={4}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1A1F2E",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              fontSize: 11,
              color: "#F5F5F7",
            }}
            labelFormatter={v => `${Math.abs(Number(v)).toFixed(1)}s ago`}
            formatter={(v) => [typeof v === "number" ? v.toFixed(2) : v, yLabel]}
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#grad-${dataKey})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function WaveformChart({ buffer, alerts }: WaveformChartProps) {
  const data = prepareData(buffer);
  const now = Date.now() / 1000;

  const pvaBands = alerts
    .filter(a => a.severity !== "Normal")
    .map(a => ({
      x1: parseFloat((a.timestamp_s - now - 2.4).toFixed(2)),
      x2: parseFloat((a.timestamp_s - now).toFixed(2)),
      severity: a.severity,
    }))
    .filter(b => b.x2 >= -10);

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        backgroundColor: WAVEFORM_COLORS.background,
        padding: "20px 8px 16px 8px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
      }}
    >
      <div className="flex items-center justify-between px-2 mb-4">
        <span className="text-[12px] font-semibold tracking-wide" style={{ color: "#F5F5F7" }}>
          Real-time Waveform
        </span>
        <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>
          Last 4 breaths
        </span>
      </div>

      <MiniChart
        data={data}
        dataKey="pressure"
        color={WAVEFORM_COLORS.pressure}
        yLabel="PRESSURE"
        yUnit="cmH₂O"
        pvaBands={pvaBands}
      />
      <div style={{ height: 1, backgroundColor: "rgba(255,255,255,0.05)", margin: "4px 0" }} />
      <MiniChart
        data={data}
        dataKey="flow"
        color={WAVEFORM_COLORS.flow}
        yLabel="FLOW"
        yUnit="L/min"
        pvaBands={pvaBands}
      />
      <div style={{ height: 1, backgroundColor: "rgba(255,255,255,0.05)", margin: "4px 0" }} />
      <MiniChart
        data={data}
        dataKey="volume"
        color={WAVEFORM_COLORS.volume}
        yLabel="VOLUME"
        yUnit="mL"
        showXAxis
        pvaBands={pvaBands}
      />

      {/* Legend */}
      <div className="flex items-center gap-4 px-3 pt-3">
        {[
          { color: WAVEFORM_COLORS.pressure, label: "Pressure" },
          { color: WAVEFORM_COLORS.flow,     label: "Flow" },
          { color: WAVEFORM_COLORS.volume,   label: "Volume" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-[2px] rounded" style={{ backgroundColor: color }} />
            <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
