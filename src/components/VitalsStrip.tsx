import type { Vitals } from "@/types/ventify";

interface VitalsStripProps {
  vitals: Vitals | null;
}

interface VitalTileProps {
  label: string;
  value: string;
  sub?: string;
  critical?: boolean;
}

function VitalTile({ label, value, sub, critical }: VitalTileProps) {
  return (
    <div className="flex flex-col gap-0.5 flex-1">
      <p className="text-[9px] uppercase tracking-widest font-semibold" style={{ color: "var(--v-text-2)" }}>
        {label}
      </p>
      <p
        className="font-mono-nums text-[18px] font-semibold leading-none"
        style={{ color: critical ? "var(--v-critical)" : "var(--v-text-1)" }}
      >
        {value}
      </p>
      {sub && (
        <p className="font-mono-nums text-[10px]" style={{ color: "var(--v-text-3)" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

export default function VitalsStrip({ vitals }: VitalsStripProps) {
  return (
    <div className="v-card rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--v-text-2)" }}>
          Vitals
        </p>
        <span
          className="text-[9px] px-2 py-0.5 rounded-full"
          style={{ backgroundColor: "var(--v-surface-raised)", color: "var(--v-text-3)" }}
        >
          External source
        </span>
      </div>

      {!vitals ? (
        <p className="text-[13px]" style={{ color: "var(--v-text-2)" }}>No vitals data</p>
      ) : (
        <div className="flex items-start gap-4">
          <VitalTile label="HR" value={`${vitals.hr}`} sub="/min" />
          <div style={{ width: 1, backgroundColor: "var(--v-divider)", alignSelf: "stretch" }} />
          <VitalTile label="BP" value={`${vitals.sbp}/${vitals.dbp}`} sub={`MAP ${vitals.map}`} />
          <div style={{ width: 1, backgroundColor: "var(--v-divider)", alignSelf: "stretch" }} />
          <VitalTile label="SpO₂" value={`${vitals.spo2}%`} critical={vitals.spo2 < 94} />
        </div>
      )}
    </div>
  );
}
