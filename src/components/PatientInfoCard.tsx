import type { PatientInfo } from "@/types/ventify";

interface PatientInfoCardProps {
  info: PatientInfo;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, padding: "5px 0", borderBottom: "1px solid var(--v-divider)" }}>
      <span style={{ fontSize: 11, color: "var(--v-text-3)", fontWeight: 500, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, color: "var(--v-text-1)", fontWeight: 500, textAlign: "right" }}>{value}</span>
    </div>
  );
}

export default function PatientInfoCard({ info }: PatientInfoCardProps) {
  const bmiLabel = info.bmi == null ? "—"
    : info.bmi < 18.5 ? `${info.bmi} (ต่ำกว่าเกณฑ์)`
    : info.bmi < 25   ? `${info.bmi} (ปกติ)`
    : info.bmi < 30   ? `${info.bmi} (น้ำหนักเกิน)`
    : `${info.bmi} (อ้วน)`;

  return (
    <div className="v-card" style={{ padding: "16px 18px" }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: "var(--v-text-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
        Patient Info
      </p>

      {/* Header — gender + age */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: info.gender === "ช" ? "rgba(10,132,255,0.15)" : "rgba(255,55,95,0.15)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14,
        }}>
          {info.gender === "ช" ? "♂" : "♀"}
        </div>
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--v-text-1)", lineHeight: 1.2 }}>
            {info.gender === "ช" ? "ชาย" : "หญิง"} {info.age} ปี
          </p>
          <p style={{ fontSize: 11, color: "var(--v-text-3)" }}>
            วันที่ {info.dayOnVent} บน ventilator
          </p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        <Row label="น้ำหนัก / ส่วนสูง" value={info.weightKg && info.heightCm ? `${info.weightKg} kg / ${info.heightCm} cm` : "—"} />
        <Row label="BMI" value={bmiLabel} />
        <Row label="PDx" value={info.pdx} />
        {info.sdx && <Row label="SDx" value={info.sdx} />}
        <div style={{ padding: "5px 0" }}>
          <p style={{ fontSize: 11, color: "var(--v-text-3)", fontWeight: 500, marginBottom: 4 }}>Operations</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {info.operations.map((op, i) => (
              <span key={i} style={{ fontSize: 11, color: "var(--v-text-2)", paddingLeft: 8, borderLeft: "2px solid var(--v-divider)" }}>
                {op}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
