"use client";

import {
  ComposedChart, Line, XAxis, YAxis, ResponsiveContainer,
  CartesianGrid, ReferenceArea, Tooltip,
} from "recharts";
import type { CsvWaveformPoint, DetectedBreath } from "@/types/demo";

interface StaticWaveformChartProps {
  data: CsvWaveformPoint[];
  breaths?: DetectedBreath[];
  maxPoints?: number;
}

const C = {
  pressure: "#FFD60A",
  flow:     "#30D158",
  volume:   "#0A84FF",
  bg:       "#0D1117",
  grid:     "rgba(255,255,255,0.05)",
  axis:     "rgba(255,255,255,0.35)",
  label:    "rgba(255,255,255,0.55)",
};

const BREATH_FILL = ["rgba(10,132,255,0.07)", "rgba(0,0,0,0)"];

function downsample(data: CsvWaveformPoint[], max: number): CsvWaveformPoint[] {
  if (data.length <= max) return data;
  const step = Math.ceil(data.length / max);
  return data.filter((_, i) => i % step === 0);
}

interface PanelProps {
  data: CsvWaveformPoint[];
  dataKey: keyof Omit<CsvWaveformPoint, "time">;
  color: string;
  label: string;
  unit: string;
  breaths?: DetectedBreath[];
}

function Panel({ data, dataKey, color, label, unit, breaths }: PanelProps) {
  return (
    <div>
      <p style={{ fontSize: 10, fontWeight: 600, color: C.label, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4, paddingLeft: 4 }}>
        {label} <span style={{ color: C.axis, fontWeight: 400 }}>({unit})</span>
      </p>
      <ResponsiveContainer width="100%" height={100}>
        <ComposedChart data={data} margin={{ top: 2, right: 8, bottom: 2, left: 40 }}>
          <CartesianGrid strokeDasharray="2 4" stroke={C.grid} vertical={false} />
          <XAxis dataKey="time" hide />
          <YAxis
            tick={{ fontSize: 9, fill: C.axis }}
            tickLine={false}
            axisLine={false}
            width={32}
            tickFormatter={v => v.toFixed(0)}
          />
          <Tooltip
            contentStyle={{ background: "#1C1C1E", border: "1px solid #38383A", borderRadius: 8, fontSize: 11 }}
            labelFormatter={v => `t = ${Number(v).toFixed(2)}s`}
            formatter={(v) => [typeof v === "number" ? `${v.toFixed(2)} ${unit}` : v, label]}
          />
          {breaths?.map((b, i) => (
            <ReferenceArea
              key={b.idx}
              x1={data[b.startIdx]?.time}
              x2={data[b.endIdx]?.time}
              fill={BREATH_FILL[i % 2]}
              strokeOpacity={0}
            />
          ))}
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            dot={false}
            strokeWidth={1.5}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function StaticWaveformChart({ data, breaths, maxPoints = 1000 }: StaticWaveformChartProps) {
  const ds = downsample(data, maxPoints);

  return (
    <div
      style={{
        background: C.bg,
        borderRadius: 16,
        padding: "16px 8px 8px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <Panel data={ds} dataKey="pressure" color={C.pressure} label="Pressure" unit="cmH₂O" breaths={breaths} />
      <Panel data={ds} dataKey="flow"     color={C.flow}     label="Flow"     unit="L/min"  breaths={breaths} />
      <Panel data={ds} dataKey="volume"   color={C.volume}   label="Volume"   unit="mL"     breaths={breaths} />
      <p style={{ textAlign: "right", fontSize: 9, color: C.axis, marginTop: 2, paddingRight: 8 }}>
        time (s)
      </p>
    </div>
  );
}
