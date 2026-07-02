"use client";

import { useState, useCallback } from "react";
import Header from "@/components/Header";
import PipelineNav, { STEP_ORDER } from "@/components/demo/PipelineNav";
import UploadZone from "@/components/demo/UploadZone";
import RawSection from "@/components/demo/RawSection";
import Layer1Section from "@/components/demo/Layer1Section";
import Layer2Section from "@/components/demo/Layer2Section";
import SnorkelSection from "@/components/demo/SnorkelSection";
import ResultSection from "@/components/demo/ResultSection";
import {
  parseCSV, segmentBreaths, computeAllFeatures, classifyBreaths,
} from "@/lib/demoPipeline";
import type {
  PipelineStep, CsvWaveformPoint, DetectedBreath,
  BreathFeatures, LabelMatrixRow,
} from "@/types/demo";

export default function DemoPage() {
  const [step,        setStep]        = useState<PipelineStep>("upload");
  const [maxStep,     setMaxStep]     = useState<PipelineStep>("upload");
  const [slideDir,    setSlideDir]    = useState<"left" | "right">("left");
  const [processing,  setProcessing]  = useState(false);
  const [csvData,     setCsvData]     = useState<CsvWaveformPoint[] | null>(null);
  const [csvMeta,     setCsvMeta]     = useState<{ hz: number; hasTime: boolean; columns: string[] } | null>(null);
  const [breaths,     setBreaths]     = useState<DetectedBreath[] | null>(null);
  const [features,    setFeatures]    = useState<BreathFeatures[] | null>(null);
  const [labelMatrix, setLabelMatrix] = useState<LabelMatrixRow[] | null>(null);
  const [parseError,  setParseError]  = useState<string | null>(null);

  const navigate = useCallback((target: PipelineStep) => {
    setSlideDir(STEP_ORDER[target] > STEP_ORDER[step] ? "left" : "right");
    setStep(target);
  }, [step]);

  const handleUpload = useCallback(async (file: File) => {
    setParseError(null);
    try {
      const text = await file.text();
      const result = parseCSV(text);
      setCsvData(result.data);
      setCsvMeta({ hz: result.hz, hasTime: result.hasTime, columns: result.detectedColumns });
      setSlideDir("left");
      setStep("raw");
      setMaxStep("raw");
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Parse failed");
    }
  }, []);

  const advance = useCallback(async (from: PipelineStep) => {
    setProcessing(true);
    await new Promise(r => setTimeout(r, 600));

    let next: PipelineStep = from;

    if (from === "raw" && csvData) {
      if (!breaths) setBreaths(segmentBreaths(csvData));
      next = "layer1";
    } else if (from === "layer1" && csvData && breaths) {
      if (!features) setFeatures(computeAllFeatures(csvData, breaths));
      next = "layer2";
    } else if (from === "layer2" && csvData && breaths && features) {
      if (!labelMatrix) setLabelMatrix(classifyBreaths(csvData, breaths, features));
      next = "snorkel";
    } else if (from === "snorkel") {
      next = "result";
    }

    setSlideDir("left");
    setStep(next);
    if (STEP_ORDER[next] > STEP_ORDER[maxStep]) setMaxStep(next);
    setProcessing(false);
  }, [csvData, breaths, features, labelMatrix, maxStep]);

  const reset = useCallback(() => {
    setStep("upload");
    setMaxStep("upload");
    setSlideDir("left");
    setCsvData(null);
    setBreaths(null);
    setFeatures(null);
    setLabelMatrix(null);
    setParseError(null);
    setProcessing(false);
  }, []);

  const slideClass = slideDir === "left" ? "animate-slide-from-right" : "animate-slide-from-left";

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--v-bg)" }}>
      <Header showBack roomLabel="Pipeline Demo — PVA Classification" isConnected={false} />

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px" }}>
        <div style={{ marginBottom: 36 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--v-text-1)", marginBottom: 6 }}>
            PVA Detection Pipeline
          </h1>
          <p style={{ fontSize: 14, color: "var(--v-text-2)", lineHeight: 1.6 }}>
            Upload a ventilator waveform CSV and watch the full pipeline — segmentation, feature extraction, Snorkel labeling, classification.
          </p>
        </div>

        <div style={{ marginBottom: 40, overflowX: "auto", paddingBottom: 4 }}>
          <PipelineNav step={step} maxStep={maxStep} onStepClick={navigate} />
        </div>

        {/* Slide content — key forces remount + animation on step change */}
        <div key={step} className={slideClass}>
          {step === "upload" && (
            <>
              <UploadZone onUpload={handleUpload} />
              {parseError && (
                <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: 12, background: "var(--v-critical-pale)", border: "1px solid var(--v-critical)" }}>
                  <p style={{ fontSize: 13, color: "var(--v-critical)", fontWeight: 500 }}>{parseError}</p>
                </div>
              )}
            </>
          )}

          {step === "raw" && csvData && (
            <RawSection
              data={csvData}
              meta={csvMeta}
              onNext={() => advance("raw")}
              processing={processing}
            />
          )}

          {step === "layer1" && csvData && breaths && (
            <Layer1Section
              data={csvData}
              breaths={breaths}
              onNext={() => advance("layer1")}
              processing={processing}
            />
          )}

          {step === "layer2" && features && (
            <Layer2Section
              features={features}
              onNext={() => advance("layer2")}
              processing={processing}
            />
          )}

          {step === "snorkel" && labelMatrix && (
            <SnorkelSection
              matrix={labelMatrix}
              onNext={() => advance("snorkel")}
              processing={processing}
            />
          )}

          {step === "result" && labelMatrix && (
            <ResultSection matrix={labelMatrix} onReset={reset} />
          )}
        </div>
      </main>
    </div>
  );
}
