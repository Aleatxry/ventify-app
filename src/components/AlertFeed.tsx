"use client";

import { useEffect, useRef } from "react";
import type { Alert } from "@/types/ventify";
import { SEVERITY_COLORS, PVA_LABELS, formatTimestamp } from "@/lib/constants";
import AlertBadge from "./AlertBadge";

interface AlertFeedProps {
  alerts: Alert[];
}

export default function AlertFeed({ alerts }: AlertFeedProps) {
  const prevLenRef = useRef(alerts.length);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (alerts.length > prevLenRef.current && containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
    prevLenRef.current = alerts.length;
  }, [alerts.length]);

  return (
    <div
      className="v-card rounded-2xl overflow-hidden"
    >
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: "1px solid var(--v-divider)" }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--v-text-2)" }}>
          Alert History
        </p>
        <span className="text-[11px]" style={{ color: "var(--v-text-3)" }}>
          {alerts.length} events
        </span>
      </div>

      {alerts.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-[13px]" style={{ color: "var(--v-text-2)" }}>No alerts yet</p>
        </div>
      ) : (
        <div ref={containerRef} className="overflow-y-auto" style={{ maxHeight: 320 }}>
          {alerts.map((alert, i) => {
            const colors = SEVERITY_COLORS[alert.severity];
            const isNew = i === 0;
            const flagLabel = alert.flags.length > 0
              ? PVA_LABELS[alert.flags[0]] ?? alert.flags[0]
              : "Normal";

            return (
              <div
                key={alert.id}
                className={`flex items-stretch ${isNew ? "animate-slide-in" : ""}`}
                style={{ borderBottom: i < alerts.length - 1 ? "1px solid var(--v-divider)" : "none" }}
              >
                <div className="w-1 flex-shrink-0" style={{ backgroundColor: colors.bg }} />

                <div className="flex items-center gap-4 px-4 py-3 flex-1">
                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono-nums text-[12px] font-medium" style={{ color: "var(--v-text-1)" }}>
                        #{alert.breath_idx.toLocaleString()}
                      </span>
                      <span className="text-[11px]" style={{ color: "var(--v-text-3)" }}>
                        {formatTimestamp(alert.timestamp_s)}
                      </span>
                    </div>
                    <span className="text-[12px]" style={{ color: "var(--v-text-1)" }}>
                      {flagLabel}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="font-mono-nums text-[11px]" style={{ color: "var(--v-text-3)" }}>
                      {Math.round(alert.confidence * 100)}%
                    </span>
                    <AlertBadge severity={alert.severity} size="sm" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
