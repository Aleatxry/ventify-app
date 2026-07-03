"use client";

import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { PatientTsneEntry } from "@/lib/tsneLoader";
import { PVA_LABELS } from "@/lib/constants";

interface Props {
  data: PatientTsneEntry | null;
}

// Same 8-category vocabulary as out/cluster_breaths.json and patient_rollup.json.
const TYPE_COLOR: Record<string, string> = {
  normal:              "var(--v-normal)",
  unclassified:        "var(--v-text-3)",
  flow_starvation:     "#FF3B30",
  double_trigger:      "#FF9500",
  ineffective_effort:  "#0A84FF",
  early_termination:   "#AF52DE",
  delayed_termination: "#FF6B00",
  air_trapping:        "#5E5CE6",
};

function typeLabel(t: string): string {
  return t === "normal" ? "Normal" : t === "unclassified" ? "Unclassified" : (PVA_LABELS[t] ?? t);
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="v-card rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--v-text-2)" }}>
          Breath-Level PVA Map
        </p>
      </div>
      {children}
    </div>
  );
}

export default function PatientTsneCard({ data }: Props) {
  if (!data) {
    return (
      <CardShell>
        <p style={{ fontSize: 13, color: "var(--v-text-3)" }}>
          Not available yet — regenerate via <code style={{ fontFamily: "Menlo, monospace", fontSize: 11 }}>exploration/patient_tsne.py</code>.
        </p>
      </CardShell>
    );
  }

  // Too few breaths for a meaningful embedding — fall back to a simple count list.
  if (data.embedding !== "tsne" || !data.points) {
    const entries = (Object.entries(data.type_counts) as [string, number][])
      .filter(([, c]) => (c ?? 0) > 0)
      .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0));
    const max = entries[0]?.[1] ?? 1;
    return (
      <CardShell>
        <p style={{ fontSize: 12, color: "var(--v-text-3)", marginBottom: 12 }}>
          {data.n_breaths} breaths — too few for a t-SNE embedding, showing category counts instead.
        </p>
        <div className="flex flex-col gap-2">
          {entries.map(([type, count]) => (
            <div key={type} className="flex items-center justify-between">
              <span style={{ fontSize: 12, fontWeight: 600, color: TYPE_COLOR[type] ?? "var(--v-text-1)" }}>
                {typeLabel(type)}
              </span>
              <span style={{ fontFamily: "Menlo, monospace", fontSize: 12, color: "var(--v-text-2)" }}>
                {count} ({Math.round((count / max) * 100)}%)
              </span>
            </div>
          ))}
        </div>
      </CardShell>
    );
  }

  const byType = new Map<string, TsnePointLike[]>();
  for (const p of data.points) {
    if (!byType.has(p.type)) byType.set(p.type, []);
    byType.get(p.type)!.push(p);
  }

  return (
    <CardShell>
      <ResponsiveContainer width="100%" height={240}>
        <ScatterChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <XAxis type="number" dataKey="x" hide />
          <YAxis type="number" dataKey="y" hide />
          <ZAxis range={[24, 24]} />
          <Tooltip
            contentStyle={{ background: "#1C1C1E", border: "1px solid #38383A", borderRadius: 6, fontSize: 11 }}
            formatter={(_v, _n, p) => [typeLabel(p.payload.type), "type"]}
          />
          {[...byType.entries()].map(([type, pts]) => (
            <Scatter key={type} data={pts} fill={TYPE_COLOR[type] ?? "var(--v-text-3)"} fillOpacity={0.75}>
              {pts.map((_, i) => <Cell key={i} />)}
            </Scatter>
          ))}
        </ScatterChart>
      </ResponsiveContainer>

      {data.clusters && (
        <div style={{ marginTop: 10 }}>
          <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--v-divider)" }}>
                <th style={{ textAlign: "left", padding: "4px 6px", color: "var(--v-text-3)", fontWeight: 600 }}>Cluster</th>
                <th style={{ textAlign: "right", padding: "4px 6px", color: "var(--v-text-3)", fontWeight: 600 }}>n</th>
                <th style={{ textAlign: "left", padding: "4px 6px", color: "var(--v-text-3)", fontWeight: 600 }}>Dominant type</th>
              </tr>
            </thead>
            <tbody>
              {data.clusters.map(c => (
                <tr key={c.id} style={{ borderBottom: "1px solid var(--v-divider)" }}>
                  <td style={{ padding: "4px 6px", fontFamily: "Menlo, monospace" }}>#{c.id}</td>
                  <td style={{ padding: "4px 6px", textAlign: "right", fontFamily: "Menlo, monospace" }}>{c.n}</td>
                  <td style={{ padding: "4px 6px", color: TYPE_COLOR[c.dominant_type] ?? "var(--v-text-1)", fontWeight: 600 }}>
                    {typeLabel(c.dominant_type)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between" style={{ marginTop: 10 }}>
        <span style={{ fontSize: 11, color: "var(--v-text-3)" }}>cluster-vs-label agreement (ARI)</span>
        <span style={{ fontFamily: "Menlo, monospace", fontSize: 12, fontWeight: 700, color: "var(--v-text-1)" }}>
          {data.cluster_vs_type_ARI.toFixed(2)}
        </span>
      </div>
      <p style={{ fontSize: 10, color: "var(--v-text-3)", marginTop: 8 }}>{data.note}</p>
    </CardShell>
  );
}

type TsnePointLike = { x: number; y: number; type: string; cluster: number };
