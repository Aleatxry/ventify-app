"use client";

import { useRouter } from "next/navigation";
import type { BedData } from "@/types/ventify";
import AlertBadge from "./AlertBadge";
import BreathDots from "./BreathDots";
import LungIcon from "./LungIcon";
import { SEVERITY_COLORS, PVA_SHORT, getNewsColor } from "@/lib/constants";

interface WardTableProps {
  beds: BedData[];
}

function NewsScore({ score, trend }: { score: number; trend: BedData["newsTrend"] }) {
  const color = getNewsColor(score);
  const arrow = trend === "up" ? "↑" : trend === "down" ? "↓" : "";
  return (
    <span className="font-mono-nums text-[15px] font-semibold" style={{ color }}>
      {score}
      {arrow && <span className="text-[11px] ml-0.5" style={{ color }}>{arrow}</span>}
    </span>
  );
}

function PVACell({ latestPrediction }: { latestPrediction: BedData["latestPrediction"] }) {
  if (!latestPrediction || latestPrediction.flags.length === 0) {
    return <span style={{ color: "var(--v-text-2)" }}>—</span>;
  }
  const label = PVA_SHORT[latestPrediction.flags[0]] ?? latestPrediction.flags[0];
  return (
    <span className="text-[13px]" style={{ color: SEVERITY_COLORS[latestPrediction.severity].bg }}>
      {label}
    </span>
  );
}

function VitalCell({ value, critical }: { value: number | string | null; critical?: boolean }) {
  if (value === null || value === undefined) {
    return <span style={{ color: "var(--v-text-2)" }}>—</span>;
  }
  return (
    <span
      className="font-mono-nums text-[15px] font-medium"
      style={{ color: critical ? "var(--v-critical)" : "var(--v-text-1)" }}
    >
      {value}
    </span>
  );
}

function IOCell({ netMl }: { netMl: number | null }) {
  if (netMl === null) return <span style={{ color: "var(--v-text-2)" }}>—</span>;

  const color =
    netMl > 1500 ? "var(--v-critical)" :
    netMl > 500  ? "var(--v-elevated)" :
    netMl < -400 ? "var(--v-accent)"   :
    "var(--v-text-1)";

  const sign = netMl > 0 ? "+" : "";
  const formatted = `${sign}${netMl.toLocaleString()}`;

  return (
    <div className="flex flex-col gap-0">
      <span className="font-mono-nums text-[14px] font-medium" style={{ color }}>
        {formatted}
      </span>
      <span className="text-[10px]" style={{ color: "var(--v-text-3)" }}>mL</span>
    </div>
  );
}

export default function WardTable({ beds }: WardTableProps) {
  const router = useRouter();

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "var(--v-surface)", boxShadow: "var(--v-shadow-card)" }}
    >
      {/* Column headers */}
      <div
        className="grid items-center px-6 py-3"
        style={{
          gridTemplateColumns: "64px 1fr 120px 90px 120px 64px 72px 96px 140px",
          borderBottom: "1px solid var(--v-divider)",
          backgroundColor: "var(--v-surface-raised)",
        }}
      >
        {["Bed", "Patient", "Alert", "HR", "BP (MAP)", "SpO₂", "NEWS", "I/O", "PVA Type"].map(col => (
          <span
            key={col}
            className="text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: "var(--v-text-2)" }}
          >
            {col}
          </span>
        ))}
      </div>

      {/* Rows */}
      {beds.map((bed, i) => {
        const isCritical = bed.instabilityIndex.tier === "Critical";
        const isElevated = bed.instabilityIndex.tier === "Elevated";

        return (
          <button
            key={bed.bedId}
            onClick={() => router.push(`/patient/${bed.bedId}`)}
            className="grid w-full items-center px-6 text-left transition-all duration-150 cursor-pointer"
            style={{
              gridTemplateColumns: "64px 1fr 120px 90px 120px 64px 72px 96px 140px",
              minHeight: "72px",
              borderBottom: i < beds.length - 1 ? "1px solid var(--v-divider)" : "none",
              backgroundColor: isCritical
                ? "var(--v-critical-pale)"
                : isElevated
                ? "var(--v-elevated-pale)"
                : "transparent",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.backgroundColor =
                isCritical ? "rgba(255,59,48,0.14)" : "var(--v-accent-pale)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.backgroundColor = isCritical
                ? "var(--v-critical-pale)"
                : isElevated
                ? "var(--v-elevated-pale)"
                : "transparent";
            }}
          >
            {/* Bed number */}
            <span
              className="text-[28px] font-bold leading-none"
              style={{ color: isCritical ? "var(--v-critical)" : "var(--v-text-1)", fontVariantNumeric: "tabular-nums" }}
            >
              {bed.bedId}
            </span>

            {/* Patient info */}
            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-2">
                {bed.isVentilated && <LungIcon size={16} color="var(--v-accent)" />}
                <span className="text-[14px] font-semibold" style={{ color: "var(--v-text-1)" }}>
                  {bed.patientId}
                </span>
              </div>
              {bed.isVentilated && <BreathDots history={bed.breathHistory} />}
            </div>

            {/* Alert */}
            <div>
              <AlertBadge severity={bed.instabilityIndex.tier} pulse size="sm" />
            </div>

            {/* HR */}
            <VitalCell value={bed.vitals?.hr ?? null} />

            {/* BP */}
            <div className="flex flex-col gap-0">
              {bed.vitals ? (
                <>
                  <span className="font-mono-nums text-[14px] font-medium" style={{ color: "var(--v-text-1)" }}>
                    {bed.vitals.sbp}/{bed.vitals.dbp}
                  </span>
                  <span className="font-mono-nums text-[11px]" style={{ color: "var(--v-text-2)" }}>
                    ({bed.vitals.map})
                  </span>
                </>
              ) : (
                <span style={{ color: "var(--v-text-2)" }}>—</span>
              )}
            </div>

            {/* SpO2 */}
            <VitalCell
              value={bed.vitals ? `${bed.vitals.spo2}%` : null}
              critical={bed.vitals ? bed.vitals.spo2 < 94 : false}
            />

            {/* NEWS */}
            <NewsScore score={bed.newsScore} trend={bed.newsTrend} />

            {/* I/O */}
            <IOCell netMl={bed.fluidBalance?.netMl ?? null} />

            {/* PVA Type */}
            <PVACell latestPrediction={bed.latestPrediction} />
          </button>
        );
      })}
    </div>
  );
}
