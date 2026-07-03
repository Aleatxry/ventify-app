"use client";

import { use, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Header from "@/components/Header";
import AlertHistory from "@/components/AlertHistory";
import PVASummaryCard from "@/components/PVASummaryCard";
import BreathMetricsCard from "@/components/BreathMetricsCard";
import EmptyState from "@/components/EmptyState";
import PatientTsneCard from "@/components/PatientTsneCard";
import PatientInfoCard from "@/components/PatientInfoCard";
import { loadRealCaptures, type RealBedHistory } from "@/lib/realDataLoader";
import { loadPatientTsne, type PatientTsneEntry } from "@/lib/tsneLoader";
import { loadPatientMetadata, toPatientInfo } from "@/lib/patientMetadataLoader";
import type { PatientInfo } from "@/types/ventify";

const PVABrowser = dynamic(() => import("@/components/PVABrowser"), { ssr: false });

export default function PatientPage({ params }: { params: Promise<{ bedId: string }> }) {
  const { bedId } = use(params);
  const [history,   setHistory  ] = useState<RealBedHistory | null>(null);
  const [loading,   setLoading  ] = useState(true);
  const [tsne,      setTsne     ] = useState<PatientTsneEntry | null>(null);
  const [info,      setInfo     ] = useState<PatientInfo | null>(null);

  useEffect(() => {
    setLoading(true);
    loadRealCaptures(bedId).then(real => {
      setHistory(real);
      setLoading(false);
      if (real) {
        loadPatientTsne(real.patientHash).then(setTsne);
        loadPatientMetadata().then(meta => {
          const entry = meta?.[real.patientHash];
          setInfo(entry ? toPatientInfo(entry) : null);
        });
      }
    });
  }, [bedId]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--v-bg)" }}>
      <Header
        showBack
        isConnected={!loading && history !== null}
        patientLabel={history ? `Bed ${bedId} — ${history.patientHash.slice(0, 8).toUpperCase()}` : `Bed ${bedId}`}
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
              {info && <PatientInfoCard info={info} />}
              <PVASummaryCard captures={history.captures} />
              <BreathMetricsCard captures={history.captures} />
              <PatientTsneCard data={tsne} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
