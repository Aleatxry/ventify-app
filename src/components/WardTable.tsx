"use client";

import { useRouter } from "next/navigation";
import type { BedData } from "@/types/ventify";
import AlertBadge from "./AlertBadge";
import VentilatorIcon from "./VentilatorIcon";
import { SEVERITY_COLORS, PVA_SHORT } from "@/lib/constants";

interface WardTableProps {
  beds: BedData[];
}

function PVACell({ latestPrediction, pvaBreathFrac }: {
  latestPrediction: BedData["latestPrediction"];
  pvaBreathFrac?: number;
}) {
  if (!latestPrediction || latestPrediction.flags.length === 0) {
    return <span style={{ color: "var(--v-text-3)", fontSize: 18 }}>—</span>;
  }
  const label = PVA_SHORT[latestPrediction.flags[0]] ?? latestPrediction.flags[0];
  const pct   = pvaBreathFrac !== undefined ? Math.round(pvaBreathFrac * 100) : null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-semibold"
        style={{ fontSize: 16, color: SEVERITY_COLORS[latestPrediction.severity].bg }}>
        {label}
      </span>
      {pct !== null && (
        <span style={{ fontSize: 11, color: "var(--v-text-3)" }}>
          {pct}% of breaths
        </span>
      )}
    </div>
  );
}

function TrendCell({ trend }: { trend: BedData["newsTrend"] }) {
  const arrow = trend === "up" ? "↑" : trend === "down" ? "↓" : "→";
  const color =
    trend === "up"   ? "var(--v-critical)"  :
    trend === "down" ? "var(--v-normal)"    :
    "var(--v-text-3)";
  return (
    <span style={{ fontSize: 22, fontWeight: 700, color }}>{arrow}</span>
  );
}

const COLS    = "72px 1fr 160px 100px 100px 180px";
const HEADERS = ["Bed", "Patient", "Alert", "Captures", "Trend", "Dominant PVA"];

export default function WardTable({ beds }: WardTableProps) {
  const router = useRouter();

  if (beds.length === 0) {
    return (
      <div className="rounded-2xl p-12 text-center"
        style={{ background: "var(--v-surface)", boxShadow: "var(--v-shadow-card)" }}>
        <p style={{ color: "var(--v-text-3)", fontSize: 14 }}>No patient data available</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: "var(--v-surface)", boxShadow: "var(--v-shadow-card)" }}>

      {/* Column headers */}
      <div className="grid items-center px-6 py-3"
        style={{
          gridTemplateColumns: COLS,
          borderBottom: "1px solid var(--v-divider)",
          backgroundColor: "var(--v-surface-raised)",
        }}>
        {HEADERS.map(col => (
          <span key={col} className="font-semibold uppercase tracking-wide"
            style={{ fontSize: 13, color: "var(--v-text-2)" }}>
            {col}
          </span>
        ))}
      </div>

      {/* Rows */}
      <div>
        {beds.map((bed, i) => {
          const severity   = bed.instabilityIndex.tier;
          const isCritical = severity === "Critical";

          return (
            <button key={bed.bedId}
              onClick={() => router.push(`/patient/${bed.bedId}`)}
              data-severity={severity.toLowerCase()}
              className="ward-row grid w-full items-center px-6 text-left cursor-pointer transition-colors duration-150"
              style={{
                gridTemplateColumns: COLS,
                borderBottom: i < beds.length - 1 ? "1px solid var(--v-divider)" : "none",
                minHeight: 80,
              }}>

              {/* Bed */}
              <span className="font-bold leading-none font-mono-nums"
                style={{ fontSize: 44, color: isCritical ? "var(--v-critical)" : "var(--v-text-1)" }}>
                {bed.bedId}
              </span>

              {/* Patient */}
              <div className="flex flex-col justify-center gap-1">
                <div className="flex items-center gap-2">
                  {bed.isVentilated && <VentilatorIcon size={22} />}
                  <span className="font-semibold" style={{ fontSize: 17, color: "var(--v-text-1)" }}>
                    {bed.patientId}
                  </span>
                </div>
                <span style={{ fontSize: 11, color: "var(--v-text-3)" }}>
                  {bed.totalBreaths ?? 0} breaths recorded
                </span>
              </div>

              {/* Alert */}
              <div>
                <AlertBadge severity={severity} pulse size="sm" />
              </div>

              {/* Captures */}
              <div className="flex flex-col gap-0">
                <span className="font-mono-nums font-bold"
                  style={{ fontSize: 22, color: "var(--v-text-1)" }}>
                  {bed.captureCount ?? 0}
                </span>
                <span style={{ fontSize: 11, color: "var(--v-text-3)" }}>captures</span>
              </div>

              {/* Trend */}
              <TrendCell trend={bed.newsTrend} />

              {/* Dominant PVA */}
              <PVACell
                latestPrediction={bed.latestPrediction}
                pvaBreathFrac={bed.pvaBreathFrac}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
