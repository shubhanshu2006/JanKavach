# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two audiences the design must satisfy at once:

- **In-fiction primary user:** an NDLS (New Delhi Railway Station) control-room supervisor/operator, monitoring live crowd density across concourse, gates, foot-over-bridges, and platforms during a service shift, deciding whether to confirm or cancel AI-staged interventions.
- **Real primary audience:** hackX 1.0 judges, evaluating the product in a short (2-3 min) live or recorded demo. They need to read severity, autonomous response speed, and outcome without narration.

Design brief (confirmed): balance both — an ops console a supervisor would trust for an 8-hour shift, composed so its drama (sub-3-second autonomous response vs. a 4-minute human baseline) is instantly legible to someone watching for the first time.

## Product Purpose

JanKavach is an autonomous crowd-safety decision engine for Indian Railway stations. It predicts crowd crush formation ~90 seconds before it turns lethal and fires a graded escalation of mostly-autonomous interventions (PA announcement, escalator direction reversal, gate throttling, platform closure, emergency dispatch) in under 3 seconds — replacing the ~4-minute human decision loop (notice → escalate → authorize) that failed at New Delhi Railway Station on Feb 15, 2025, killing 18 people.

Success for this UI redesign: a viewer (judge or in-fiction operator) understands, within the first viewport, that this is a live safety-critical control system, not a data dashboard — and can see the graded human/AI authority split at a glance.

## Positioning

Existing systems (CCTV dashboards, occupancy counters, manned control rooms like Kumbh 2025's 400-operator ICCC) detect crowds; none autonomously decide. JanKavach's mechanism is a graded, level-gated autonomous response engine:

- L1 (density ≥5/m²) and L4 PRE-WARN (≥7/m²): fire automatically, <3s, no human in the loop.
- L2 (≥6/m²): stages an action and always requires an explicit operator confirm — it does not auto-execute. The on-screen timer is an elapsed-time urgency indicator, not a countdown to automatic action (fixed 2026-08-22, alongside a backend change that also moved escalator-reversal and Gate B throttling from L1 into this confirm-gated tier).
- L3 (predicted ≥7.5/m² in 90s): platform closure, always requires a human one-tap confirm — never auto-fires.
- L5 SOS (≥8/m²): full emergency dispatch, automatic, but hard-gated — cannot cold-fire unless L4 already fired for the same zone in the current incident.

This graded trust ladder (not "full autonomy") is the product's defensible, non-copyable claim.

## Operating Context

- Real-time WebSocket feed (`ws://.../ws/live`) driving zone density, predictions, and the intervention log.
- Scripted demo scenario recreating the Feb 15 2025 FOB-3 stairway crush at NDLS, selectable by max escalation level (L1 through SOS) for judge walkthroughs.
- Split-screen comparison mode: identical input run through "human-operated station" vs. "JanKavach" side by side, with response-time and outcome stat bars.
- Live video tracking mode: real YOLOv8m+SAHI person detection over stock platform/aerial camera footage, rendered as raw feed + AI tracking overlay side by side.
- Overlay/notification surfaces layered on the console: PA announcement banner, phone push-notification mockup, RPF dispatch alert, PRE-WARN banner, full-screen SOS emergency dispatch overlay.

## Capabilities and Constraints

- Five fixed escalation levels with fixed density thresholds (documented in README.md); do not alter trigger logic or thresholds — this is a visual/UX redesign, not a logic change.
- L3 must always visually and functionally require human confirmation — never implied as auto-firing.
- L5 SOS must visually communicate its dependency on a prior L4 for the same zone (no "cold SOS").
- All emergency-service dispatch is simulated. Any dispatch UI must stay clearly labeled `[SIMULATED]` / not connected to live services — this labeling is a hard constraint, not decoration to be designed away.
- Never imply real connection to RailTel/IRCTC/live station infrastructure.
- Copy must use "graded autonomous response," not "fully autonomous."
- All displayed statistics must remain traceable to `problem_validation.md` / README — no invented numbers introduced by the redesign.

## Brand Commitments

- Product name: **JanKavach** (Hindi: Jan = public / Kavach = shield).
- Tagline: "Predict. Respond. Prevent." — and the longer form "Predict crowd crush formation 90 seconds before it becomes lethal. Respond without waiting for a human."
- Built for hackX 1.0, Railways theme, Team Amogh.
- Existing zone/location naming (NDLS platforms, FOB-1/2/3, Ajmeri/Paharganj gates) is real incident geography from the Feb 15 2025 event — preserve as factual content.

## Evidence on Hand

- `README.md`, `PRD.md`, `problem_validation.md` (16-section market research report), `AGENT_RULES.md`, `APP_FLOW.md`, `DEMO_SCRIPT_V3.md` — all in project root.
- Real stock video assets: `frontend/public/videos/aerial.webm`, `platform.webm`.
- Real YOLOv8m model (`yolov8m.pt`) and working FastAPI + WebSocket backend producing live detection/tracking data.
- No existing logo/wordmark asset beyond the current "ATC" monogram tile in the header — free to redesign.

## Product Principles

1. **Speed is the drama.** Every visual decision should make the sub-3-second autonomous response viscerally legible against the 4-minute human baseline it replaces.
2. **Graded trust, not blind automation.** The interface must visibly distinguish auto-fired actions (L1/L4/L5) from human-gated ones (L2 cancel window, L3 confirm) — autonomy is earned per level, never implied uniformly.
3. **Simulation honesty.** Anything not real (emergency dispatch, infrastructure integration) stays clearly, legibly marked as simulated. Never blur demo fiction into an implied deployment claim.
4. **Operator trust over marketing gloss.** Despite hackathon staging, the console must read as something a shift supervisor could actually run a station from.
5. **Evidence-first data.** Every stat, density figure, and timestamp on screen must trace to real project sources; nothing invented in UI copy.
