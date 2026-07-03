"use client";

import { use, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Header from "@/components/Header";
import InstabilityCard from "@/components/InstabilityCard";
import AlertHistory from "@/components/AlertHistory";
import PVASummaryCard from "@/components/PVASummaryCard";
import BreathMetricsCard from "@/components/BreathMetricsCard";
import EmptyState from "@/components/EmptyState";
import { loadRealCaptures, type RealBedHistory } from "@/lib/realDataLoader";

const PVABrowser = dynamic(() => import("@/components/PVABrowser"), { ssr: false });

export default function PatientPage({ params }: { params: Promise<{ bedId: string }> }) {
  const { bedId } = use(params);
  const [history,   setHistory  ] = useState<RealBedHistory | null>(null);
  const [loading,   setLoading  ] = useState(true);

  useEffect(() => {
    setLoading(true);
    loadRealCaptures(bedId).then(real => {
      setHistory(real);
      setLoading(false);
    });
  }, [bedId]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--v-bg)" }}>
      <Header
        showBack
        isConnected={!loading && history !== null}
        patientLabel={history ? `Bed ${bedId} — ${bedId === "01" ? "2A7B9F18" : "BD496321"}` : `Bed ${bedId}`}
      />

      <main className="max-w-[1400px] mx-auto px-6 py-8">
        {loading ? (
          <EmptyState message="Loading capture data…" />
        ) : !history ? (
          <EmptyState message={`No data found for Bed ${bedId}`} />
        ) : (
          <div className="grid gap-5" style={{ gridTemplateColumns: "1fr 340px" }}>

            {/* LEFT: waveform browser + timeline */}
            <div className="flex flex-col gap-5">
              <PVABrowser
                captures={history.captures}
                totalCaptures={history.totalCaptures}
              />
              <AlertHistory captures={history.captures} />
            </div>

            {/* RIGHT: sidebar — real data only */}
            <div className="flex flex-col gap-4">
              <InstabilityCard
                instabilityClass={history.instabilityClass}
                viiTrend={history.viiTrend}
              />
              <BreathMetricsCard captures={history.captures} />
              <PVASummaryCard captures={history.captures} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
