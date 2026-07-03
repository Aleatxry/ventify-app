"use client";

import Link from "next/link";

interface HeaderProps {
  roomLabel?: string;
  isConnected?: boolean;
  lastUpdated?: Date | null;
  showBack?: boolean;
  patientLabel?: string;
  criticalCount?: number;
  elevatedCount?: number;
  normalCount?: number;
}

export default function Header({
  roomLabel = "ICU · MICU2",
  isConnected = true,
  lastUpdated = null,
  showBack = false,
  patientLabel,
  criticalCount,
  elevatedCount,
  normalCount,
}: HeaderProps) {
  const timeStr = lastUpdated
    ? lastUpdated.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

  const showCounts = criticalCount !== undefined || elevatedCount !== undefined || normalCount !== undefined;

  return (
    <header
      className="sticky top-0 z-40"
      style={{
        background: "var(--v-header-bg)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        borderBottom: "1px solid var(--v-header-border)",
      }}
    >
      <div className="relative flex items-center justify-between px-5 mx-auto" style={{ height: 38, maxWidth: 1920 }}>
        {/* Left */}
        <div className="flex items-center gap-2.5">
          {showBack && (
            <Link
              href="/"
              className="flex items-center gap-1 font-medium mr-1"
              style={{ fontSize: 13, color: "var(--v-accent)" }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Ward
            </Link>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/ventify-logo.png"
            alt="Ventify"
            width={28}
            height={24}
            style={{ objectFit: "contain", display: "block" }}
          />
          <span className="font-bold tracking-tight" style={{ fontSize: 15, color: "var(--v-text-1)" }}>
            Ventify
          </span>
          <span style={{ fontSize: 12, color: "var(--v-divider)", marginLeft: 2 }}>·</span>
          <span style={{ fontSize: 13, color: "var(--v-text-2)", fontWeight: 500 }}>
            {patientLabel ?? roomLabel}
          </span>
        </div>

        {/* Center — severity counts (ward page only) */}
        {showCounts && (
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-4">
            {!!criticalCount && (
              <span className="flex items-center gap-1.5 font-bold tabular-nums" style={{ fontSize: 13, color: "var(--v-critical)" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "var(--v-critical)", display: "inline-block" }} />
                {criticalCount} Critical
              </span>
            )}
            {!!elevatedCount && (
              <span className="flex items-center gap-1.5 font-bold tabular-nums" style={{ fontSize: 13, color: "var(--v-elevated)" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "var(--v-elevated)", display: "inline-block" }} />
                {elevatedCount} Elevated
              </span>
            )}
            {normalCount !== undefined && normalCount > 0 && (
              <span className="flex items-center gap-1.5 font-semibold tabular-nums" style={{ fontSize: 13, color: "var(--v-normal)" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "var(--v-normal)", display: "inline-block" }} />
                {normalCount} Stable
              </span>
            )}
          </div>
        )}

        {/* Right */}
        <div className="flex items-center gap-3">
          <span
            className="inline-block w-2 h-2 rounded-full animate-live-dot"
            style={{ backgroundColor: isConnected ? "var(--v-normal)" : "var(--v-critical)" }}
          />
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--v-text-2)" }}>
            {isConnected ? "Live" : "Offline"}
          </span>
          {timeStr && (
            <span className="font-mono-nums" style={{ fontSize: 13, color: "var(--v-text-1)", fontWeight: 600 }}>
              {timeStr}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
