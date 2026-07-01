"use client";

import Link from "next/link";
import LungIcon from "./LungIcon";
import ThemeToggle from "./ThemeToggle";

interface HeaderProps {
  roomLabel?: string;
  isConnected?: boolean;
  lastUpdated?: Date | null;
  showBack?: boolean;
  patientLabel?: string;
}

export default function Header({
  roomLabel = "ICU Ward — MICU2",
  isConnected = true,
  lastUpdated = null,
  showBack = false,
  patientLabel,
}: HeaderProps) {
  const timeStr = lastUpdated
    ? lastUpdated.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

  return (
    <header
      className="sticky top-0 z-40"
      style={{
        background: "var(--v-header-bg)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        borderBottom: "1px solid var(--v-header-border)",
        transition: "background 250ms ease, border-color 250ms ease",
      }}
    >
      {/* Ambient waveform trace */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
        <svg
          className="absolute bottom-0 left-0 w-full"
          height="60"
          viewBox="0 0 1440 60"
          preserveAspectRatio="none"
          style={{ opacity: 0.045 }}
        >
          <path
            d="M0 30 C60 30,80 10,120 10 C160 10,170 50,210 50 C250 50,260 30,300 30
               C340 30,360 10,400 10 C440 10,450 50,490 50 C530 50,540 30,580 30
               C620 30,640 10,680 10 C720 10,730 50,770 50 C810 50,820 30,860 30
               C900 30,920 10,960 10 C1000 10,1010 50,1050 50 C1090 50,1100 30,1140 30
               C1180 30,1200 10,1240 10 C1280 10,1290 50,1330 50 C1370 50,1390 30,1440 30"
            stroke="var(--v-accent)"
            strokeWidth="2"
            fill="none"
          />
        </svg>
      </div>

      <div className="relative flex items-center justify-between h-[60px] px-6 max-w-[1600px] mx-auto">
        {/* Left */}
        <div className="flex items-center gap-3">
          {showBack && (
            <Link
              href="/"
              className="flex items-center gap-1 text-sm font-medium mr-2"
              style={{ color: "var(--v-accent)" }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Ward
            </Link>
          )}
          <LungIcon size={28} />
          <span className="text-[18px] font-bold tracking-[-0.3px]" style={{ color: "var(--v-text-1)" }}>
            Ventify
          </span>
        </div>

        {/* Center */}
        <div className="absolute left-1/2 -translate-x-1/2 text-center">
          <p className="text-[13px] font-semibold" style={{ color: "var(--v-text-1)" }}>
            {patientLabel ?? roomLabel}
          </p>
        </div>

        {/* Right */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-2 h-2 rounded-full animate-live-dot"
              style={{ backgroundColor: isConnected ? "var(--v-normal)" : "var(--v-critical)" }}
            />
            <span className="text-[12px] font-medium" style={{ color: "var(--v-text-2)" }}>
              {isConnected ? "Live" : "Disconnected"}
            </span>
          </div>
          {timeStr && (
            <span className="text-[11px] font-mono-nums" style={{ color: "var(--v-text-3)" }}>
              {timeStr}
            </span>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
