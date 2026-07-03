"use client";

import Link from "next/link";
import Header from "@/components/Header";
import WardTable from "@/components/WardTable";
import EmptyState from "@/components/EmptyState";
import { useWardData } from "@/hooks/useWardData";

export default function WardPage() {
  const { beds, isLoaded, lastUpdated } = useWardData();

  const criticalCount = beds.filter(b => b.instabilityIndex.tier === "Critical").length;
  const elevatedCount = beds.filter(b => b.instabilityIndex.tier === "Elevated").length;

  const updatedStr = lastUpdated
    ? lastUpdated.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--v-bg)" }}>
      <Header
        isConnected={isLoaded}
        lastUpdated={lastUpdated}
        criticalCount={criticalCount}
        elevatedCount={elevatedCount}
        normalCount={beds.length - criticalCount - elevatedCount}
      />

      <main className="flex-1 px-4 pt-3 pb-2" style={{ maxWidth: 1500, width: "100%", margin: "0 auto" }}>
        {!isLoaded
          ? <EmptyState message="Loading patient data…" />
          : <WardTable beds={beds} />
        }
      </main>

      {isLoaded && (
        <div className="flex items-center justify-between px-5"
          style={{
            height: 34,
            borderTop: "1px solid var(--v-divider)",
            backgroundColor: "var(--v-surface-raised)",
            flexShrink: 0,
          }}>
          <div className="flex items-center gap-5">
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--v-normal)" }}>
              Pipeline data
            </span>
            {criticalCount + elevatedCount > 0 && (
              <span style={{ fontSize: 12, fontWeight: 600, color: criticalCount > 0 ? "var(--v-critical)" : "var(--v-elevated)" }}>
                {criticalCount + elevatedCount} patient{criticalCount + elevatedCount !== 1 ? "s" : ""} with PVA
                {criticalCount > 0 && ` (${criticalCount} critical)`}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            {updatedStr && (
              <span className="font-mono-nums" style={{ fontSize: 11, color: "var(--v-text-3)" }}>
                Loaded: {updatedStr}
              </span>
            )}
            <Link href="/demo"
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "3px 10px", borderRadius: 6,
                border: "1px solid var(--v-divider)",
                color: "var(--v-accent)",
                fontSize: 12, fontWeight: 600,
                textDecoration: "none",
              }}>
              <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                <path d="M2 10L5 4L7 8L9 5L12 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Pipeline Demo
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
