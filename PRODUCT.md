# Product

## Register

product

## Users

ICU nurses and physicians at Thai tertiary-care hospitals (primary context: Srinagarind Hospital MICU2). Nurses monitor 5–10 mechanically ventilated patients simultaneously and cannot watch every ventilator screen continuously. Physicians need immediate notification when a patient's risk escalates. Both roles work under high cognitive load, in shift-based time-critical environments, with mixed Thai/English clinical vocabulary. Primary display: wall-mounted or bedside monitor (tablet and desktop sizes).

## Product Purpose

Ventify is a real-time ICU clinical decision-support system for Patient-Ventilator Asynchrony (PVA) detection and patient risk alerting. It reads ventilator waveform data (Flow, Pressure, Volume) from a separate ML backend via WebSocket, classifies each breath, aggregates a Ventilation Instability Index, and surfaces the result as: (1) a multi-patient ICU ward overview and (2) a per-patient waveform and alert detail view. All data is processed on-premise. Built for BDI Hackathon 2026 — Health Track.

## Brand Personality

Precise, urgent-aware, trustworthy. The system handles life-critical decisions; every element earns trust through clarity and restraint. ICU staff should feel the system is always watching so they don't have to.

## Anti-references

- Generic SaaS dashboard: cream/off-white background as a warm-tinted default, blue-600 as a generic accent, rounded card grid as scaffolding
- Consumer health apps: pastel gradients, playful rounded icons, friendly micro-copy
- Corporate intranet: dense gray table rows, Windows-era controls, flat monotone
- Cyberpunk overdesign: neon glows or circuit noise as primary aesthetic
- Any design where the tool itself demands attention over the clinical data it displays

## Design Principles

1. **Clarity at a glance** — critical severity must be readable in under 1 second; never require zooming or parsing
2. **Alert hierarchy is sacred** — severity levels must differ in color, shape, and weight simultaneously; never depend on color alone
3. **Show the evidence** — AI classification gains trust when it shows confidence scores and the PVA type; never just a number
4. **The tool disappears into the task** — interaction vocabulary is consistent across screens; delight is earned, not imposed
5. **On-premise and institutional** — the aesthetic communicates secure, professional hospital infrastructure, not cloud SaaS

## Accessibility & Inclusion

WCAG AA minimum. Alert severity communicated via color + text label + icon (never color alone). High contrast throughout. Support `prefers-reduced-motion`. Design for reading under pressure in variable ICU ambient light (can be dark or bright depending on shift). Keyboard navigation for all interactive elements with visible focus ring.
