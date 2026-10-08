# Blood Pressure Simulator Implementation Plan

## Objective and Scope

Create **“Simulador de medição de pressão arterial”**, a Portuguese-language WebXR simulator. The initial scenario is blood pressure measurement using the **auscultatory method**, with a seated patient and multiple guided steps. Menus, instructions, dialogue, feedback, and results must be in Portuguese; development documentation may remain in English.

### Architectural Decisions & Flow Modifications (2026 Revision):
1. **Clinical Environment Simplification:**
   - **Pre-seated Patient:** The 3D patient is already ergonomically seated on the examination chair with feet supported, back rested, and arm horizontally positioned at heart level.
   - **Pre-fitted Cuff:** The blood pressure cuff is considered already correctly sized and fitted on the patient's arm (2–3 cm above the cubital fossa with bladder aligned over the brachial artery). Checklist steps 9–12 (measuring arm circumference, selecting from 7 cuff variants, positioning patient, and fitting cuff) are pre-established environmental conditions of the simulation setup rather than mandatory manual learner actions.
2. **Decoupled Conversational Flow & Lateral Interaction Icon:**
   - **Non-blocking Communication:** Verbal and anamnese tasks (Step 5: Patient Identification, Step 6: Readiness/Anamnese, Step 7: Explanation & Rest, Step 23: Results Communication) do **not** act as rigid sequential roadblocks blocking physical interaction.
   - **Lateral Interaction Trigger:** A persistent lateral interaction icon (rendered in the 3D scene near the patient and in the UI) allows the learner to initiate dialogue with the patient at any point during the session.
   - **Contextual Timing Assessment & Formative Feedback:** Learners must independently recognize the clinically appropriate moment to ask each question. If a learner skips or delays asking (e.g. proceeding to inflate without identifying the patient or verifying 90 min post-exercise rest), the physical procedure is allowed to proceed without hard interruption; the omission or timing error is recorded and surfaced in the post-procedure debriefing report.
   - **Automatic Patient Response:** Once the learner identifies the need and triggers the appropriate dialogue topic, the patient provides an automatic response, seamlessly advancing the corresponding communication objective.

This document is a proposed implementation roadmap and progress tracker. The current repository provides:
- A fully enclosed 3D doctor's office room imported from [`doctors_office.glb`](../assets/Models/doctors_office.glb) with 4 complete walls, floor collision, and clinical lighting.
- Dedicated clinical examination and treatment chair ([`hospital_examination_and_treatment_chair.glb`](../assets/Models/hospital_examination_and_treatment_chair.glb)) installed in place of the generic couch, with provisional forearm proxies; anatomical fit awaits the patient model.
- 3D instruments placed on the consultation desk / stainless steel tray: aneroid sphygmomanometer ([`sphygmomanometer_low_poly.glb`](../assets/Models/sphygmomanometer_low_poly.glb)), rigged stethoscope ([`rigged_stethoscope.glb`](../assets/Models/rigged_stethoscope.glb)), and hand sanitizer pump ([`hand_sanitizer.glb`](../assets/Models/hand_sanitizer.glb)).
- First-person walking controls with collision detection (`W, A, S, D` / arrows) and 5 quick station shortcuts (`1` Overview, `2` Hygiene/Sink, `3` Clipboard/Record, `4` Doctor's Desk / Instrument Tray, `5` Patient Examination Chair).
- WebXR Default Experience (`src/scripts/xr.ts`) with thumbstick locomotion, teleportation snap points, hand tracking, and compatibility with the Immersive Web Emulator and VR headsets.
- A responsive Portuguese start menu with scenario configuration and patient selection (`src/ui/StartMenu.ts`).
- A verified 26-step single-arm auscultatory simulation engine (`src/simulation/`) with 31 unit tests and automated browser integration tests.
- `src/interaction/InteractionManager.ts` integrated in `App.ts` with dynamic 3D target resolution, animated indicator arrow, in-headset WebXR 3D slate guidance, desktop guidance HUD, and support for the lateral dialogue model.
- Task (1) placement corrections are implemented: instruments and sanitizer are aligned to the measured desktop/tray surface, chair props are cleared, and the chair faces into the room. Desktop review is recorded below; headset reach and patient fit remain pending.

## Reference Files and Visual Direction

**Runtime model loading:** `App.ts` references the five source GLBs in `assets/Models` through static Vite asset URLs. Vite serves them during development and bundles them for production. The clinical room must not depend on duplicate GLBs under the Editor-managed `public/scene/assets/Models` directory: those copies can disappear during an export. Editor scene exports remain separate from this code-composed room.

| Local reference | Intended use | Adaptation for this project |
| --- | --- | --- |
| [Start_menu.png](Start_menu.png) | Menu hierarchy, grouped settings, translucent panels, and prominent start button. The source is another university's simulator for a different procedure. | Use our title, the scenario “Método auscultatório”, and an “Iniciar simulação” button. Introduce guidance settings only when implemented. Replace the source institution's branding and unrelated procedure text. |
| [example_hands_and_step.png](example_hands_and_step.png) | Visible, simplified hands in first person; an arrow identifies the next interaction target, shown here at a hand hygiene dispenser. | Display tracked hands and a target arrow alongside a Portuguese instruction such as “Higienize as mãos”. Move the cue as each step is completed. |
| [checklist_v2.pdf](checklist_v2.pdf) | Current procedural source, revised 04/03/2026: steps 1–26, first-assessment note, cuff-sizing table, and adult office BP classification table. | Preserve numbered steps and conditional behavior; track the bilateral assessment note separately from the 26 numbered entries. Supersedes `checklist_v1.pdf` (formerly `check list medida da PA.pdf`). |

Images guide composition and interaction presentation; they are not finished application assets. Reference images and the PDF are local, Git-ignored files; Markdown plans are trackable. Contributors need local copies to inspect the linked source files.

## Implementation Sequence

### 1. Define Scenario Data and Progression ✓

Create a scenario definition with stable step IDs, source checklist numbers, Portuguese prompts, prerequisites, interaction targets, completion conditions, and corrective feedback. Keep scenario rules separate from hand-tracking code in `src/scripts/xr.ts`; a proposed location is `src/simulation/`.

Use an explicit progression controller: an action completes a step only when its conditions are met. Record attempts and completion, support restart, and handle conditional steps. Preserve each hand-hygiene occurrence as its own step. Use fictional patient identity and configurable pressure values. Keep clinical timings and thresholds traceable to the supplied PDF; the transcription below does not independently validate its clinical content.

**Acceptance:** the 26-step single-arm sequence and its persistent-sounds branch can be exercised with mock interaction events before adding detailed models.

**2026 follow-up (pending):** extend session orchestration for a first assessment with separate left/right arm circumference, cuff, pressure, sound-persistence flag, observations, and records. Preserve the original 26 source IDs within each measurement attempt. Gate the next measurement by the separate minimum one-minute interval, then require comparison and reference-arm selection before completing the assessment. The existing single-arm fixtures remain measurement-level tests and must not be presented as a complete first assessment.

### 2. Build the Portuguese Start Menu ✓

Implement the reference-inspired menu with the title, initial scenario, brief instructions, and start action. Start should initialize a fresh session. Provide a way to restart or return to the menu. When bilateral orchestration is implemented, distinguish “Primeira avaliação — dois braços” from a subsequent measurement using the recorded reference arm; do not expose an unimplemented mode. Keep labels and prompts centrally organized for consistent Portuguese terminology.

**Acceptance:** starting and restarting reliably reset patient, instruments, and progress.

### 3. Assemble the Clinical Room

Build this stage as small visual work packages. The initial procedural blockout has been superseded at runtime by GLB imports and procedural additions in `src/App.ts`; retain editable source assets and matching runtime assets in `public/scene/`, and do not describe the current room as a completed Editor export. Each package should include a screenshot from the learner's viewing position. Stages 3.3–3.4 have their initial integration complete, but placement corrections and detailed asset packages remain pending. Keep interaction logic, guidance UI, clinical validation, and measurement audio in stages 4–6; this stage prepares their visual assets and attachment points.

#### 3.1. Define the Asset Inventory and Visual Style ✓

- [x] Create an asset manifest listing each model, material/texture, intended dimensions, source/license where applicable, and completion status.
- [x] Use `example_room.png` to establish a consistent palette, simplified modeling style, lighting direction, and level of detail. Coordinate these with the existing Portuguese menu.
- [x] Specify a shared scale (one scene unit = one meter), orientation, naming convention, and origin/pivot conventions. Record initial geometry and texture budgets for the intended XR device.
- [x] Separate assets that need 3D geometry from optional generated bitmap textures or decorative images. Create instrument markings and labels with controlled text/vector/procedural sources so numbers and Portuguese wording remain exact.

**Delivered:** [visual specification](CLINICAL_ROOM_VISUAL_SPEC.md), typed asset inventory/palette/dimensions in `src/scene/clinicalRoomSpec.ts`, and generated `assets/clinical-room/manifest.json`. Every asset family in 3.3–3.8 has a production method and status; no third-party model or bitmap generation is required for this blockout.

#### 3.2. Block Out the Room and Reach Zones ✓

**Depends on:** 3.1.

- [x] Use simple placeholders for the floor, walls, chair, patient, arm support, hygiene station, and instrument surface.
- [x] Define the learner's starting position, patient orientation, viewing height assumptions, and accessible instrument locations.
- [x] Establish reach zones and station viewpoints: Overview `[0, 1.6, 0.5]`, Hygiene `[0.79, 1.6, -1.5]`, Record `[-0.07, 1.6, -1.2]`, and Desk `[-1.5, 1.6, -0.96]`.

**Delivered:** initial procedural blockout delivered in `src/scene/buildClinicalRoom.ts`, subsequently upgraded to direct 3D clinical room architecture.

#### 3.3. Build the Room Shell and Lighting ✓

**Depends on:** 3.2.

- [x] Replace room placeholders with full 3D doctor's office model (`doctors_office.glb`) scaled to 2.4x (~4.85m × 4.92m × 2.86m).
- [x] Complete missing cutaway walls: built matching procedural enclosure walls (`office-wall-right` at `x = 2.28` and `office-wall-front` at `z = 2.40`) with baseboard trim and wall material mapping from the GLB atlas.
- [x] Setup clinical lighting (`HemisphericLight`, `DirectionalLight`) with neutral clearColor, eliminating background skybox bleed (`.env` photo).
- [x] Enable solid camera and player collisions on all 4 walls and floor surfaces.
- [x] Removed obsolete environment texture assets (`hospital_room.env`) and duplicate public directories, eliminating network overhead and panoramic bleed.

**Delivered:** finished, fully enclosed clinical environment loaded directly in `src/App.ts` with clean lighting and no external skybox artifacts.

#### 3.4. Build the Chair, Arm Support, and Instrument Surface ✓

**Depends on:** 3.2; use the materials defined in 3.1.

- [x] Countertop with sink (`Counter_blinn1_0`), consultation desk (`Table_blinn1_0`), cupboards, stool, and office elements provided by `doctors_office.glb`.
- [x] Hide generic examination bed (`Bed_blinn1_0.setEnabled(false)`) and replace it with dedicated clinical examination chair ([`hospital_examination_and_treatment_chair.glb`](../assets/Models/hospital_examination_and_treatment_chair.glb)) positioned at `[-1.15, ~0.02, -1.25]` with +90° rotation and geometry-based floor alignment. Corrected by 180° following the learner-view screenshot review.
- [x] Provisional `patient-forearm-esquerdo` and `patient-forearm-direito` logical proxies at `Y = 0.95`; this is a targeting placeholder, not verified anatomical/heart-level alignment.
- [x] Consultation desk equipped with a metallic PBR tray (`tray`) at `[-2.04, ~0.988, -1.04]` as the staging surface for medical instruments.
- [x] Station navigation updated with station `5` (`cadeira` at `[-0.20, 1.70, -0.35]`, facing `[-1.15, 0.95, -1.45]`) and WebXR teleportation snap points.
- [x] Fixed chair collisions: Enabled collision detection across all active chair meshes and added full-height invisible box collision proxies (`chair-collider-body` and `chair-collider-tray`), preventing player locomotion from penetrating the chair or floating over low cushions from any angle.

**Delivered:** clinical examination chair and instrument tray loaded in `src/App.ts`. Ergonomic fit, reach, support-surface alignment, and viewing angles remain subject to task (1) placement review and the patient-pose review; invisible forearm proxies do not establish patient posture compliance.

#### 3.5. Create the Patient and Required Pose Variants (In Progress)

**Depends on:** 3.4.

- [x] Integrate 3D patient model ([`assets/Models/sitting_mannequin.glb`](../assets/Models/sitting_mannequin.glb)) seated on the clinical examination chair (`patient-root` at `[-1.22, 0.28, -1.20]`, rotated +90°).
- [x] Ergonomic alignment: Back rests against the chair's backrest, buttocks and thighs rest horizontally on the seat cushion (`wy ~ 0.76`), knees rest at the front edge of the seat, and feet extend down toward the footrest.
- [x] Arm and hand positioning: Both arms accessible, resting forward with hands on thighs, leaving left arm (`[-1.24, 0.95, -1.03]`) and right arm (`[-1.24, 0.95, -1.38]`) directly adjacent to the armrests and cuff tray.
- [x] Aligned logical targeting proxies (`patient-forearm-esquerdo` and `patient-forearm-direito`) and camera navigation targets (`cadeira`, `esquerdo`, `direito`) with the mannequin's anatomical upper arm and cubital fossa coordinates.
- [x] Collision detection enabled on patient geometry (`patient_Object_2.checkCollisions = true`) with semantic metadata (`assetId: "patient"`, `logicalTarget: "patient"`).
- [x] Prepare arm pose variants and anatomical anchors for circumference measurement, cuff fitting, and pulse/stethoscope placement. (Satisfied: Seated mannequin with right arm extended horizontally at heart level on elevated armrest, logical forearm/wrist proxies, and `fitted-cuff-sleeve` mesh).
- [x] Check uncrossed legs, feet on the floor/footrest, back support, and room for the cuff and stethoscope in the measurement pose.
- [x] **Baseline seated posture pre-established:** Patient is compliant with checklist step 10 (uncrossed legs, feet on floor, supported back, bare arm supported at heart level on elevated armrest) from scene initialization.

**Delivered:** seated patient model loaded in `src/App.ts`, correctly positioned on the clinical treatment chair with verified ergonomic posture, accessible arms, and automated browser test assertions.

#### 3.6. Create the Hygiene and Preparation Assets (In Progress)

**Depends on:** 3.2 and 3.4.

- [x] Soap dispenser (`Soap_blinn1_0`) and glove box dispenser integrated on the counter wall.
- [x] Integrate dedicated hand sanitizer pump model ([`assets/Models/hand_sanitizer.glb`](../assets/Models/hand_sanitizer.glb)) positioned on the consultation desk next to the tray (surface center `[-2.04, ~0.978, -0.62]`).
- [x] Correct the sanitizer's provisional placement as part of task (1): verify its visible base rests on the intended surface, its scale/orientation is appropriate, and its pump is visible and reachable.
- [ ] Add 70% alcohol container and cotton for stethoscope disinfection (checklist step 2).
- [ ] Add legible Portuguese labels where needed, including “Álcool 70%”. Distinguish instrument disinfectant from the hand-hygiene station.

**Deliverable / acceptance:** each preparation item is visually recognizable, correctly scaled, and available as an independent asset. Hygiene and disinfection completion logic remains in later stages.

#### 3.7. Create the Sphygmomanometer and Cuff Set (In Progress)

**Depends on:** 3.4 and 3.5.

- [x] Low-poly aneroid sphygmomanometer model loaded on the consultation desk tray (`sphygmo-root` at surface center `[-2.04, ~0.998, -0.88]`, using [`assets/Models/sphygmomanometer_low_poly.glb`](../assets/Models/sphygmomanometer_low_poly.glb)).
- [x] **Chair auxiliary tray cleanup:** disabled verified prop meshes `chair_Object_4`–`chair_Object_6` and `chair_Object_12`–`chair_Object_24`. Preserve `chair_Object_2`, `chair_Object_3`, `chair_Object_7`–`chair_Object_11`: the earlier removal list incorrectly included chair structure. Meshes are grouped by material, so numeric IDs are not semantic object labels.
- [x] **Place Blood Pressure Cuffs beside the chair**: In place of the removed drugs and syringes, position the blood pressure cuff set on the auxiliary table / tray beside the patient chair. The cuffs are accessible for observational comparison and study according to 2026 Table 1 (Recém-nascido, Criança, Infantil, Adulto pequeno, Adulto, Adulto grande, Coxa).
- [x] **Baseline pre-fitted cuff simplification:** Blood pressure cuff is considered pre-fitted on the patient's arm (steps 9, 11, and 12 satisfied as baseline environment conditions). Sizing selection and physical fitting are bypassed in the active learner path; the 7 storage cuffs on the tray remain for observational reference.
- [ ] Build/verify the aneroid gauge, separate needle, inflation bulb, valve, and connecting tubes. Give the needle and valve usable pivots for later animation.
- [ ] Create an accurate, readable gauge face with units and controlled numeric markings; verify it at the intended viewing distance.
- [x] Create all seven folded storage cuff variants from Table 1 (including “Coxa”), matching `clinicalParameters.ts`, with readable Portuguese size/range tags. Assets and generation details: [`assets/Models/cuffs/README.md`](../assets/Models/cuffs/README.md).
- [x] Add fitted-cuff artery alignment markings and attachment geometry after patient integration. (Delivered: `fitted-cuff-sleeve` cylinder mesh wrapping the upper arm with navy PBR material, artery orientation, and `logicalTarget: "cuff"`).
- [x] Prepare loose and fitted cuff representations, attachment anchors, and a tube arrangement that fits the patient without obvious clipping.

**Deliverable / acceptance:** the gauge is legible, each cuff variant is distinguishable, and fitted cuffs can be previewed on the patient. Pressure behavior and inflation/deflation remain in stage 6.

#### 3.8. Create the Stethoscope and Measuring Tape (In Progress)

**Depends on:** 3.5 and 3.6.

- [x] Rigged stethoscope model loaded on the consultation desk tray (`stethoscope-root` at surface center `[-2.04, ~0.998, -1.17]`, using [`assets/Models/rigged_stethoscope.glb`](../assets/Models/rigged_stethoscope.glb)).
- [ ] Set up tray and auscultation arrangements, with anchors for bell or diaphragm placement at either cubital region and provision for later earpiece placement.
- [ ] Build the measuring tape with legible centimeter markings and loose/wrapped representations that fit the upper arm at its midpoint.

**Deliverable / acceptance:** both instruments can be previewed in their storage and clinical positions without obscuring important anatomy. Grabbing, circumference validation, and audio belong to later stages.

#### 3.9. Integrate Assets and Map Interaction Targets ✓

**Depends on:** 3.3–3.8.

- [x] Map stable scene roots/anchors to scenario targets: `hygiene-station` (`Soap_blinn1_0`, `sanitizer-root`), `record` (`Clipboard_blinn1_0`), `table` (`Table_blinn1_0`), `tray`, `treatment-chair-root`, `sphygmo-root`, `stethoscope-root`, `sanitizer-root`, `patient-forearm-esquerdo`, `patient-forearm-direito`, `fitted-cuff-sleeve`, `patient-dialogue-trigger`.
- [x] Implement smooth keyboard navigation (`W, A, S, D` + arrows) and station hotkeys (`1` Overview, `2` Hygiene, `3` Record, `4` Desk/Tray, `5` Patient Chair).
- [x] Initialize WebXR Default Experience (`src/scripts/xr.ts`) with thumbstick smooth locomotion, snap turning, hand tracking, clinic floor teleportation (`DoctorsOffice_blinn1_0`), and teleport snap points for all 5 stations.
- [x] Zero-vertex mesh compliance enforced via modular `_loadModel()` helper disposing intermediate `__root__` meshes to pass headless browser validation.
- [x] Derive guidance indicator arrow positions and in-headset WebXR 3D slate dynamically from active interaction scene meshes and roots.

**Deliverable / acceptance:** the runtime scene loads through the existing application, all physical scenario targets resolve through the documented mapping, and accepted placements are reproducible.

#### 3.10. Review Visual Quality and XR Readiness (Partial — Current Room Only)

**Depends on:** 3.9.

- [x] Check scene loading, resizing, console errors, scale, clipping, lighting, and room enclosure.
- [x] Verify WebXR headset emulation via the Immersive Web Emulator extension and native XR runtime compatibility.
- [x] Verified through `tests/menu.browser.mjs`, unit test suite (`npm test`), and type checking (`npx tsc --noEmit`).
- Development URL: `http://localhost:3000` when `npm run dev` is running; server availability is transient, not a completed milestone.

**Current scope:** the checked entries above record earlier current-room checks, not fresh verification or complete scenario/XR acceptance. Task (1) corrects the imported-model placements; final patient fit and headset reach remain open. Browser automation/emulation does not replace compatible-headset testing; record the actual browser/device and untested behavior with each review.

- [ ] Repeat visual review after task (1), patient integration, and instrument integration, including support contact, clipping, scale, reach, label/gauge readability, resizing, and console errors.
- [ ] Validate instrument interactions on compatible XR hardware after stage 4; hands currently provide presence in the clinical room, while pinch ownership logic remains specific to the original box prototype.

**Deliverable / acceptance:** reviewable clinical scene with accepted placements and recorded desktop/XR evidence for the implemented scope. Full scenario acceptance remains stage 8.

#### 3.11. Current Milestone Status & Roadmap Summary

- **Current State (Delivered):**
  - Clinical room enclosure complete (4 walls, baseboard trim, zero skybox bleed).
  - Dedicated treatment chair integrated at `[-1.15, ~0.02, -1.25]` with seated patient mannequin (back supported, uncrossed legs, arm at heart level).
  - Pre-fitted blood pressure cuff sleeve (`fitted-cuff-sleeve`) placed on the patient's right arm with artery marker and navy PBR material.
  - Seven storage cuffs placed on the auxiliary chair tray matching 2026 Table 1.
  - Consultation desk equipped with metallic tray, aneroid sphygmomanometer, rigged stethoscope, and hand sanitizer pump.
  - WebXR locomotion with smooth thumbstick movement, snap turn, clinic floor teleportation (`DoctorsOffice_blinn1_0`), and 5 quick station viewpoints.
  - **Decoupled Lateral Dialogue System (Stage 4):** 3D floating speech bubble icon (`patient-dialogue-trigger`), desktop HUD trigger, 4 communication topics with automatic Portuguese patient responses, non-blocking progression, and real-time timing tracking.
  - **Single-Arm Auscultatory Procedure Pipeline (Stage 5):** Sequential physical pipeline (1 $\rightarrow$ 2 $\rightarrow$ 3 $\rightarrow$ 4 $\rightarrow$ 8 $\rightarrow$ 13 $\rightarrow$ 14 ... $\rightarrow$ 26) with automatic baseline satisfaction of steps 9–12 upon completing step 8. Direct 3D scene mesh picking.
  - **Formative Debriefing Report (Stage 7):** Comprehensive clinical evaluation at procedure conclusion (Passo 26), assessing 22 physical steps alongside the clinical timing (Ideal, Tardio, Precoce, Omitido) of conversational tasks.
- **Current Priority / Next Milestone:**
  - **Stage 6 — Measurement Mechanics & Korotkoff Audio:**
    1. Visual dial needle rotation animation on the aneroid gauge proportional to real-time cuff pressure.
    2. Real-time Korotkoff sound generation (phases I through V) via Web Audio API, synchronized with deflation rate (2 mmHg/s) and patient heart rate (~72 bpm).
    3. Visual stethoscope cubital fossa placement attachment and earpiece donning cues.
  - **Stage 8 — Hardware Validation:** Test complete physical and lateral dialogue flow on physical XR hardware and Immersive Web Emulator.

**Acceptance:** instruments are reachable, the patient assumes compliant posture, dialogue is non-blocking, and debriefing scores clinical performance accurately.

### 4. Implement Hands, Guidance, and Lateral Dialogue System ✓

**Decoupled Communication & Lateral Interaction Icon Architecture:**
- [x] **Lateral Interaction Icon:** Persistent 3D dialogue trigger icon beside patient (`patient-dialogue-trigger`) and persistent HUD button.
- [x] **Automated Patient Responses:** Realistic dialogue replies in Portuguese for patient identification, anamnese/readiness, explanation/rest, and results communication.
- [x] **Non-blocking / Formative Progression:** Verbal tasks do not block physical interaction. Out-of-order execution or omission is tracked and surfaced in post-procedure debriefing.
- [x] **In-Headset WebXR 3D Guidance:** Dynamic 3D indicator arrow and in-world 3D slate render directly in WebXR for spatial awareness.
- [x] **Physical Object Validation:** 3D mesh interaction on scene targets (sanitizer, stethoscope, tray, wrist proxy, cuff sleeve, manometer, chart), removing DOM auto-complete shortcuts.
- [x] Simulated time advancement (`advanceSimulatedTime`) with explicit labeling and 5-min quiet rest jump.

### 5. Implement Preparation and Clinical Timeline ✓

The procedure separates into a sequential physical pipeline, pre-established environmental setup, and on-demand lateral communication:
- [x] **Sequential Physical Pipeline:**
  - Hand hygiene moments (steps 1, 4, 8, 25).
  - Stethoscope disinfection and tray preparation (steps 2, 3).
  - Eye-level manometer alignment (step 13).
  - Systolic palpatory estimation and 1-minute interval (step 14).
  - Auscultation setup, inflation, deflation, and Korotkoff sounds (steps 15–22).
  - Cuff removal and nursing chart documentation (steps 24, 26).
- [x] **Pre-established Setup (Steps 9–12):**
  - Seated posture (step 10) pre-established on treatment chair (uncrossed legs, feet on floor, arm at heart level).
  - Sizing selection (step 9), artery alignment (step 11), and cuff fitting (step 12) pre-established on patient's arm via `fitted-cuff-sleeve` and auto-satisfied after step 8.
- [x] **Lateral Communication (Steps 5, 6, 7, 23):**
  - Available anytime via lateral icon. Evaluated on clinical timing (e.g. identity before touch; anamnese before cuff inflation; results after auscultation).

**Delivered:** Integrated in `SimulationController.ts` (decoupledFlow mode), `App.ts`, and `InteractionManager.ts`.

### 6. Implement Measurement Mechanics and Audio (Current Priority / In Progress)

Implement steps 14–22 with interactive visual and auditory auscultatory mechanics:
- [ ] **Aneroid Gauge Needle Animation:** Animate the dial needle on the sphygmomanometer gauge face proportional to current cuff pressure (0–300 mmHg) during rapid inflation (+10 mmHg increments) and controlled deflation (2 mmHg/s).
- [ ] **Korotkoff Sounds Synthesizer (Web Audio API):**
  - Synthesize rhythmic acoustic Korotkoff pulses synchronized with patient heart rate (~72 bpm, ~833 ms interval) and current cuff pressure:
    - Phase I (Systolic): Clear, repetitive tapping sounds appearing at systolic pressure.
    - Phase II/III: Murmurs / swishing softening and intensifying.
    - Phase IV: Distinct muffling of sounds (4–5 mmHg above phase V).
    - Phase V (Diastolic): Complete cessation/disappearance of sounds (or persistent muffling to zero in persistent sounds branch).
  - Gate audio playback to active auscultation (stethoscope earpieces placed and chestpiece on cubital fossa).
- [ ] **Stethoscope Manipulation & Cubital Placement:** Visual chestpiece positioning onto the cubital fossa proxy during auscultation.
- [ ] **Bilateral Assessment Orchestration (Future extension):** Orchestrate first assessment on both arms with minimum one-minute interval between measurements and reference-arm comparison.

**Acceptance:** gauge needle and synthesized Korotkoff sounds remain synchronized with scenario pressure values and deflation rate.

### 7. Implement Completion and Formative Debrief ✓

Implement steps 24–26, cuff removal, nursing documentation, and the comprehensive session debriefing report:
- [x] **Physical Technique Assessment:** Scores deflation velocity (2 mmHg/s), inflation increment (20–30 mmHg above estimate), stethoscope placement, repeated hygiene moments (steps 1, 4, 8, 25), and precise nursing record documentation.
- [x] **Communication Timing & Omission Report:**
  - Evaluates whether patient identification (Passo 5) was performed before physical procedure.
  - Evaluates whether anamnese (Passo 6) and 5-min quiet rest (Passo 7) were conducted prior to inflation.
  - Evaluates whether measured values were communicated to the patient (Passo 23).
  - Highlights skipped questions, delayed communication, and improper timing with constructive educational feedback in Portuguese.
- [x] **Formative Debriefing UI:** Glassmorphic debriefing card on desktop HUD and in-headset WebXR 3D slate rendering at procedure conclusion (Passo 26).
- [x] Supporting Table 2 included for office measurement reference in adults aged 18 or over.

**Delivered:** Formative debriefing engine and UI delivered in `SimulationController.ts`, `InteractionManager.ts`, and `style.css`.

### 8. Validate the Full Scenario

Run `npx tsc --noEmit` and `npm run build`. Manually test menu navigation, scene loading, both hands, object ownership, tracking recovery, cues, timers, cuff placement, pressure/audio synchronization, the conditional branch on either arm, bilateral interval enforcement, reference-arm selection, and restart on compatible XR hardware. Record browser/device and untested behavior. When implementing the progression controller, add focused automated tests for prerequisites, timers, branching, and reset; the repository now uses Node's built-in test runner via `npm test`, plus `npm run simulation:mock` for all single-arm fixtures. Extend these for bilateral orchestration when implemented.

Compare each implemented step with the supplied PDF and review clinical content with the project’s subject-matter reviewer before treating the scenario as validated teaching material.

## Checklist-to-Simulation Mapping

The following summarizes the supplied PDF in English for implementation, incorporating the 2026 architectural simplifications and decoupled lateral dialogue flow.

| PDF step | Step Description | Flow Type / Execution Mode | Required Simulation Action or Condition |
| --- | --- | --- | --- |
| 1 | Hand hygiene | Physical (Sequential) | Perform hand hygiene at the dispenser or sink. |
| 2 | Stethoscope disinfection | Physical (Sequential) | Disinfect bell/diaphragm and earpieces with cotton and 70% alcohol. |
| 3 | Material preparation | Physical (Sequential) | Gather required materials on the tray. |
| 4 | Hand hygiene | Physical (Sequential) | Perform hand hygiene again before approaching patient. |
| 5 | Patient identification | Communication (Lateral Icon) | On-demand via lateral icon (expected before touching patient). Patient confirms identity automatically. |
| 6 | Anamnese / Readiness | Communication (Lateral Icon) | On-demand via lateral icon (expected before measurement). Patient confirms empty bladder, ≥90 min exercise, ≥30 min intake. |
| 7 | Explanation & quiet rest | Communication & Rest (Lateral Icon) | On-demand via lateral icon (expected before measurement). Explains procedure, requests silence, advances 5-min quiet rest. |
| 8 | Hand hygiene | Physical (Sequential) | Perform hand hygiene before measuring. |
| 9 | Midpoint & cuff selection | Pre-established Setup | Pre-configured in 3D scene (cuff correctly sized from Table 1 and pre-fitted on arm). |
| 10 | Patient positioning | Pre-established Setup | Pre-configured in 3D scene (seated, feet supported, back rested, arm supported at heart level). |
| 11 | Artery palpation & bladder | Pre-established Setup | Pre-configured in 3D scene (bladder centered over brachial artery). |
| 12 | Cuff fitting | Pre-established Setup | Pre-configured in 3D scene (cuff snug, 2–3 cm above cubital fossa). |
| 13 | Eye-level manometer alignment | Physical (Sequential) | Align eye level with the aneroid gauge face. |
| 14 | Radial systolic estimation | Physical (Sequential) | Palpate radial pulse, inflate until disappearance, deflate, note systolic estimate, release air, and wait 1 min. |
| 15 | Stethoscope earpieces | Physical (Sequential) | Place stethoscope earpieces in ears. |
| 16 | Chestpiece placement | Physical (Sequential) | Palpate brachial artery in cubital fossa and place bell or diaphragm without excessive pressure. |
| 17 | Auscultatory inflation | Physical (Sequential) | Inflate rapidly in 10 mmHg increments to 20–30 mmHg above systolic estimate. |
| 18 | Controlled deflation | Physical (Sequential) | Deflate at 2 mmHg/second. |
| 19 | Systolic identification | Physical (Sequential) | Identify systolic pressure at first Korotkoff sound (phase I) with regular beats. |
| 20 | Diastolic identification | Physical (Sequential) | Identify diastolic pressure at disappearance of sounds (phase V). |
| 21 | Confirmation & air release | Physical (Sequential) | Auscultate for another 20–30 mmHg to confirm disappearance, then release remaining air. |
| 22 | Persistent sounds (Branch) | Physical (Conditional) | If sounds persist to zero, record muffling as diastolic and document systolic/diastolic/zero. |
| 23 | Inform patient | Communication (Lateral Icon) | On-demand via lateral icon (expected after auscultation). Informs measured values to patient. |
| 24 | Cuff removal | Physical (Sequential) | Remove the cuff from the patient's arm. |
| 25 | Final hand hygiene | Physical (Sequential) | Perform hand hygiene after concluding patient care. |
| 26 | Procedure documentation | Physical (Sequential) | Document exact readings, arm, position, date/time, and professional ID in nursing chart. |

The PDF also lists the five moments of hand hygiene and cuff bladder sizing guidance (40% of arm circumference for width and at least 80% for length). Preserve these as supporting learning content. Do not silently replace the supplied checklist with additional procedures or different thresholds; record any agreed content revisions explicitly.

## 2026 Checklist Migration and Supporting Tables

The active source is `references/checklist_v2.pdf`. The bilateral first-assessment instruction is an observation after item 26, not a replacement for the persistent-sounds branch.

| Changed source requirement | Implementation impact / status |
| --- | --- |
| Item 5: identifiers follow institutional policy | Prompts retain name/date of birth as the supplied examples and mention the policy. |
| Item 6: exercise/walking/physiotherapy interval 60 → 90 minutes | Updated engine threshold, Portuguese prompt, mocks, and boundary tests. Intake/smoking remains 30 minutes. |
| Item 14: 15–30 seconds → one minute after estimation | Engine now requires at least 60 seconds after full deflation; removed the former upper bound and restart-on-expiry policy. |
| Item 15: forward-curvature wording removed | Updated prompts; no invented orientation scoring criterion. |
| Item 16: bell or diaphragm | Both choices are accepted explicitly; the placement event is now `chestpiece-placed` with value `bell` or `diaphragm`. Stable checklist step ID `place-bell` is retained for compatibility. |
| Table 1: revised ranges and all bladder dimensions; added Coxa | Updated seven-entry data table and cuff-boundary tests. The former 21 cm overlap case now accepts only Infantil. |
| Observation after item 26: first assessment on both arms, ≥1 minute between measurements, higher-pressure reference arm | Added to the plan, supporting content, and timing parameters. Bilateral session orchestration, fixtures, reference selection, and UI remain pending; current mocks are single-arm measurements. |
| Table 2: office BP classification from age 18 | Literal supporting data added. Automated interpretation remains pending source clarification. |

### Table 1 — Current Cuff Asset and Selection Specification

Dimensions below describe the **inflatable bladder**, not the outer fabric sleeve. Use them for model proportions and labels, while sizing the complete cuff separately.

| Label | Arm circumference (cm) | Bladder width (cm) | Bladder length (cm) |
| --- | --- | --- | --- |
| Recém-nascido | ≤6 | 3 | 6 |
| Criança | 6–15 | 5 | 15 |
| Infantil | 16–21 | 8 | 21 |
| Adulto pequeno | 22–26 | 10 | 24 |
| Adulto | 27–34 | 13 | 30 |
| Adulto grande | 35–44 | 16 | 38 |
| Coxa | 45–52 | 20 | 42 |

**Explicit implementation policy:** accept both table-listed options at exactly 6 cm. Do not interpolate across unlisted fractional gaps (for example, 15.5 or 26.5 cm), silently extend the ranges, or override them using the 40%/80% supporting guidance. Reject unsupported circumferences in fixtures. These source-table limitations remain subject to content review.

### Table 2 — Literal Supporting Transcription

Applies to office measurements from age 18; values are in mmHg.

| Classification | Systolic | Logical wording | Diastolic |
| --- | --- | --- | --- |
| PA normal | <120 | e | <80 |
| Pré-hipertensão | 120–139 | e/ou | 80–89 |
| HA Estágio 1 | 140–159 | e/ou | 90–99 |
| HA Estágio 2 | 160–179 | e/ou | 100–109 |
| HA Estágio 3 | ≥180 | e/ou | 110 (comparison sign absent in source) |

**Source clarification required:** the stage-3 diastolic entry visibly prints `110` without a comparator. Preserve this fact; do not silently turn it into an automatic threshold. Confirm this and how mixed systolic/diastolic categories should be presented before implementing classification feedback.
