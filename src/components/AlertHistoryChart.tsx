"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
interface HourBucket { hour: number; label: string; total: number; counts: Record<string, number>; dominantSeverity: string; }

interface Props {
  buckets: HourBucket[];
}

function barColor(total: number): string {
  if (total >= 3) return "#FF3B30";  // Critical: 3–4 PVA types
  if (total >= 2) return "#FF9500";  // Elevated: 2 types
  if (total > 0)  return "#0A84FF";  // 1 type
  return "rgba(255,255,255,0.05)";
}

export default function AlertHistoryChart({ buckets }: Props) {
  const nowHour = new Date().getHours();

  return (
    <div style={{ padding: "14px 8px 4px" }}>
      <ResponsiveContainer width="100%" height={90}>
        <BarChart data={buckets} margin={{ top: 2, right: 12, bottom: 2, left: 32 }}>
          <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis
            dataKey="hour"
            tickFormatter={h => `${h}h`}
            tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)" }}
            tickLine={false}
            axisLine={false}
            interval={3}
          />
          <YAxis
            tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)" }}
            tickLine={false}
            axisLine={false}
            width={26}
            tickCount={3}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1A1F2E",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              fontSize: 11,
              color: "#F5F5F7",
            }}
            labelFormatter={h =>
              `${String(h).padStart(2, "0")}:00–${String((Number(h) + 1) % 24).padStart(2, "0")}:00`
            }
            formatter={v => [v, "PVA types detected"]}
          />
          <Bar dataKey="total" radius={[3, 3, 0, 0]} maxBarSize={18}>
            {buckets.map((b, i) => (
              <Cell
                key={i}
                fill={barColor(b.total)}
                opacity={b.hour === nowHour ? 1 : 0.7}
                stroke={b.hour === nowHour ? "rgba(255,255,255,0.25)" : "none"}
                strokeWidth={b.hour === nowHour ? 1 : 0}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="flex items-center gap-4 px-3 pb-2">
        {[
          { color: "#FF3B30", label: "3–4 PVA types" },
          { color: "#FF9500", label: "2 PVA types" },
          { color: "#0A84FF", label: "1 PVA type" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: 2, backgroundColor: color }} />
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
