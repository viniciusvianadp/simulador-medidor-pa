# Blood Pressure Simulator Implementation Plan

## Objective and Scope

Create **“Simulador de medição de pressão arterial”**, a Portuguese-language WebXR simulator. The initial scenario is blood pressure measurement using the **auscultatory method**, with a seated patient and multiple guided steps. Menus, instructions, dialogue, feedback, and results must be in Portuguese; development documentation may remain in English.

This document is a proposed implementation roadmap and progress tracker. The current repository provides:
- A fully enclosed 3D doctor's office room imported from [`doctors_office.glb`](../assets/Models/doctors_office.glb) with 4 complete walls, floor collision, and clinical lighting.
- Dedicated clinical examination and treatment chair ([`hospital_examination_and_treatment_chair.glb`](../assets/Models/hospital_examination_and_treatment_chair.glb)) installed in place of the generic couch, with provisional forearm proxies; anatomical fit awaits the patient model.
- 3D instruments placed on the consultation desk / stainless steel tray: aneroid sphygmomanometer ([`sphygmomanometer_low_poly.glb`](../assets/Models/sphygmomanometer_low_poly.glb)), rigged stethoscope ([`rigged_stethoscope.glb`](../assets/Models/rigged_stethoscope.glb)), and hand sanitizer pump ([`hand_sanitizer.glb`](../assets/Models/hand_sanitizer.glb)).
- First-person walking controls with collision detection (`W, A, S, D` / arrows) and 5 quick station shortcuts (`1` Overview, `2` Hygiene/Sink, `3` Clipboard/Record, `4` Doctor's Desk / Instrument Tray, `5` Patient Examination Chair).
- WebXR Default Experience (`src/scripts/xr.ts`) with thumbstick locomotion, teleportation snap points, hand tracking, and compatibility with the Immersive Web Emulator and VR headsets.
- A responsive Portuguese start menu with scenario configuration and patient selection (`src/ui/StartMenu.ts`).
- A verified 26-step single-arm auscultatory simulation engine (`src/simulation/`) with 31 unit tests and automated browser integration tests.
- `src/interaction/InteractionManager.ts` is an inactive interaction/HUD prototype: neither `App` nor the XR script instantiates it. It requires the stage-4 corrections below before integration. The bilateral first-assessment workflow and detailed instrument interaction models remain pending.
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
- [ ] Prepare arm pose variants and anatomical anchors for circumference measurement, cuff fitting, and pulse/stethoscope placement.
- [x] Check uncrossed legs, feet on the floor/footrest, back support, and room for the cuff and stethoscope in the measurement pose.

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
- [x] **Place Blood Pressure Cuffs beside the chair**: In place of the removed drugs and syringes, position the blood pressure cuff set on the auxiliary table / tray beside the patient chair. The cuffs must be readily accessible for arm circumference sizing and selection according to 2026 Table 1 (Recém-nascido, Criança, Infantil, Adulto pequeno, Adulto, Adulto grande, Coxa).
- [ ] Build/verify the aneroid gauge, separate needle, inflation bulb, valve, and connecting tubes. Give the needle and valve usable pivots for later animation.
- [ ] Create an accurate, readable gauge face with units and controlled numeric markings; verify it at the intended viewing distance.
- [x] Create all seven folded storage cuff variants from Table 1 (including “Coxa”), matching `clinicalParameters.ts`, with readable Portuguese size/range tags. Assets and generation details: [`assets/Models/cuffs/README.md`](../assets/Models/cuffs/README.md).
- [ ] Add fitted-cuff artery alignment markings and attachment geometry after patient integration.
- [ ] Prepare loose and fitted cuff representations, attachment anchors, and a tube arrangement that fits the patient without obvious clipping.

**Deliverable / acceptance:** the gauge is legible, each cuff variant is distinguishable, and fitted cuffs can be previewed on the patient. Pressure behavior and inflation/deflation remain in stage 6.

#### 3.8. Create the Stethoscope and Measuring Tape (In Progress)

**Depends on:** 3.5 and 3.6.

- [x] Rigged stethoscope model loaded on the consultation desk tray (`stethoscope-root` at surface center `[-2.04, ~0.998, -1.17]`, using [`assets/Models/rigged_stethoscope.glb`](../assets/Models/rigged_stethoscope.glb)).
- [ ] Set up tray and auscultation arrangements, with anchors for bell or diaphragm placement at either cubital region and provision for later earpiece placement.
- [ ] Build the measuring tape with legible centimeter markings and loose/wrapped representations that fit the upper arm at its midpoint.

**Deliverable / acceptance:** both instruments can be previewed in their storage and clinical positions without obscuring important anatomy. Grabbing, circumference validation, and audio belong to later stages.

#### 3.9. Integrate Assets and Map Interaction Targets (Partial — Current Room Only)

**Depends on:** 3.3–3.8.

- [x] Map stable scene roots/anchors to scenario targets: `hygiene-station` (`Soap_blinn1_0`), `record` (`Clipboard_blinn1_0`), `table` (`Table_blinn1_0`), `tray`, `treatment-chair-root`, `sphygmo-root`, `stethoscope-root`, `sanitizer-root`, `patient-forearm-esquerdo`, `patient-forearm-direito`.
- [x] Implement smooth keyboard navigation (`W, A, S, D` + arrows) and station hotkeys (`1` Overview, `2` Hygiene, `3` Record, `4` Desk/Tray, `5` Patient Chair).
- [x] Initialize WebXR Default Experience (`src/scripts/xr.ts`) with thumbstick smooth locomotion, snap turning, hand tracking, and teleport snap points for all 5 stations.
- [x] Zero-vertex mesh compliance enforced via modular `_loadModel()` helper disposing intermediate `__root__` meshes to pass headless browser validation.

**Current scope:** the application loads the current GLB room and initial named roots/proxies. This does not establish complete interaction mapping: the patient, cuffs, measuring tape, and disinfectant assets remain pending, and imported mesh metadata, guidance targets, and actual world positions still require reconciliation.

- [ ] After placement corrections and remaining assets, verify every scenario target resolves to its actual mesh/anchor; derive guidance positions from these anchors instead of duplicated coordinates.

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

- **Current State (Finished At):**
  - Clinical room enclosure complete (4 walls, baseboard trim, zero skybox bleed).
  - Dedicated treatment chair integrated at `[-1.15, ~0.02, -1.25]` with provisional forearm proxies (`Y = 0.95`).
  - Consultation desk equipped with stainless steel tray and 3D instruments: aneroid sphygmomanometer, rigged stethoscope, and hand sanitizer pump.
  - 5-station rapid keyboard navigation (`1`–`5`) and WebXR teleport snap points.
  - Earlier plan entries report 31 unit tests and browser checks passing; rerun relevant checks for implementation changes rather than treating this as a current test result.
  - Imported props have corrected desktop placements; headset reach remains pending. Patient posture and complete instrument interactions are not implemented.
- **Task (1) — Correct Imported-Model Placement and Clean Up the Chair Tray (Implemented; Headset Review Pending):**
  - Review all models imported from `assets/Models`, especially the hand sanitizer, sphygmomanometer, stethoscope, and treatment chair, together with the procedural instrument tray. Correct position, rotation, and scale using visible geometry/world bounds and actual supporting surfaces, rather than assuming imported origins sit at the model base.
  - Ensure objects rest on their intended desk/tray/floor surfaces without floating, clipping, or unintended overlaps; keep the sanitizer pump and instruments visible and reachable from the relevant learner stations. Review chair placement against the room and reserve space for the future patient and both arms.
  - Clean up the side tray attached to the examination chair: remove/hide procedural syringes and medication vials/bottles (`chair_Object_4`–`chair_Object_6`, `chair_Object_12`–`chair_Object_24`); preserve chair structure as documented in 3.7.
  - Acceptance: inspect overview, desk, and chair views; capture screenshots; reconcile scene anchors/station views with corrected placements; run type checking and production build and check browser loading/resizing/console errors. Record hardware-dependent reach checks still outstanding.
- **Task (2) — Add the Stored Cuff Set (Implemented; Headset Review Pending):**
  - Seven separately identifiable, Portuguese-labeled folded cuffs are placed on the cleared chair tray. `assets/Models/cuffs/folded-cuff.glb` is the shared extracted mesh; `variants.json` records the seven derived definitions. `src/scene/cuffVariants.ts` derives sizes from clinical data and `src/scene/buildCuffSet.ts` instantiates them with stable IDs. Regenerate via `npm run cuffs:generate`. Fitted representations depend on the patient geometry in 3.5.
  - Desktop checks cover support contact, tray containment, non-overlap, IDs, scene loading/reset/resizing, and visual readability. Folded proportions are explicit art assumptions, not clinical sleeve measurements; physical-headset reach/readability remain pending.
- **Pending room-navigation fix — Chair collisions:** the learner can currently walk through the imported chair. Add appropriate collision geometry and verify desktop walking and XR locomotion separately in a future scene update.
- **Task (3) — Patient and Remaining Preparation/Instrument Assets:** complete 3.5–3.8 dependencies described below.
- **Task (4) — Start from the Existing InteractionManager Prototype:** review and refactor `src/interaction/InteractionManager.ts` using the stage-4 checklist before instantiating it. First deliver validated hand hygiene with a scene-bound arrow and Portuguese desktop/XR guidance, then extend to steps 2–5. Verify wrong-target rejection, one action per gesture, controller-based feedback, and restart cleanup. Keep automatic answers and synthetic waits out of the learner flow.
- **Subsequent Stages:**
  - **Stage 3.5 (Patient Character):** Create the seated patient, required pose variants, and bilateral anatomical anchors before final fitted cuff/stethoscope placement.
  - **Stage 3.6–3.8 (Remaining Assets):** Add alcohol 70%, cotton, measuring tape, fitted cuffs, and usable gauge/instrument components.
  - **Stage 4 & 5 (Interactive Steps):** Correct the inactive interaction prototype as specified below, then connect validated desktop/XR events for checklist steps 1–5 with Portuguese guidance.

**Task (1) implementation notes (2026-10-05):** `App.ts` measures the imported table top (~0.978 m), fits a 0.33 × 0.62 m tray to its footprint, and aligns instrument/bottle geometry bounds to their supporting surfaces. Existing model scales are retained after desktop inspection. Chair floor contact, orientation, station viewpoints, XR snap points, and instrument metadata are updated. Original GLBs remain unchanged; the runtime composition is in code. Forearm proxies remain provisional until the patient is built. Type checking and the existing browser integration suite passed (layout, scene loading, navigation/collision, restart/reset, resizing, and load-failure recovery); production build passed with the existing bundle-size warning. Desktop screenshots: `/tmp/xr-after-desk.png`, `/tmp/xr-after-chair.png`, `/tmp/xr-after-overview.png`. Validation uses isolated headless Google Chrome 153.0.8010.47 on Linux; no physical XR headset was available.

**Suggested work order:** 3.1 → 3.2 → room shell (3.3) and furniture (3.4) → chair accessories & cuffs cleanup (3.7) → patient (3.5) and preparation props (3.6) → measurement instruments (3.7–3.8) → integration (3.9) → review (3.10). Produce and inspect one asset package at a time to keep visual revisions manageable; 3.3 can proceed independently of the furniture/patient work after the blockout is settled.

**Acceptance:** instruments are reachable, the patient can assume the required posture, and the gauge is legible at the intended viewing position.

### 4. Implement Hands and Step Guidance

**Existing prototype and integration prerequisites:** `src/interaction/InteractionManager.ts` contains a DOM guidance card, animated 3D arrow, pointer picking, mesh-name target resolution, and a switch that dispatches events for the active checklist step. It is not instantiated by the running app and is not connected to XR pinch input. Its presence does not mean stage 4 is implemented.

- [ ] Replace automatic answer submission with actual learner actions/dialogue/input and instrument state. The prototype currently supplies identity, cuff choice, pressure readings, disinfection, and material-gathering results on behalf of the learner. Keep any mock automation explicitly separate from assessed interaction.
- [ ] Implement elapsed-time handling; immediate dispatch of rest/wait completion with numeric durations is not a timer. Any accelerated mode must explicitly label simulated time.
- [ ] Use controller dispatch results and refreshed state to decide success feedback and progression; current handlers display success without checking acceptance.
- [ ] Resolve arrows and input targets through actual scene anchors/metadata after task (1). Existing hard-coded patient/instrument positions reflect an older layout, and name fallback omits imported sanitizer/sphygmomanometer prefixes. Remove stale station assumptions and support the active arm.
- [ ] Reuse canonical scenario prompts/labels. The prototype still asks for forward-facing earpieces and offers only bell placement despite the revised checklist wording and bell/diaphragm support in the engine.
- [ ] Prevent duplicate actions from handling both pointer-down and pointer-pick for one gesture. Connect desktop and XR input to the same validated action path with exclusive ownership, release, and tracking-loss handling.
- [ ] Integrate initialization after the simulation is ready, state refresh after accepted actions, and cleanup on restart/menu return, including observers and pending feedback timers. Provide guidance visible inside immersive XR; the existing DOM card alone is not sufficient.

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
