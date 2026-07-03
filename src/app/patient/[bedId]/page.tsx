"use client";

import { use, useMemo } from "react";
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

const PVABrowser = dynamic(() => import("@/components/PVABrowser"), { ssr: false });

export default function PatientPage({ params }: { params: Promise<{ bedId: string }> }) {
  const { bedId } = use(params);
  const { isConnected, bedData } = useVentifyStream(`mock://${bedId}`);

  const history = useMemo(
    () => generateBedHistory(bedId, bedData?.instabilityIndex.value ?? 50),
    [bedId],
  );

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
        {/* Multi-system deterioration banner — shown when 2+ vitals abnormal simultaneously */}
        <CriticalBanner index={bedData.instabilityIndex} vitals={bedData.vitals} />

        <div className="grid gap-5" style={{ gridTemplateColumns: "1fr 340px" }}>

          {/* LEFT: PVA capture browser + 24h timeline */}
          <div className="flex flex-col gap-5">
            <PVABrowser captures={history.captures} totalCaptures={history.totalCaptures} />
            <AlertHistory captures={history.captures} />
          </div>

          {/* RIGHT: sidebar cards */}
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
