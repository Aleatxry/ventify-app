export default function EmptyState({ message = "Connecting to ventilator data..." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center mb-2"
        style={{ backgroundColor: "var(--v-accent-pale)" }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="var(--v-accent)" strokeWidth="1.5"/>
          <path d="M12 7v5l3 3" stroke="var(--v-accent)" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
      <p className="text-[15px] font-semibold" style={{ color: "var(--v-text-1)" }}>Waiting for data</p>
      <p className="text-[13px] max-w-xs" style={{ color: "var(--v-text-2)" }}>{message}</p>
    </div>
  );
}
