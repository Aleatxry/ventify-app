"use client";

import { use, useMemo } from "react";
import dynamic from "next/dynamic";
import Header from "@/components/Header";
import InstabilityCard from "@/components/InstabilityCard";
import CurrentPVACard from "@/components/CurrentPVACard";
import MetricsPanel from "@/components/MetricsPanel";
import VitalsStrip from "@/components/VitalsStrip";
import AlertFeed from "@/components/AlertFeed";
import EmptyState from "@/components/EmptyState";
import { useVentifyStream } from "@/hooks/useVentifyStream";

const WaveformChart = dynamic(() => import("@/components/WaveformChart"), { ssr: false });

export default function PatientPage({ params }: { params: Promise<{ bedId: string }> }) {
  const { bedId } = use(params);
  const { isConnected, bedData } = useVentifyStream(`mock://${bedId}`);

  const allAlerts = useMemo(() => bedData?.recentAlerts ?? [], [bedData?.recentAlerts]);

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
        <div className="grid gap-5" style={{ gridTemplateColumns: "1fr 340px" }}>
          {/* LEFT: waveform */}
          <div className="flex flex-col gap-5">
            {bedData.waveformBuffer.length > 0 ? (
              <WaveformChart buffer={bedData.waveformBuffer} alerts={allAlerts} />
            ) : (
              <div
                className="rounded-2xl flex items-center justify-center"
                style={{ height: 380, backgroundColor: "#0D1117" }}
              >
                <EmptyState message="Waiting for waveform data…" />
              </div>
            )}
          </div>

          {/* RIGHT: info cards */}
          <div className="flex flex-col gap-4">
            <InstabilityCard index={bedData.instabilityIndex} />
            <CurrentPVACard prediction={bedData.latestPrediction} />
            <MetricsPanel metrics={bedData.latestPrediction?.metrics ?? null} />
            <VitalsStrip vitals={bedData.vitals} />
          </div>
        </div>

        <div className="mt-5">
          <AlertFeed alerts={allAlerts} />
        </div>
      </main>
    </div>
  );
}
