"use client";

import { use, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Header from "@/components/Header";
import InstabilityCard from "@/components/InstabilityCard";
import MetricsPanel from "@/components/MetricsPanel";
import VitalsStrip from "@/components/VitalsStrip";
import AlertHistory from "@/components/AlertHistory";
import PatientInfoCard from "@/components/PatientInfoCard";
import CriticalBanner from "@/components/CriticalBanner";
import PVASummaryCard from "@/components/PVASummaryCard";
import EmptyState from "@/components/EmptyState";
import { useVentifyStream } from "@/hooks/useVentifyStream";
import { generateBedHistory } from "@/lib/mockHistory";
import { loadRealCaptures, type RealBedHistory } from "@/lib/realDataLoader";

const PVABrowser = dynamic(() => import("@/components/PVABrowser"), { ssr: false });

export default function PatientPage({ params }: { params: Promise<{ bedId: string }> }) {
  const { bedId } = use(params);
  const { isConnected, bedData } = useVentifyStream(`mock://${bedId}`);

  const [history, setHistory] = useState<RealBedHistory>(() => {
    const mock = generateBedHistory(bedId, 50);
    return {
      captures:         mock.captures,
      totalCaptures:    mock.totalCaptures,
      instabilityClass: mock.instabilityClass,
      viiTrend:         mock.viiTrend,
    };
  });
  const [dataSource, setDataSource] = useState<"real" | "mock">("mock");

  useEffect(() => {
    loadRealCaptures(bedId).then(real => {
      if (real) {
        setHistory(real);
        setDataSource("real");
      }
    });
  }, [bedId]);

  if (!bedData) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: "var(--v-bg)" }}>
        <Header showBack isConnected={isConnected} />
        <EmptyState message={`Looking for Bed ${bedId}…`} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--v-bg)" }}>
      <Header
        showBack
        isConnected={isConnected}
        patientLabel={`Bed ${bedData.bedId} — ${bedData.patientId}`}
        lastUpdated={
          bedData.latestPrediction
            ? new Date(bedData.latestPrediction.timestamp_s * 1000)
            : null
        }
      />

      <main className="max-w-[1400px] mx-auto px-6 py-8">
        <CriticalBanner index={bedData.instabilityIndex} vitals={bedData.vitals} />

        {/* Data source badge */}
        <div style={{ marginBottom: 12, display: "flex", justifyContent: "flex-end" }}>
          <span style={{
            fontSize: 10, fontWeight: 600,
            padding: "2px 8px", borderRadius: 5,
            backgroundColor: dataSource === "real" ? "rgba(52,199,89,0.12)" : "rgba(255,149,0,0.10)",
            color: dataSource === "real" ? "#34C759" : "#FF9500",
          }}>
            {dataSource === "real" ? "Real patient data" : "Mock data"}
          </span>
        </div>

        <div className="grid gap-5" style={{ gridTemplateColumns: "1fr 340px" }}>

          {/* LEFT */}
          <div className="flex flex-col gap-5">
            <PVABrowser captures={history.captures} totalCaptures={history.totalCaptures} />
            <AlertHistory captures={history.captures} />
          </div>

          {/* RIGHT */}
          <div className="flex flex-col gap-4">
            {bedData.patientInfo && <PatientInfoCard info={bedData.patientInfo} />}
            <InstabilityCard
              instabilityClass={history.instabilityClass}
              viiTrend={history.viiTrend}
            />
            <PVASummaryCard captures={history.captures} />
            <MetricsPanel metrics={bedData.latestPrediction?.metrics ?? null} />
            <VitalsStrip vitals={bedData.vitals} />
          </div>
        </div>
      </main>
    </div>
  );
}
