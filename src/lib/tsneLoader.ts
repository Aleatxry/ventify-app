// Loader for out/patient_tsne.json (see WEB_HANDOFF.md, "Data contract 3").
// Not yet generated for either the sample or real dataset as of this writing —
// loadPatientTsne returns null on a missing file/entry, same convention as
// loadRealCaptures, so callers render an empty/pending state rather than
// erroring until the file exists at /data/patient_tsne.json.

export interface TsnePoint {
  x: number;
  y: number;
  type: string;
  cluster: number;
}

export interface TsneCluster {
  id: number;
  n: number;
  dominant_type: string;
  type_mix: Partial<Record<string, number>>;
}

export interface PatientTsneEntry {
  n_breaths: number;
  type_counts: Partial<Record<string, number>>;
  embedding: "tsne" | null;
  points?: TsnePoint[];
  clusters?: TsneCluster[];
  cluster_vs_type_ARI: number;
  note: string;
}

export type PatientTsneData = Record<string, PatientTsneEntry>;

export async function loadPatientTsne(patientHash: string): Promise<PatientTsneEntry | null> {
  try {
    const res = await fetch("/data/patient_tsne.json");
    if (!res.ok) return null;
    const data: PatientTsneData = await res.json();
    return data[patientHash] ?? null;
  } catch {
    return null;
  }
}
