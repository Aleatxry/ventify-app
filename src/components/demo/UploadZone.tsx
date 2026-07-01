"use client";

import { useCallback, useRef, useState } from "react";
import { generateSampleCSV } from "@/lib/demoPipeline";

interface UploadZoneProps {
  onUpload: (file: File) => void;
}

export default function UploadZone({ onUpload }: UploadZoneProps) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = useCallback((file: File) => {
    if (!file.name.endsWith(".csv")) {
      setError("Please upload a .csv file");
      return;
    }
    setError(null);
    onUpload(file);
  }, [onUpload]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handle(file);
  }, [handle]);

  const downloadSample = () => {
    const csv  = generateSampleCSV();
    const blob = new Blob([csv], { type: "text/csv" });
    const a    = document.createElement("a");
    a.href     = URL.createObjectURL(blob);
    a.download = "ventify_sample.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="animate-fade-up" style={{ maxWidth: 680, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--v-text-1)", marginBottom: 6 }}>
          Upload Waveform CSV
        </h2>
        <p style={{ fontSize: 14, color: "var(--v-text-2)", lineHeight: 1.6 }}>
          Required columns: <code style={{ fontFamily: "Menlo, monospace", fontSize: 12, background: "var(--v-surface-raised)", padding: "1px 5px", borderRadius: 4 }}>time, pressure, flow, volume</code>
        </p>
      </div>

      {/* Drop zone */}
      <button
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{
          width: "100%",
          padding: "48px 32px",
          border: `2px dashed ${dragging ? "var(--v-accent)" : "var(--v-divider)"}`,
          borderRadius: 20,
          background: dragging ? "var(--v-accent-pale)" : "var(--v-surface)",
          cursor: "pointer",
          textAlign: "center",
          transition: "all 200ms ease",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
        }}
      >
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <rect width="40" height="40" rx="12" fill="var(--v-accent-pale)"/>
          <path d="M20 28V16M14 22l6-6 6 6" stroke="var(--v-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M13 30h14" stroke="var(--v-accent)" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <div>
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--v-text-1)", marginBottom: 4 }}>
            {dragging ? "Drop to upload" : "Drop CSV here or click to browse"}
          </p>
          <p style={{ fontSize: 12, color: "var(--v-text-3)" }}>
            .csv · pressure, flow, volume columns required
          </p>
        </div>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        style={{ display: "none" }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handle(f); }}
      />

      {error && (
        <p style={{ fontSize: 13, color: "var(--v-critical)", marginTop: 12 }}>{error}</p>
      )}

      {/* Sample CSV */}
      <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 13, color: "var(--v-text-3)" }}>No data?</span>
        <button
          onClick={downloadSample}
          style={{
            fontSize: 13, fontWeight: 500, color: "var(--v-accent)",
            background: "none", border: "none", cursor: "pointer", padding: 0,
            textDecoration: "underline",
          }}
        >
          Download sample CSV
        </button>
        <span style={{ fontSize: 12, color: "var(--v-text-3)" }}>
          (12 breaths, 4 PVA types embedded)
        </span>
      </div>
    </div>
  );
}
