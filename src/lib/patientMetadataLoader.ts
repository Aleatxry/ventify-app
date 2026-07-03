// Loader + risk logic for out_real/patient_metadata.json (parsed from the
// real per-patient demographic/diagnosis JSONs -- see WEB_HANDOFF-adjacent
// docs; this file doesn't have a formal data-contract writeup yet since it's
// new this session). Diagnosis/SDx text is genuinely truncated at ~60 chars
// in the SOURCE data itself (confirmed against raw files, not a parsing bug)
// -- fields can end mid-word, callers should treat trailing text as lossy.

import type { PatientInfo } from "@/types/ventify";

export interface PatientMetadataEntry {
  age: number | null;
  gender: "ช" | "ญ" | null;
  weightKg: number | null;
  heightCm: number | null;
  bmi: number | null;
  pdx: string | null;
  sdx: string | null;
  operations: string | null;
  dayOnVent: number;
}

export type PatientMetadata = Record<string, PatientMetadataEntry>;

export async function loadPatientMetadata(): Promise<PatientMetadata | null> {
  try {
    const res = await fetch("/data/patient_metadata.json");
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function toPatientInfo(entry: PatientMetadataEntry): PatientInfo | null {
  if (entry.age == null || entry.gender == null) return null;
  return {
    age: entry.age,
    gender: entry.gender,
    weightKg: entry.weightKg,
    heightCm: entry.heightCm,
    bmi: entry.bmi,
    pdx: entry.pdx ?? "ไม่ระบุ",
    sdx: entry.sdx ?? "",
    operations: entry.operations ? entry.operations.split(/\s{2,}|(?<=[a-z])(?=[A-Z][a-z])/).filter(Boolean) : [],
    dayOnVent: entry.dayOnVent,
  };
}

// ICD-10 chapter X (J00-J99) = diseases of the respiratory system -- covers
// pneumonia, COPD, ARDS, respiratory failure, etc. Combined with a text
// keyword fallback because SDx is truncated in the source data and can lose
// its code entirely while the descriptive text survives (e.g. ddfe0c22's
// real SDx: "Chronic obstructive lung dis[ease]" -- COPD's J44 code got cut
// off, but "lung" didn't).
const LUNG_KEYWORDS = [
  "lung", "pulmonary", "pneumonia", "pneumonitis", "respiratory",
  "ards", "copd", "bronch", "aspiration",
];

export function hasLungInjury(entry: PatientMetadataEntry | null | undefined): boolean {
  if (!entry) return false;
  const text = `${entry.pdx ?? ""} ${entry.sdx ?? ""}`;
  if (/\(J\d/i.test(text)) return true;
  const lower = text.toLowerCase();
  return LUNG_KEYWORDS.some(kw => lower.includes(kw));
}

// 75, not the more common ">=65" convention -- keeps the flag selective
// (elderly/frail) rather than catching most of an ICU census.
export const OLD_AGE_THRESHOLD = 75;

export function isHighRisk(entry: PatientMetadataEntry | null | undefined): boolean {
  if (!entry) return false;
  const oldAge = entry.age != null && entry.age >= OLD_AGE_THRESHOLD;
  return oldAge || hasLungInjury(entry);
}
