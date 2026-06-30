import type { InstabilityIndex } from "@/types/ventify";
import { SEVERITY_COLORS } from "@/lib/constants";
import AlertBadge from "./AlertBadge";

interface InstabilityCardProps {
  index: InstabilityIndex;
}

export default function InstabilityCard({ index }: InstabilityCardProps) {
  const colors = SEVERITY_COLORS[index.tier];

  return (
    <div className="v-card rounded-2xl p-5">
      <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--v-text-2)" }}>
        Ventilation Instability Index
      </p>

      <div className="flex items-end justify-between">
        <div>
          <span
            className="font-mono-nums text-[52px] font-bold leading-none"
            style={{ color: colors.bg }}
          >
            {Math.round(index.value)}
          </span>
          <span className="text-[13px] ml-1 mb-1 inline-block" style={{ color: "var(--v-text-2)" }}>/100</span>
        </div>
        <AlertBadge severity={index.tier} pulse />
      </div>

      <div className="mt-4 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--v-surface-raised)" }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.round(index.value)}%`, backgroundColor: colors.bg }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[9px]" style={{ color: "var(--v-text-2)" }}>0 — Normal</span>
        <span className="text-[9px]" style={{ color: "var(--v-text-2)" }}>100 — Critical</span>
      </div>
    </div>
  );
}
