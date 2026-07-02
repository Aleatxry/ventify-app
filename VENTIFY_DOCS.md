# Ventify — เอกสารระบบ

ระบบ ICU Dashboard สำหรับตรวจจับ Patient-Ventilator Asynchrony (PVA) แบบ real-time
ช่วยแพทย์/พยาบาลเห็นความผิดปกติในการหายใจของผู้ป่วยที่ใช้เครื่องช่วยหายใจ

---

## Tech Stack

| ส่วน | เทคโนโลยี |
|---|---|
| Framework | Next.js 16.2.9 App Router |
| Language | TypeScript (strict mode) |
| UI | React 19, Tailwind CSS v4 |
| Bundler | Turbopack |
| Deploy | Ubuntu 26.04 VM (`10.198.110.209:3000`) |
| Process manager | systemd (`ventify.service`) |
| ML (browser) | Rule-based LF voting (TypeScript) |
| ML (training) | Python, PyTorch, Scikit-learn (`ventify-ml/`) |

---

## โครงสร้าง Pages

```
/           → Ward Overview (ภาพรวม ICU ทุกเตียง)
/patient/[bedId]  → Patient Detail (waveform + alert ของผู้ป่วยแต่ละคน)
/demo       → Pipeline Demo (upload CSV แล้วรัน pipeline จำลอง)
```

---

## หน้า Ward Overview (`/`)

แสดงรายการผู้ป่วยทุกเตียงใน ICU

**Component:** `WardTable.tsx`
- แสดง BedId, PatientId, สถานะ PVA, Instability Index, NEWS Score
- ไอคอนปอด (LungIcon) = กำลังใช้เครื่องช่วยหายใจ
- กดแถวเพื่อเข้าหน้า Patient Detail

**ข้อมูล:** `useWardData` hook → ดึงจาก `mockData.ts` (mock data จำลอง)
ยังไม่ได้ต่อ WebSocket จริง — รอ backend จาก VM

---

## หน้า Patient Detail (`/patient/[bedId]`)

แสดง real-time waveform และ alert ของผู้ป่วยแต่ละคน

**Components หลัก:**
- `WaveformChart` — กราฟ Flow / Pressure / Volume แบบ real-time (30 วินาทีย้อนหลัง)
- `InstabilityCard` — Instability Index (Normal / Elevated / Critical)
- `CurrentPVACard` — PVA ล่าสุดที่ตรวจพบ + confidence
- `MetricsPanel` — pip, vt, driving pressure, compliance
- `VitalsStrip` — HR, BP, SpO2
- `AlertFeed` — ประวัติ alert ย้อนหลัง 50 รายการ

**Data flow:**
```
useVentifyStream("mock://BEDID")
        ↓
mock mode: createMockWard() จำลอง breath prediction ทุก ~2 วินาที
real mode: WebSocket รับ { bedId, patch } → update state
        ↓
BedData state → แต่ละ component แสดงผล
```

**Severity levels:**
- `Normal` (เขียว) — ปกติ
- `Elevated` (ส้ม) — ต้องเฝ้าระวัง
- `Critical` (แดง) — ต้องแจ้งแพทย์ทันที

---

## หน้า Demo Pipeline (`/demo`)

ให้ upload CSV ไฟล์จากเครื่องช่วยหายใจแล้วดู pipeline ทำงานทีละขั้น

### 6 ขั้นตอน (slide navigation)

```
Upload → Raw → Layer 1 → Layer 2 → Snorkel → Result
```

| ขั้น | ทำอะไร | Component |
|---|---|---|
| Upload | รับไฟล์ CSV | `UploadZone` |
| Raw | แสดงกราฟ waveform ดิบ | `RawSection` |
| Layer 1 | แบ่ง breath แต่ละครั้ง | `Layer1Section` |
| Layer 2 | คำนวณ features แต่ละ breath | `Layer2Section` |
| Snorkel | classify ด้วย LF voting | `SnorkelSection` |
| Result | สรุปผล | `ResultSection` |

**Navigation:** คลิกวงกลมด้านบนเพื่อกลับ step ที่ผ่านมาได้ / slide animation ซ้าย-ขวา

---

## Pipeline Logic (`src/lib/demoPipeline.ts`)

### ขั้นที่ 1 — `parseCSV()`

อ่านไฟล์ CSV จากเครื่องช่วยหายใจ
- รองรับ CSV ที่มีหรือไม่มี column เวลา
- ค้นหา column อัตโนมัติจากชื่อ (flow, pressure, volume)
- ถ้าไม่มีเวลา → สร้างเองจาก index ÷ 25Hz

```
Input:  CSV text
Output: [{time, pressure, flow, volume}, ...]
```

### ขั้นที่ 2 — `segmentBreaths()`

แบ่ง data point ออกเป็นแต่ละ breath

**วิธีที่ 1 — Volume trough** (real data):
- หา "จุดต่ำ" ของ volume = ต่ำกว่า 15% ของ range
- พอ volume ขึ้นพ้นจุดต่ำ = เริ่ม breath ใหม่
- กรองออกถ้าสั้นกว่า 15 จุด หรือ < 0.6 วินาที

**วิธีที่ 2 — Flow zero-crossing** (mock data):
- ใช้เมื่อ flow มีค่าติดลบ (expiration flow ลบ)
- หา point ที่ flow ข้าม threshold 2 L/min ขึ้น

```
Input:  [{time, pressure, flow, volume}, ...]
Output: [{idx, startIdx, endIdx, startTime, endTime, duration}, ...]
```

### ขั้นที่ 3 — `computeFeatures()`

คำนวณ 9 features จาก waveform ของแต่ละ breath

| Feature | คืออะไร |
|---|---|
| `pip` | Peak Inspiratory Pressure (cmH₂O) |
| `peep` | Positive End-Expiratory Pressure |
| `vt` | Tidal Volume (mL) |
| `drivingPressure` | pip - peep |
| `iTime` | เวลาหายใจเข้า (วินาที) |
| `eTime` | เวลาหายใจออก (วินาที) |
| `ieRatio` | iTime / eTime |
| `peakFlow` | flow สูงสุดช่วง inspiration |
| `flowAtEndInsp` | flow เฉลี่ยใน 20% สุดท้ายของ inspiration |

**สำคัญ:** ใช้ volume peak เป็นจุดแบ่ง insp/exp (ไม่ใช้ flow threshold)
เพราะ flow threshold ทำให้ eTime = 0 บน real data

```
Input:  data[], breath
Output: {pip, peep, vt, iTime, eTime, ieRatio, peakFlow, flowAtEndInsp, ...}
```

### ขั้นที่ 4 — `classifyBreaths()` — LF Voting

ใช้ **Labeling Functions (LF)** แบบ Snorkel 9 ตัว vote พร้อมกัน

**หลักการ:**
- แต่ละ LF ตรวจ feature แล้วตอบว่าใช่/ไม่ใช่
- นับ vote ต่อ class
- class ที่ได้ vote มากสุดชนะ
- confidence = votes_winner / total_votes
- ถ้า LF > 1 class fire พร้อมกัน → `isUncertain = true`

**9 Labeling Functions:**

```
Double Trigger (2 LFs):
  - iTime < 0.5s และ IE ratio > 0.7
  - iTime < 0.35s และ peakFlow > 50 L/min

Flow Starvation (3 LFs):
  - flowAtEndInsp / peakFlow > 40% และ iTime > 0.4s
  - flowAtEndInsp > 30 L/min และ iTime > 0.5s
  - iTime > 0.8s และ flowAtEndInsp > 20 L/min

Premature Cycling (2 LFs):
  - eTime < 0.8s และ eTime > 0.1s และ IE > 0.5
  - IE ratio > 0.8 และ eTime < 1.0s

Ineffective Effort (2 LFs):
  - VT < 200 mL และ iTime > 0.3s
  - VT < 100 mL
```

**Output ต่อ breath:**
```typescript
{
  finalLabel: "flow_starvation",   // class ที่ชนะ
  confidence: 0.75,                // สัดส่วน votes
  classProbabilities: {            // โอกาสทุก class
    flow_starvation: 0.75,
    premature_cycling: 0.25,
    ...
  },
  firedLFs: ["lf_fs_end_flow_ratio", "lf_fs_high_absolute_end_flow"],
  isUncertain: true,               // flag ให้แพทย์ยืนยัน
}
```

**ไม่ใช้ ML model ตอนนี้** — LF voting ทำงานได้โดยไม่ต้อง training data

---

## Types หลัก

### `PVALabel`
```typescript
"Normal" | "double_trigger" | "flow_starvation" | "premature_cycling" | "ineffective_effort"
```

### `Severity`
```typescript
"Normal" | "Elevated" | "Critical"
```

### `BedData` (ward/patient page)
```typescript
{
  bedId, patientId, isVentilated,
  latestPrediction: BreathPrediction,
  recentAlerts: Alert[],
  instabilityIndex: { value: number, tier: Severity },
  breathHistory: Severity[],      // 10 breath ล่าสุด
  waveformBuffer: WaveformPoint[], // 30 วินาทีย้อนหลัง
  vitals: { hr, sbp, dbp, map, spo2 },
  newsScore: number,
}
```

---

## WebSocket Protocol (รองรับแต่ยังไม่ใช้)

`useVentifyStream` รองรับ WebSocket จริงแล้ว รอแค่ backend

```
ws://[VM-IP]:[PORT]

Message format (server → client):
{
  "bedId": "A1",
  "patch": {
    "latestPrediction": { ... BreathPrediction },
    "waveformBuffer": [ ... ],
    "vitals": { ... },
    "recentAlerts": [ ... ]
  }
}
```

ถ้า server ส่ง message format นี้มา → hook จะ update state อัตโนมัติ

---

## Deployment (VM)

```
OS:      Ubuntu 26.04 LTS
IP:      10.198.110.209
Port:    3000
Process: systemd (ventify.service)
```

**Update deployment:**
```bash
~/update-ventify.sh
# git pull → npm install → npm run build → systemctl restart ventify
```

**ดู logs:**
```bash
sudo journalctl -u ventify -f
```

---

## ML Pipeline (`ventify-ml/`)

ไฟล์ Python สำหรับเทรน model เมื่อมี labeled data

| ไฟล์ | หน้าที่ |
|---|---|
| `src/pipeline.py` | โหลด CSV, segment breath, extract features |
| `src/train_mlp.py` | เทรน PyTorch MLP → export ONNX |

**Model ที่เทรนไว้แล้ว (ไม่ได้ใช้งาน):**
- `public/model/pva_classifier.onnx` — MLP จาก 76 breaths
- ไม่ใช้เพราะ data น้อยและ imbalanced มาก (75% เป็น flow_starvation)

**เมื่อไหรจะ train model จริง:**
```
ต้องการ: 500+ breaths ที่แพทย์ label จริง
pipeline: label data → train_mlp.py → export ONNX → copy ไปที่ public/model/
```

---

## สถานะตอนนี้ (2026-07-02)

| ส่วน | สถานะ |
|---|---|
| Ward overview page | ✅ ทำงานได้ (mock data) |
| Patient detail page | ✅ ทำงานได้ (mock data) |
| Demo pipeline | ✅ ทำงานได้ (LF voting) |
| WebSocket real-time | ⏳ รอ backend |
| ML model จริง | ⏳ รอ labeled data (ต้องการ 500+ breaths) |
| Deployment | ✅ VM 10.198.110.209:3000 |

---

## สิ่งที่ต้องทำต่อ

1. **Backend WebSocket** — ส่ง waveform + prediction จากเครื่องช่วยหายใจจริง
2. **Labeled data** — ให้แพทย์ label breath จาก VM
3. **Retrain model** — พอมี 500+ breaths → train MLP ใหม่ → แทน LF voting
4. **Human-in-the-loop** — UI ให้แพทย์ confirm/แก้ไข prediction → สะสม label อัตโนมัติ
