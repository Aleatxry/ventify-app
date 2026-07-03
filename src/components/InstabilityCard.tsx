import type { InstabilityClass } from "@/lib/mockHistory";

interface Props {
  instabilityClass: InstabilityClass;
  viiTrend?: "up" | "down" | "stable";
}

const CLASS_CONFIG: Record<InstabilityClass, {
  color: string;
  level: number;
  desc: string;
}> = {
  Stable:   { color: "#34C759", level: 1, desc: "No PVA detected in last 24 hours" },
  Mild:     { color: "#FFD60A", level: 2, desc: "Occasional PVA, low-severity types only" },
  Elevated: { color: "#FF9500", level: 3, desc: "Frequent PVA or critical-severity type detected" },
  Critical: { color: "#FF3B30", level: 4, desc: "Widespread PVA with critical-severity types" },
};

const LEVELS: InstabilityClass[] = ["Stable", "Mild", "Elevated", "Critical"];

export default function InstabilityCard({ instabilityClass, viiTrend = "stable" }: Props) {
  const cfg = CLASS_CONFIG[instabilityClass];

  const trendArrow = viiTrend === "up" ? "↑" : viiTrend === "down" ? "↓" : "→";
  const trendLabel = viiTrend === "up" ? "Worsening" : viiTrend === "down" ? "Improving" : "Stable";
  const trendColor =
    viiTrend === "up"   ? "#FF3B30" :
    viiTrend === "down" ? "#34C759" :
    "rgba(255,255,255,0.30)";

  return (
    <div className="v-card rounded-2xl p-5">
      <p
        className="text-[11px] font-semibold uppercase tracking-widest mb-4"
        style={{ color: "var(--v-text-2)" }}
      >
        Ventilation Instability
      </p>

      {/* Class label */}
      <div style={{ marginBottom: 18 }}>
        <p style={{
          fontSize: 34,
          fontWeight: 800,
          color: cfg.color,
          letterSpacing: "-0.02em",
          lineHeight: 1,
          fontFamily: "system-ui, sans-serif",
        }}>
          {instabilityClass.toUpperCase()}
        </p>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.38)", marginTop: 5, lineHeight: 1.4 }}>
          {cfg.desc}
        </p>
      </div>

      {/* 4-level scale */}
      <div style={{ display: "flex", gap: 5, marginBottom: 14 }}>
        {LEVELS.map((lvl, i) => {
          const lc       = CLASS_CONFIG[lvl];
          const filled   = i < cfg.level;
          const isCurrent = lvl === instabilityClass;
          return (
            <div key={lvl} style={{ flex: 1 }}>
              <div style={{
                height: 5,
                borderRadius: 3,
                backgroundColor: filled ? lc.color : "rgba(255,255,255,0.07)",
                opacity: isCurrent ? 1 : filled ? 0.45 : 1,
              }} />
              <p style={{
                fontSize: 8,
                marginTop: 4,
                textAlign: "center",
                fontWeight: isCurrent ? 700 : 400,
                color: isCurrent ? lc.color : "rgba(255,255,255,0.20)",
              }}>
                {lvl}
              </p>
            </div>
          );
        })}
      </div>

      {/* Trend */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
        <span style={{ fontSize: 14, color: trendColor, lineHeight: 1 }}>{trendArrow}</span>
        <span style={{ fontSize: 11, color: trendColor, fontWeight: 600 }}>{trendLabel}</span>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.22)" }}>· vs previous hour</span>
      </div>
    </div>
  );
}
