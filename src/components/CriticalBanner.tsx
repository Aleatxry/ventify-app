import type { InstabilityIndex, Vitals } from "@/types/ventify";

interface Props {
  index: InstabilityIndex;
  vitals: Vitals | null;
}

function abnormalSystems(index: InstabilityIndex, vitals: Vitals | null) {
  const flags: { label: string; value: string; critical: boolean }[] = [];
  if (index.tier !== "Normal") {
    flags.push({
      label: "VII",
      value: `${Math.round(index.value)}`,
      critical: index.tier === "Critical",
    });
  }
  if (vitals && vitals.spo2 < 94) {
    flags.push({ label: "SpO₂", value: `${vitals.spo2}%`, critical: vitals.spo2 < 90 });
  }
  if (vitals && (vitals.map < 65 || vitals.map > 110)) {
    flags.push({
      label: "MAP",
      value: `${vitals.map} mmHg`,
      critical: vitals.map < 60 || vitals.map > 120,
    });
  }
  return flags;
}

export default function CriticalBanner({ index, vitals }: Props) {
  const flags = abnormalSystems(index, vitals);

  // Only render when 2+ systems are simultaneously abnormal
  if (flags.length < 2) return null;

  const anyCritical = flags.some(f => f.critical);

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "10px 20px",
        margin: "0 0 20px",
        borderRadius: 12,
        background: anyCritical
          ? "rgba(255,59,48,0.10)"
          : "rgba(255,149,0,0.09)",
        border: `1px solid ${anyCritical ? "rgba(255,59,48,0.35)" : "rgba(255,149,0,0.30)"}`,
      }}
    >
      {/* Icon + label */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <span
          style={{
            width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
            backgroundColor: anyCritical ? "var(--v-critical)" : "var(--v-elevated)",
            animation: anyCritical ? "pulse-badge 1.4s ease-in-out infinite" : undefined,
          }}
        />
        <span style={{
          fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
          color: anyCritical ? "var(--v-critical)" : "var(--v-elevated)",
          textTransform: "uppercase",
        }}>
          Multi-system deterioration
        </span>
      </div>

      <span style={{ width: 1, height: 16, background: "rgba(255,255,255,0.12)", flexShrink: 0 }} />

      {/* Flagged values */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {flags.map((f) => (
          <div key={f.label} style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
            <span style={{
              fontSize: 10, fontWeight: 600, letterSpacing: "0.06em",
              color: "rgba(255,255,255,0.45)",
              textTransform: "uppercase",
            }}>
              {f.label}
            </span>
            <span style={{
              fontFamily: "Menlo, monospace",
              fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em",
              color: f.critical ? "var(--v-critical)" : "var(--v-elevated)",
            }}>
              {f.value}
            </span>
          </div>
        ))}
      </div>

      {/* Spacer + dismiss hint */}
      <div style={{ marginLeft: "auto", flexShrink: 0 }}>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>
          Notify attending
        </span>
      </div>
    </div>
  );
}
