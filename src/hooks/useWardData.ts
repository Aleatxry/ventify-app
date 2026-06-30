"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { BedData, WaveformPoint } from "@/types/ventify";
import { createMockWard } from "@/lib/mockData";

export function useWardData() {
  const [beds, setBeds] = useState<BedData[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const buffersRef = useRef<Map<string, WaveformPoint[]>>(new Map());

  const onUpdate = useCallback((bedId: string, patch: Partial<BedData>) => {
    setBeds(prev =>
      prev.map(bed => {
        if (bed.bedId !== bedId) return bed;
        const next = { ...bed, ...patch };
        if (patch.latestPrediction) {
          next.breathHistory = [patch.latestPrediction.severity, ...bed.breathHistory].slice(0, 10);
        }
        if (patch.recentAlerts?.length) {
          next.recentAlerts = [...patch.recentAlerts, ...bed.recentAlerts].slice(0, 50);
        }
        return next;
      })
    );
    setLastUpdated(new Date());
  }, []);

  useEffect(() => {
    const ward = createMockWard(onUpdate);
    const initial = ward.getInitialData();
    setBeds(initial);
    setIsLoaded(true);
    setLastUpdated(new Date());
    initial.forEach(b => buffersRef.current.set(b.bedId, b.waveformBuffer));
    ward.start(buffersRef.current);
    return () => ward.stop();
  }, [onUpdate]);

  const sortedBeds = [...beds].sort((a, b) => {
    const order = { Critical: 0, Elevated: 1, Normal: 2 };
    if (order[a.instabilityIndex.tier] !== order[b.instabilityIndex.tier])
      return order[a.instabilityIndex.tier] - order[b.instabilityIndex.tier];
    return a.bedId.localeCompare(b.bedId);
  });

  return { beds: sortedBeds, isLoaded, lastUpdated };
}
