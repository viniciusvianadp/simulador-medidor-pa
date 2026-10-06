# Blood Pressure Simulator Implementation Plan

## Objective and Scope

Create **“Simulador de medição de pressão arterial”**, a Portuguese-language WebXR simulator. The initial scenario is blood pressure measurement using the **auscultatory method**, with a seated patient and multiple guided steps. Menus, instructions, dialogue, feedback, and results must be in Portuguese; development documentation may remain in English.

This document is a proposed implementation roadmap and progress tracker. The current repository provides:
- A fully enclosed 3D doctor's office room imported from [`doctors_office.glb`](../assets/Models/doctors_office.glb) with 4 complete walls, floor collision, and clinical lighting.
- Dedicated clinical examination and treatment chair ([`hospital_examination_and_treatment_chair.glb`](../assets/Models/hospital_examination_and_treatment_chair.glb)) installed in place of the generic couch, featuring heart-level armrests and forearm proxies.
- 3D instruments placed on the consultation desk / stainless steel tray: aneroid sphygmomanometer ([`sphygmomanometer_low_poly.glb`](../assets/Models/sphygmomanometer_low_poly.glb)), rigged stethoscope ([`rigged_stethoscope.glb`](../assets/Models/rigged_stethoscope.glb)), and hand sanitizer pump ([`hand_sanitizer.glb`](../assets/Models/hand_sanitizer.glb)).
- First-person walking controls with collision detection (`W, A, S, D` / arrows) and 5 quick station shortcuts (`1` Overview, `2` Hygiene/Sink, `3` Clipboard/Record, `4` Doctor's Desk / Instrument Tray, `5` Patient Examination Chair).
- WebXR Default Experience (`src/scripts/xr.ts`) with thumbstick locomotion, teleportation snap points, hand tracking, and compatibility with the Immersive Web Emulator and VR headsets.
- A responsive Portuguese start menu with scenario configuration and patient selection (`src/ui/StartMenu.ts`).
- A verified 26-step single-arm auscultatory simulation engine (`src/simulation/`) with 31 unit tests and automated browser integration tests.
- Step guidance HUD is temporarily decoupled during 3D room navigation testing. The bilateral first-assessment workflow and detailed instrument interaction models remain pending.

## Reference Files and Visual Direction

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

Build this stage as small visual work packages in Babylon.js Editor. Stage 3.1 is complete and 3.2 has a generated desktop blockout; detailed asset packages remain pending. Each package should produce editable assets, a matching runtime export in `public/scene/` when integrated, and a screenshot from the learner's viewing position. Keep interaction logic, guidance UI, clinical validation, and measurement audio in stages 4–6; this stage prepares their visual assets and attachment points.

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
- [x] Hide generic examination bed (`Bed_blinn1_0.setEnabled(false)`) and replace it with dedicated clinical examination chair ([`hospital_examination_and_treatment_chair.glb`](../assets/Models/hospital_examination_and_treatment_chair.glb)) positioned at `[-1.30, 0, -1.30]` with 90° rotation.
- [x] Armrests positioned at heart level (`Y = 0.95`), aligning `patient-forearm-esquerdo` and `patient-forearm-direito` logical proxies for clinical guidelines compliance.
- [x] Consultation desk equipped with a metallic PBR tray (`tray`) at `[-1.90, 0.725, -1.0]` as the staging surface for medical instruments.
- [x] Station navigation updated with station `5` (`cadeira` at `[-0.75, 1.35, -1.30]`, facing `[-1.30, 0.95, -1.30]`) and WebXR teleportation snap points.

**Delivered:** clinical examination chair and instrument tray fully integrated in `src/App.ts`, providing the required ergonomic support, reach zones, and viewing angles for blood pressure measurement.

#### 3.5. Create the Patient and Required Pose Variants

**Depends on:** 3.4.

- [ ] Create a fictional, consistently styled patient with both measurement arms accessible and clear elbow/wrist anatomy.
- [ ] Prepare a rig or explicit pose variants for the hand at waist height with elbow flexed, the arm extended alongside the body, and the supported measurement pose with palm upward and elbow slightly flexed.
- [ ] Provide anchors for the acromion, olecranon, upper-arm midpoint, brachial/cubital region, and radial pulse location on each arm. These support later targeting; permanent visible anatomy markers are not required.
- [ ] Check uncrossed legs, feet on the floor, back support, and room for the cuff and stethoscope in the measurement pose.

**Deliverable / acceptance:** each required pose can be previewed manually, fits the furniture, and leaves measurement landmarks accessible. Runtime posture selection belongs to stage 5.

#### 3.6. Create the Hygiene and Preparation Assets (In Progress)

**Depends on:** 3.2 and 3.4.

- [x] Soap dispenser (`Soap_blinn1_0`) and glove box dispenser integrated on the counter wall.
- [x] Integrate dedicated hand sanitizer pump model ([`assets/Models/hand_sanitizer.glb`](../assets/Models/hand_sanitizer.glb)) positioned on the consultation desk next to the tray (`[-2.15, 0.725, -0.65]`).
- [ ] Add 70% alcohol container and cotton for stethoscope disinfection (checklist step 2).
- [ ] Add legible Portuguese labels where needed, including “Álcool 70%”. Distinguish instrument disinfectant from the hand-hygiene station.

**Deliverable / acceptance:** each preparation item is visually recognizable, correctly scaled, and available as an independent asset. Hygiene and disinfection completion logic remains in later stages.

#### 3.7. Create the Sphygmomanometer and Cuff Set (In Progress)

**Depends on:** 3.4 and 3.5.

- [x] Low-poly aneroid sphygmomanometer model loaded on the consultation desk tray (`sphygmo-root` at `[-1.90, 0.735, -0.85]`, using [`assets/Models/sphygmomanometer_low_poly.glb`](../assets/Models/sphygmomanometer_low_poly.glb)).
- [ ] **Chair auxiliary tray cleanup (Remove drugs and syringes)**: The clinical examination chair model (`hospital_examination_and_treatment_chair.glb`) includes built-in procedural props on its attached side tray (syringes, drug bottles/vials, medicine containers: meshes `chair_Object_2`, `chair_Object_3`, `chair_Object_4`, and `chair_Object_10` through `chair_Object_22`). Because this simulation strictly evaluates blood pressure measurement, these unrelated medication and syringe meshes must be removed or disabled (`setEnabled(false)`).
- [ ] **Place Blood Pressure Cuffs beside the chair**: In place of the removed drugs and syringes, position the blood pressure cuff set on the auxiliary table / tray beside the patient chair. The cuffs must be readily accessible for arm circumference sizing and selection according to 2026 Table 1 (Recém-nascido, Criança, Infantil, Adulto pequeno, Adulto, Adulto grande, Coxa).
- [ ] Build/verify the aneroid gauge, separate needle, inflation bulb, valve, and connecting tubes. Give the needle and valve usable pivots for later animation.
- [ ] Create an accurate, readable gauge face with units and controlled numeric markings; verify it at the intended viewing distance.
- [ ] Create all seven cuff size variants from the 2026 Table 1 below (including “Coxa”), matching `clinicalParameters.ts`, with readable size labels and alignment markings.
- [ ] Prepare loose and fitted cuff representations, attachment anchors, and a tube arrangement that fits the patient without obvious clipping.

**Deliverable / acceptance:** the gauge is legible, each cuff variant is distinguishable, and fitted cuffs can be previewed on the patient. Pressure behavior and inflation/deflation remain in stage 6.

#### 3.8. Create the Stethoscope and Measuring Tape (In Progress)

**Depends on:** 3.5 and 3.6.

- [x] Rigged stethoscope model loaded on the consultation desk tray (`stethoscope-root` at `[-1.90, 0.735, -1.12]`, using [`assets/Models/rigged_stethoscope.glb`](../assets/Models/rigged_stethoscope.glb)).
- [ ] Set up tray and auscultation arrangements, with anchors for bell or diaphragm placement at either cubital region and provision for later earpiece placement.
- [ ] Build the measuring tape with legible centimeter markings and loose/wrapped representations that fit the upper arm at its midpoint.

**Deliverable / acceptance:** both instruments can be previewed in their storage and clinical positions without obscuring important anatomy. Grabbing, circumference validation, and audio belong to later stages.

#### 3.9. Integrate Assets and Map Interaction Targets ✓

**Depends on:** 3.3–3.8.

- [x] Map stable scene roots/anchors to scenario targets: `hygiene-station` (`Soap_blinn1_0`), `record` (`Clipboard_blinn1_0`), `table` (`Table_blinn1_0`), `tray`, `treatment-chair-root`, `sphygmo-root`, `stethoscope-root`, `sanitizer-root`, `patient-forearm-esquerdo`, `patient-forearm-direito`.
- [x] Implement smooth keyboard navigation (`W, A, S, D` + arrows) and station hotkeys (`1` Overview, `2` Hygiene, `3` Record, `4` Desk/Tray, `5` Patient Chair).
- [x] Initialize WebXR Default Experience (`src/scripts/xr.ts`) with thumbstick smooth locomotion, snap turning, hand tracking, and teleport snap points for all 5 stations.
- [x] Zero-vertex mesh compliance enforced via modular `_loadModel()` helper disposing intermediate `__root__` meshes to pass headless browser validation.

**Deliverable / acceptance:** the exported scene loads through the existing application, all physical scenario targets resolve through the documented mapping, and initial placements are reproducible.

#### 3.10. Review Visual Quality and XR Readiness ✓

**Depends on:** 3.9.

- [x] Check scene loading, resizing, console errors, scale, clipping, lighting, and room enclosure.
- [x] Verify WebXR headset emulation via the Immersive Web Emulator extension and native XR runtime compatibility.
- [x] Verified through `tests/menu.browser.mjs`, unit test suite (`npm test`), and type checking (`npx tsc --noEmit`).
- [x] Development server running live on port 3000 (`http://localhost:3000`).

**Deliverable / acceptance:** reviewable, fully enclosed 3D doctor's office scene with functioning locomotion, 5-station navigation, realistic examination chair, 3D instruments, and WebXR headset integration, ready for chair side prop cleanup, stage 4 instrument interaction, and patient setup.

#### 3.11. Current Milestone Status & Roadmap Summary

- **Current State (Finished At):**
  - Clinical room enclosure complete (4 walls, baseboard trim, zero skybox bleed).
  - Dedicated treatment chair integrated at `[-1.30, 0, -1.30]` with heart-level armrests (`Y = 0.95`).
  - Consultation desk equipped with stainless steel tray and 3D instruments: aneroid sphygmomanometer, rigged stethoscope, and hand sanitizer pump.
  - 5-station rapid keyboard navigation (`1`–`5`) and WebXR teleport snap points.
  - 31 unit tests and end-to-end browser tests passing.
  - Development server active on `http://localhost:3000`.
- **Immediate Next Task (Chair Auxiliary Tray Items):**
  - Clean up the side tray attached to the examination chair: remove/hide procedural syringes and medication vials/bottles (`chair_Object_2`, `chair_Object_3`, `chair_Object_4`, `chair_Object_10`–`chair_Object_22`).
  - Position blood pressure cuff set (interchangeable sizes per 2026 Table 1) on the auxiliary tray/cart beside the chair.
- **Subsequent Stages:**
  - **Stage 4 & 5 (Interactive Steps):** Connect 3D click/pinch interaction events to checklist steps 1–5 (hand hygiene, stethoscope disinfection, gathering materials, identity confirmation) with Portuguese HUD guidance.
  - **Stage 3.5 (Patient Character):** Seat the 3D patient model on the chair in the compliant posture (uncrossed legs, supported back, arm supported at heart level).

**Suggested work order:** 3.1 → 3.2 → room shell (3.3) and furniture (3.4) → chair accessories & cuffs cleanup (3.7) → patient (3.5) and preparation props (3.6) → measurement instruments (3.7–3.8) → integration (3.9) → review (3.10). Produce and inspect one asset package at a time to keep visual revisions manageable; 3.3 can proceed independently of the furniture/patient work after the blockout is settled.

**Acceptance:** instruments are reachable, the patient can assume the required posture, and the gauge is legible at the intended viewing position.

### 4. Implement Hands and Step Guidance

Adapt the existing hand-tracking and pinch prototype for selecting, picking up, placing, and releasing instruments. Use simplified visible hands inspired by the reference. Define valid placement zones, prevent simultaneous ownership of an instrument, and recover cleanly from tracking loss. Add a current-step panel and a target arrow; completion should follow validated interactions. Use dialogue choices for verbal actions and explicit representations for actions without a practical tracked gesture.

**Acceptance:** the first hygiene step can be completed with hands, the cue advances correctly, and an unrelated action does not advance progress.

### 5. Implement Preparation and Patient Setup

Implement checklist steps 1–13 from the mapping below: hygiene, equipment preparation, two identity checks according to institutional policy, readiness dialogue (90 minutes without exercise/walking/physiotherapy; 30 minutes without the listed intake/smoking), at least five minutes of rest, arm measurement, cuff selection, patient positioning, and gauge alignment. Make waiting periods explicit; any accelerated development mode must label simulated time. Use the PDF's cuff table as scenario data and define a selection policy for overlapping ranges rather than silently choosing one.

**Acceptance:** prerequisites and the 2026 cuff table affect progression, repeated hygiene actions remain independently required, and arm preparation/selection applies to the active side during a first assessment.

### 6. Implement Measurement Mechanics and Audio

Implement steps 14–22 with a shared simulation state for cuff pressure, inflation, valve-controlled deflation, pulse cues, and Korotkoff sounds. Synchronize gauge readings and audio with scenario pressure values. Let learners identify and record systolic and diastolic readings. Include the branch for sounds persisting to zero and the required confirmation after sounds disappear. After full deflation for the palpatory estimate, require at least one minute before the auscultatory measurement, with no maximum wait invented. Accept either the bell or diaphragm at the cubital region.

For a first assessment, measure both arms with a minimum one-minute interval between measurements. Keep this timer distinct from the post-estimation wait. Track readings and sound-persistence branches per arm; implement an explicit switch of arm with circumference/cuff/position checks and a new estimate. Document the precise timer start/end events and repeated preparation actions as an implementation policy for subject-matter review; the PDF gives the interval but does not spell out the repetition loop.

**Acceptance:** learners can complete ordinary and persistent-sound measurements on either arm; first-assessment completion requires both arms and enforces the interval; audio and gauge readings remain synchronized at different frame rates.

### 7. Implement Completion and Debrief

Implement steps 23–26: communicate results, remove the cuff, repeat hygiene, and document the measurement. Provide Portuguese feedback on completed steps, incorrect attempts, and recorded readings. The documentation form should capture the PDF example's date/time, arm, patient position, exact pressure values, and professional identification using fictional data. For a first assessment, retain both arm records, compare values, and record the higher-pressure reference arm for subsequent measurements. The PDF does not specify tie handling or how to choose when systolic and diastolic comparisons favor different arms; obtain an explicit policy before automatically scoring those cases.

Include Table 2 as supporting learning content for office measurements in adults aged 18 or over. Preserve its literal transcription and flag the missing comparison sign in the stage-3 diastolic cell; defer automatic classification/scoring until clarified. The table is supporting content, not an added mandatory 27th checklist step.

**Acceptance:** completion requires final documentation (both records and reference-arm selection for a first assessment), and restarting clears both arms, timers, and the previous reference selection.

### 8. Validate the Full Scenario

Run `npx tsc --noEmit` and `npm run build`. Manually test menu navigation, scene loading, both hands, object ownership, tracking recovery, cues, timers, cuff placement, pressure/audio synchronization, the conditional branch on either arm, bilateral interval enforcement, reference-arm selection, and restart on compatible XR hardware. Record browser/device and untested behavior. When implementing the progression controller, add focused automated tests for prerequisites, timers, branching, and reset; the repository now uses Node's built-in test runner via `npm test`, plus `npm run simulation:mock` for all single-arm fixtures. Extend these for bilateral orchestration when implemented.

Compare each implemented step with the supplied PDF and review clinical content with the project’s subject-matter reviewer before treating the scenario as validated teaching material.

## Checklist-to-Simulation Mapping

The following summarizes the supplied PDF in English for implementation. Numeric values and ordering are retained from that source; consult the PDF for its full wording and illustrations/table.

| PDF step | Required simulation action or condition |
| --- | --- |
| 1 | Perform hand hygiene. |
| 2 | Disinfect stethoscope bell/diaphragm and earpieces with cotton and 70% alcohol. |
| 3 | Gather the required materials on the tray. |
| 4 | Perform hand hygiene again. |
| 5 | Introduce oneself and confirm two patient identifiers, such as name and date of birth, according to institutional policy. |
| 6 | Check bladder status, absence of exercise/walking/physiotherapy in the preceding 90 minutes, and absence of alcohol, coffee, food, or smoking in the preceding 30 minutes. |
| 7 | Explain the procedure, provide at least 5 minutes of quiet rest, and instruct the patient not to talk during measurement. Handle questions before or after measurement. |
| 8 | Perform hand hygiene. |
| 9 | Locate the midpoint between acromion and olecranon with the bare arm flexed and hand at waist height; then extend the arm alongside the body, measure circumference at that midpoint, and select a cuff using PDF Table 1. |
| 10 | Seat the patient with uncrossed legs, feet on the floor, supported and relaxed back, and bare supported arm at heart level (PDF: between third and fifth intercostal spaces), palm upward and elbow slightly flexed. |
| 11 | Palpate the brachial artery and align the middle of the cuff bladder over it. |
| 12 | Fit the cuff without gaps, 2–3 cm above the cubital fossa. |
| 13 | Align eye level with the aneroid gauge. |
| 14 | Palpate the radial pulse; inflate until it disappears, slowly deflate, record the pressure at reappearance as the systolic estimate, fully deflate, and wait one minute (implemented as a minimum; the source gives no upper bound). |
| 15 | Place the stethoscope earpieces in the ears. The revised item no longer specifies forward curvature. |
| 16 | Palpate the brachial artery in the cubital fossa and place the bell or diaphragm without excessive compression. |
| 17 | Inflate rapidly in 10 mmHg increments to 20–30 mmHg above the prior systolic estimate. |
| 18 | Deflate at 2 mmHg/second. |
| 19 | Identify systolic pressure at the first Korotkoff sound (phase I), followed by regular beats. |
| 20 | Identify diastolic pressure when sounds disappear (phase V). |
| 21 | Continue listening for another 20–30 mmHg to confirm disappearance, then release all remaining air. |
| 22 | Conditional branch: if sounds persist to zero, use sound muffling for diastolic pressure and record systolic/diastolic/zero. Evaluate this during deflation, not as an obligatory second measurement after step 21. |
| 23 | Inform the patient of the measured values. |
| 24 | Remove the cuff. |
| 25 | Perform hand hygiene. |
| 26 | Mark the procedure as performed and record exact pressure values without rounding in the simulated nursing record. |

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
