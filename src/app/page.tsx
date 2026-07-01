"use client";

import Link from "next/link";
import Header from "@/components/Header";
import WardTable from "@/components/WardTable";
import EmptyState from "@/components/EmptyState";
import { useWardData } from "@/hooks/useWardData";

export default function WardPage() {
  const { beds, isLoaded, lastUpdated } = useWardData();

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--v-bg)" }}>
      <Header isConnected={isLoaded} lastUpdated={lastUpdated} />

      <main className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="mb-6" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <h1 className="text-[22px] font-bold tracking-tight" style={{ color: "var(--v-text-1)" }}>
              Patient Overview
            </h1>
            <p className="text-[14px] mt-1" style={{ color: "var(--v-text-2)" }}>
              {beds.length} patients · Click a row to view real-time waveforms
            </p>
          </div>
          <Link
            href="/demo"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 14px", borderRadius: 10,
              border: "1px solid var(--v-divider)",
              background: "var(--v-surface)",
              color: "var(--v-accent)",
              fontSize: 13, fontWeight: 600,
              textDecoration: "none",
              boxShadow: "var(--v-shadow-card)",
              transition: "box-shadow 200ms ease",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 10 L5 4 L7 8 L9 5 L12 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Pipeline Demo
          </Link>
        </div>

        {isLoaded && (
          <div className="flex items-center gap-3 mb-6">
            {(["Critical", "Elevated", "Normal"] as const).map(tier => {
              const count = beds.filter(b => b.instabilityIndex.tier === tier).length;
              if (count === 0) return null;
              const varName = tier.toLowerCase() as "critical" | "elevated" | "normal";
              return (
                <div
                  key={tier}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold"
                  style={{
                    backgroundColor: `var(--v-${varName}-pale)`,
                    color: `var(--v-${varName})`,
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full inline-block"
                    style={{ backgroundColor: `var(--v-${varName})` }}
                  />
                  {count} {tier}
                </div>
              );
            })}
          </div>
        )}

        {!isLoaded
          ? <EmptyState message="Connecting to ICU ward data…" />
          : <WardTable beds={beds} />
        }
      </main>
    </div>
  );
}
