"use client";

import { useRouter } from "next/navigation";
import type { BedData } from "@/types/ventify";
import AlertBadge from "./AlertBadge";
import VentilatorIcon from "./VentilatorIcon";
import { SEVERITY_COLORS, PVA_SHORT } from "@/lib/constants";

interface WardTableProps {
  beds: BedData[];
}

// Deterministic mock vitals from bedId — stable across renders, looks realistic for ICU
function mockVitals(bedId: string) {
  function h(salt: string): number {
    let v = 0;
    const s = bedId + salt;
    for (let i = 0; i < s.length; i++) v = (Math.imul(31, v) + s.charCodeAt(i)) | 0;
    return (v >>> 0) / 0x100000000;
  }
  const rng = (salt: string, lo: number, hi: number) => Math.round(h(salt) * (hi - lo) + lo);

  const sys = rng("sys", 105, 155);
  const dia = rng("dia", 58, 88);
  const map = Math.round((sys + 2 * dia) / 3);
  const ioRaw = rng("io", 0, 1100) - 200;  // −200 → +900 mL
  return {
    hr:   rng("hr", 62, 118),
    sys, dia, map,
    spo2: rng("spo2", 90, 99),
    news: rng("news", 1, 8),
    io:   ioRaw,
  };
}

function newsColor(n: number): string {
  if (n >= 7) return "var(--v-critical)";
  if (n >= 5) return "#FF9500";
  if (n >= 3) return "#FFD60A";
  return "var(--v-normal)";
}
function spo2Color(v: number): string {
  if (v < 92) return "var(--v-critical)";
  if (v < 95) return "#FF9500";
  return "var(--v-text-1)";
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
        style={{ fontSize: 15, color: SEVERITY_COLORS[latestPrediction.severity].bg }}>
        {label}
      </span>
      {pct !== null && (
        <span style={{ fontSize: 10, color: "var(--v-text-3)" }}>{pct}% of breaths</span>
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
  return <span style={{ fontSize: 20, fontWeight: 700, color }}>{arrow}</span>;
}

const COLS = "56px 1fr 130px 80px 60px 70px 115px 68px 60px 88px 150px";
const HEADERS = ["Bed", "Patient", "Alert", "Captures", "Trend", "HR", "BP (MAP)", "SpO₂", "NEWS", "I/O", "Dominant PVA"];

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
      <div className="grid items-center px-5 py-3"
        style={{
          gridTemplateColumns: COLS,
          borderBottom: "1px solid var(--v-divider)",
          backgroundColor: "var(--v-surface-raised)",
        }}>
        {HEADERS.map(col => (
          <span key={col} className="font-semibold uppercase tracking-wide"
            style={{ fontSize: 11, color: "var(--v-text-2)" }}>
            {col}
          </span>
        ))}
      </div>

      {/* Rows */}
      <div>
        {beds.map((bed, i) => {
          const severity   = bed.instabilityIndex.tier;
          const isCritical = severity === "Critical";
          const v = mockVitals(bed.bedId);

          return (
            <button key={bed.bedId}
              onClick={() => router.push(`/patient/${bed.bedId}`)}
              data-severity={severity.toLowerCase()}
              className="ward-row grid w-full items-center px-5 text-left cursor-pointer transition-colors duration-150"
              style={{
                gridTemplateColumns: COLS,
                borderBottom: i < beds.length - 1 ? "1px solid var(--v-divider)" : "none",
                minHeight: 76,
              }}>

              {/* Bed */}
              <span className="font-bold leading-none font-mono-nums"
                style={{ fontSize: 38, color: isCritical ? "var(--v-critical)" : "var(--v-text-1)" }}>
                {bed.bedId}
              </span>

              {/* Patient */}
              <div className="flex flex-col justify-center gap-1">
                <div className="flex items-center gap-2">
                  {bed.isVentilated && <VentilatorIcon size={18} />}
                  <span className="font-semibold" style={{ fontSize: 15, color: "var(--v-text-1)" }}>
                    {bed.patientId}
                  </span>
                </div>
                <span style={{ fontSize: 10, color: "var(--v-text-3)" }}>
                  {bed.totalBreaths ?? 0} breaths
                </span>
              </div>

              {/* Alert */}
              <div><AlertBadge severity={severity} pulse size="sm" /></div>

              {/* Captures */}
              <div className="flex flex-col gap-0">
                <span className="font-mono-nums font-bold"
                  style={{ fontSize: 20, color: "var(--v-text-1)" }}>
                  {bed.captureCount ?? 0}
                </span>
                <span style={{ fontSize: 10, color: "var(--v-text-3)" }}>captures</span>
              </div>

              {/* Trend */}
              <TrendCell trend={bed.newsTrend} />

              {/* HR — mock */}
              <div className="flex flex-col gap-0">
                <span className="font-mono-nums font-bold"
                  style={{ fontSize: 20, color: v.hr > 100 ? "#FF9500" : "var(--v-text-1)" }}>
                  {v.hr}
                </span>
                <span style={{ fontSize: 10, color: "var(--v-text-3)" }}>bpm</span>
              </div>

              {/* BP (MAP) — mock */}
              <div className="flex flex-col gap-0">
                <span className="font-mono-nums font-semibold"
                  style={{ fontSize: 13, color: "var(--v-text-1)" }}>
                  {v.sys}/{v.dia}
                </span>
                <span style={{ fontSize: 11, fontFamily: "Menlo, monospace", color: "var(--v-text-3)" }}>
                  ({v.map})
                </span>
              </div>

              {/* SpO₂ — mock */}
              <div className="flex flex-col gap-0">
                <span className="font-mono-nums font-bold"
                  style={{ fontSize: 20, color: spo2Color(v.spo2) }}>
                  {v.spo2}%
                </span>
              </div>

              {/* NEWS — mock */}
              <div className="flex flex-col gap-0">
                <span className="font-mono-nums font-bold"
                  style={{ fontSize: 20, color: newsColor(v.news) }}>
                  {v.news}
                </span>
                <span style={{ fontSize: 10, color: "var(--v-text-3)" }}>score</span>
              </div>

              {/* I/O — mock */}
              <div className="flex flex-col gap-0">
                <span className="font-mono-nums font-semibold"
                  style={{ fontSize: 14, color: v.io < 0 ? "#FF9500" : "var(--v-text-1)" }}>
                  {v.io >= 0 ? "+" : ""}{v.io} mL
                </span>
                <span style={{ fontSize: 10, color: "var(--v-text-3)" }}>24h balance</span>
              </div>

              {/* Dominant PVA — real */}
              <PVACell
                latestPrediction={bed.latestPrediction}
                pvaBreathFrac={bed.pvaBreathFrac}
              />
            </button>
          );
        })}
      </div>

      {/* Mock data disclaimer */}
      <div style={{
        padding: "6px 20px",
        borderTop: "1px solid var(--v-divider)",
        backgroundColor: "var(--v-surface-raised)",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}>
        <span style={{ fontSize: 9, fontWeight: 600, color: "var(--v-text-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          ⚠ HR · BP · SpO₂ · NEWS · I/O are simulated for demonstration — PVA columns from real pipeline data
        </span>
      </div>
    </div>
  );
}
