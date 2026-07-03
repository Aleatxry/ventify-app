"use client";

import { useState, useEffect } from "react";
import type { BedData } from "@/types/ventify";
import { rollupToBeds, type PatientRollup } from "@/lib/rollupLoader";

export function useWardData() {
  const [beds,        setBeds       ] = useState<BedData[]>([]);
  const [isLoaded,    setIsLoaded   ] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch("/data/patient_rollup.json");
        if (!res.ok) throw new Error("not found");
        const rollup: PatientRollup = await res.json();
        setBeds(rollupToBeds(rollup));
        setIsLoaded(true);
        setLastUpdated(new Date());
      } catch {
        // No real data available — show nothing rather than fake data
        setIsLoaded(true);
      }
    }
    init();
  }, []);

  const sortedBeds = [...beds].sort((a, b) => {
    const order = { Critical: 0, Elevated: 1, Normal: 2 };
    if (order[a.instabilityIndex.tier] !== order[b.instabilityIndex.tier])
      return order[a.instabilityIndex.tier] - order[b.instabilityIndex.tier];
    return a.bedId.localeCompare(b.bedId);
  });

  return { beds: sortedBeds, isLoaded, lastUpdated };
}
