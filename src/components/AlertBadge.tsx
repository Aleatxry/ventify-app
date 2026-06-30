import type { Severity } from "@/types/ventify";
import { SEVERITY_COLORS } from "@/lib/constants";

interface AlertBadgeProps {
  severity: Severity;
  pulse?: boolean;
  size?: "sm" | "md";
}

export default function AlertBadge({ severity, pulse = false, size = "md" }: AlertBadgeProps) {
  const colors = SEVERITY_COLORS[severity];
  const isCritical = severity === "Critical";

  const sizeClass = size === "sm"
    ? "px-2 py-0.5 text-[10px] tracking-wider"
    : "px-3 py-1 text-[11px] tracking-widest";

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-full font-semibold uppercase
        ${sizeClass}
        ${isCritical && pulse ? "animate-pulse-badge" : ""}
      `}
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      <span
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: colors.text, opacity: 0.8 }}
      />
      {severity}
    </span>
  );
}
