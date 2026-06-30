import type { BreathPrediction } from "@/types/ventify";
import { PVA_LABELS, SEVERITY_COLORS, formatTimestamp } from "@/lib/constants";
import AlertBadge from "./AlertBadge";

interface CurrentPVACardProps {
  prediction: BreathPrediction | null;
}

export default function CurrentPVACard({ prediction }: CurrentPVACardProps) {
  return (
    <div className="v-card rounded-2xl p-5">
      <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--v-text-2)" }}>
        Current PVA Detection
      </p>

      {!prediction ? (
        <p className="text-[13px]" style={{ color: "var(--v-text-2)" }}>Waiting for data…</p>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3 mb-3">
            <p className="text-[17px] font-semibold leading-snug" style={{ color: "var(--v-text-1)" }}>
              {prediction.flags.length > 0
                ? PVA_LABELS[prediction.flags[0]] ?? prediction.flags[0]
                : "No PVA Detected"}
            </p>
            <AlertBadge severity={prediction.severity} pulse size="sm" />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: "var(--v-text-2)" }}>
                Confidence
              </p>
              <div className="flex items-center gap-2">
                <div className="w-20 h-1 rounded-full overflow-hidden" style={{ backgroundColor: "var(--v-surface-raised)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.round(prediction.confidence * 100)}%`,
                      backgroundColor: SEVERITY_COLORS[prediction.severity].bg,
                    }}
                  />
                </div>
                <span className="font-mono-nums text-[12px] font-medium" style={{ color: "var(--v-text-1)" }}>
                  {Math.round(prediction.confidence * 100)}%
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: "var(--v-text-2)" }}>
                Breath #
              </p>
              <p className="font-mono-nums text-[12px] font-medium" style={{ color: "var(--v-text-1)" }}>
                {prediction.breath_idx.toLocaleString()}
              </p>
            </div>
          </div>

          <p className="text-[11px] mt-2" style={{ color: "var(--v-text-3)" }}>
            {formatTimestamp(prediction.timestamp_s)}
          </p>
        </>
      )}
    </div>
  );
}
