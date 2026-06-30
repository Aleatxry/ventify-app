import type { Severity } from "@/types/ventify";
import { SEVERITY_COLORS } from "@/lib/constants";

interface BreathDotsProps {
  history: Severity[];
  count?: number;
}

export default function BreathDots({ history, count = 10 }: BreathDotsProps) {
  const slots = Array.from({ length: count }, (_, i) => history[i] ?? null);

  return (
    <div className="flex items-center gap-[4px] mt-1.5">
      {slots.map((sev, i) => (
        <span
          key={i}
          className="inline-block w-2 h-2 rounded-full"
          title={sev ?? "No data"}
          style={{
            backgroundColor: sev ? SEVERITY_COLORS[sev].dot : "#E5E5EA",
          }}
        />
      ))}
    </div>
  );
}
