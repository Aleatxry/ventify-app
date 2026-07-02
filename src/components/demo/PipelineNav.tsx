"use client";

import type { PipelineStep } from "@/types/demo";

const STEPS: { key: PipelineStep; label: string }[] = [
  { key: "upload",  label: "Upload"  },
  { key: "raw",     label: "Raw"     },
  { key: "layer1",  label: "Layer 1" },
  { key: "layer2",  label: "Layer 2" },
  { key: "snorkel", label: "Snorkel" },
  { key: "result",  label: "Result"  },
];

export const STEP_ORDER: Record<PipelineStep, number> = {
  upload: 0, raw: 1, layer1: 2, layer2: 3, snorkel: 4, result: 5,
};

interface PipelineNavProps {
  step: PipelineStep;
  maxStep: PipelineStep;
  onStepClick: (s: PipelineStep) => void;
}

export default function PipelineNav({ step, maxStep, onStepClick }: PipelineNavProps) {
  const cur = STEP_ORDER[step];
  const max = STEP_ORDER[maxStep];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
      {STEPS.map(({ key, label }, i) => {
        const order     = STEP_ORDER[key];
        const done      = order < cur;
        const active    = order === cur;
        const reachable = order <= max && !active;
        const clickable = reachable;

        return (
          <div key={key} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div
                onClick={() => clickable && onStepClick(key)}
                style={{
                  width: 28, height: 28, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700,
                  background: done   ? "var(--v-normal)"
                            : active ? "var(--v-accent)"
                            : "var(--v-surface-raised)",
                  color: (done || active) ? "#fff" : "var(--v-text-3)",
                  border: active ? "2px solid var(--v-accent)" : "2px solid transparent",
                  boxShadow: active ? "0 0 0 3px var(--v-accent-pale)" : "none",
                  cursor: clickable ? "pointer" : "default",
                  transition: "background 300ms ease, transform 150ms ease",
                  transform: "scale(1)",
                }}
                onMouseEnter={e => { if (clickable) (e.currentTarget as HTMLElement).style.transform = "scale(1.12)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
              >
                {done ? "✓" : i + 1}
              </div>
              <span style={{
                fontSize: 10,
                fontWeight: active ? 600 : 400,
                color: active    ? "var(--v-accent)"
                     : done      ? "var(--v-text-2)"
                     : reachable ? "var(--v-text-2)"
                     : "var(--v-text-3)",
                whiteSpace: "nowrap",
                cursor: clickable ? "pointer" : "default",
              }}
                onClick={() => clickable && onStepClick(key)}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{
                height: 1, width: 48, marginBottom: 16,
                background: done ? "var(--v-normal)" : "var(--v-divider)",
                transition: "background 300ms ease",
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
