"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { BedData, WaveformPoint } from "@/types/ventify";
import { createMockWard } from "@/lib/mockData";

interface VentifyStreamState {
  isConnected: boolean;
  bedData: BedData | null;
  allBeds: BedData[];
}

/**
 * Per-patient hook. Pass "mock://BEDID" for mock data, or a real WebSocket URL.
 * Returns the target bed plus all beds (for navigation between patients).
 */
export function useVentifyStream(url: string): VentifyStreamState {
  const [allBeds, setAllBeds] = useState<BedData[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const buffersRef = useRef<Map<string, WaveformPoint[]>>(new Map());

  const targetBedId = url.startsWith("mock://") ? url.slice(7) : null;

  const onUpdate = useCallback((bedId: string, patch: Partial<BedData>) => {
    setAllBeds(prev =>
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
  }, []);

  useEffect(() => {
    if (targetBedId !== null) {
      // Mock mode — reuse ward simulator, scope to one bed
      const ward = createMockWard(onUpdate);
      const initial = ward.getInitialData();
      setAllBeds(initial);
      setIsConnected(true);
      initial.forEach(b => buffersRef.current.set(b.bedId, b.waveformBuffer));
      ward.start(buffersRef.current);
      return () => ward.stop();
    }

    // Real WebSocket mode
    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      ws = new WebSocket(url);

      ws.onopen = () => setIsConnected(true);

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data as string);
          if (msg.bedId && msg.patch) {
            onUpdate(msg.bedId, msg.patch);
          }
        } catch {
          // malformed frame — skip
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        setIsConnected(false);
        ws.close();
      };
    };

    connect();
    return () => {
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [url, targetBedId, onUpdate]);

  const bedData = targetBedId
    ? allBeds.find(b => b.bedId === targetBedId) ?? null
    : null;

  return { isConnected, bedData, allBeds };
}
