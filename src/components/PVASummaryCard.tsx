import type { HourlyCapture } from "@/lib/mockHistory";
import { PVA_LABELS } from "@/lib/constants";
import type { PVAFlag } from "@/types/ventify";

interface Props {
  captures: HourlyCapture[];
}

const FLAG_COLOR: Record<PVAFlag, string> = {
  flow_starvation:     "#FF3B30",
  double_trigger:      "#FF9500",
  ineffective_effort:  "#0A84FF",
  early_termination:   "#AF52DE",
  delayed_termination: "#FF6B00",
  air_trapping:        "#5E5CE6",
};

export default function PVASummaryCard({ captures }: Props) {
  // Count captures containing each flag (one capture can have multiple flags)
  const counts: Partial<Record<PVAFlag, number>> = {};
  for (const cap of captures) {
    for (const flag of cap.flags) {
      counts[flag] = (counts[flag] ?? 0) + 1;
    }
  }

  const entries = (Object.entries(counts) as [PVAFlag, number][])
    .sort(([, a], [, b]) => b - a);

  const totalPVACaptures = captures.filter(c => c.flags.length > 0).length;
  const maxCount = entries[0]?.[1] ?? 1;

  if (entries.length === 0) {
    return (
      <div className="v-card rounded-2xl p-5">
        <p className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--v-text-2)" }}>
          PVA Type Summary · 24h
        </p>
        <p style={{ fontSize: 13, color: "var(--v-text-3)" }}>No PVA detected</p>
      </div>
    );
  }

  return (
    <div className="v-card rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--v-text-2)" }}>
          PVA Type Summary · 24h
        </p>
        <span style={{
          fontSize: 10, fontFamily: "Menlo, monospace",
          color: "var(--v-text-3)",
        }}>
          {totalPVACaptures} / 24 captures
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {entries.map(([flag, count]) => {
          const color = FLAG_COLOR[flag];
          const barPct = Math.round((count / maxCount) * 100);

          return (
            <div key={flag}>
              <div className="flex items-center justify-between mb-1">
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--v-text-1)" }}>
                  {PVA_LABELS[flag] ?? flag}
                </span>
                <span style={{
                  fontFamily: "Menlo, monospace",
                  fontSize: 12, fontWeight: 700,
                  color,
                }}>
                  {count}×
                </span>
              </div>
              <div style={{
                height: 3, borderRadius: 99,
                backgroundColor: "var(--v-surface-raised)",
                overflow: "hidden",
              }}>
                <div style={{
                  height: "100%",
                  width: `${barPct}%`,
                  borderRadius: 99,
                  backgroundColor: color,
                  opacity: 0.75,
                  transition: "width 400ms ease",
                }} />
              </div>
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 10, marginTop: 14, color: "var(--v-text-3)" }}>
        Count = captures that included each type
      </p>
    </div>
  );
}
