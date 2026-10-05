# Blood Pressure Simulator Implementation Plan

## Objective and Scope

Create **“Simulador de medição de pressão arterial”**, a Portuguese-language WebXR simulator. The initial scenario is blood pressure measurement using the **auscultatory method**, with a seated patient and multiple guided steps. Menus, instructions, dialogue, feedback, and results must be in Portuguese; development documentation may remain in English.

This document is a proposed implementation roadmap, not a description of completed functionality. The current repository provides a Babylon.js scene, Havok physics, hand tracking, a pinch-controlled box, a Portuguese start menu, and a tested single-arm scenario engine. The bilateral first-assessment workflow described below is still pending.

## Reference Files and Visual Direction

| Local reference | Intended use | Adaptation for this project |
| --- | --- | --- |
| [Start_menu.png](Start_menu.png) | Menu hierarchy, grouped settings, translucent panels, and prominent start button. The source is another university's simulator for a different procedure. | Use our title, the scenario “Método auscultatório”, and an “Iniciar simulação” button. Introduce guidance settings only when implemented. Replace the source institution's branding and unrelated procedure text. |
| [example_hands_and_step.png](example_hands_and_step.png) | Visible, simplified hands in first person; an arrow identifies the next interaction target, shown here at a hand hygiene dispenser. | Display tracked hands and a target arrow alongside a Portuguese instruction such as “Higienize as mãos”. Move the cue as each step is completed. |
| [example_room.png](example_room.png) | General clinical-room appearance: neutral surfaces, lighting, windows, equipment, and spatial arrangement. | Place the patient in a **chair instead of a bed**, with back support and an arm support. Provide a hygiene station and instrument tray within reach. Adapt equipment and feedback to blood pressure measurement. |
| [checklist PA 2026.pdf](<checklist PA 2026.pdf>) | Current procedural source, revised 04/03/2026: steps 1–26, first-assessment note, cuff-sizing table, and adult office BP classification table. | Preserve numbered steps and conditional behavior; track the bilateral assessment note separately from the 26 numbered entries. Supersedes `check list medida da PA.pdf`. |

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

Build this stage as small visual work packages in Babylon.js Editor. All subtasks below are initially pending. Each package should produce editable assets, a matching runtime export in `public/scene/` when integrated, and a screenshot from the learner's viewing position. Keep interaction logic, guidance UI, clinical validation, and measurement audio in stages 4–6; this stage prepares their visual assets and attachment points.

#### 3.1. Define the Asset Inventory and Visual Style

- [ ] Create an asset manifest listing each model, material/texture, intended dimensions, source/license where applicable, and completion status.
- [ ] Use `example_room.png` to establish a consistent palette, simplified modeling style, lighting direction, and level of detail. Coordinate these with the existing Portuguese menu.
- [ ] Specify a shared scale (one scene unit = one meter), orientation, naming convention, and origin/pivot conventions. Record initial geometry and texture budgets for the intended XR device.
- [ ] Separate assets that need 3D geometry from optional generated bitmap textures or decorative images. Create instrument markings and labels with controlled text/vector/procedural sources so numbers and Portuguese wording remain exact.

**Deliverable / acceptance:** an inventory and short visual specification covering every asset in 3.3–3.8, with a production method for each. Generated reference images alone do not count as usable 3D assets.

#### 3.2. Block Out the Room and Reach Zones

**Depends on:** 3.1.

- [ ] Use simple placeholders for the floor, walls, chair, patient, arm support, hygiene station, and instrument surface.
- [ ] Define the learner's starting position, patient orientation, viewing height assumptions, and accessible instrument locations.
- [ ] Check sight lines to the patient arm and gauge, reach to the dispenser and tray, access to both patient arms, and clearance around the chair before producing detailed assets.

**Deliverable / acceptance:** a navigable blockout with a saved layout and dimensions; essential targets are visible and reachable from the intended interaction area. Record any reach checks that still need XR hardware.

#### 3.3. Build the Room Shell and Lighting

**Depends on:** 3.2.

- [ ] Replace room placeholders with floor, walls, door, windows, and restrained background details from the reference.
- [ ] Create reusable surface materials and a lighting setup that keeps the arm, instruments, and markings readable.
- [ ] Keep decoration outside interaction areas and avoid unnecessary geometry, oversized textures, and expensive transparency/shadows.

**Deliverable / acceptance:** a finished environment shell with consistent scale and materials, without visual obstruction of the clinical workspace.

#### 3.4. Build the Chair, Arm Support, and Instrument Surface

**Depends on:** 3.2; use the materials defined in 3.1.

- [ ] Model a chair with back support, an arm support, and a table or trolley for the tray. Use a chair instead of the reference bed.
- [ ] Size the furniture for supported feet, a relaxed supported back, and a supported arm at the required height on either side, with provision to reposition the support between arms.
- [ ] Define placement anchors for the patient, tray, arm, and gauge; provide adjustable transforms where needed for patient fitting.

**Deliverable / acceptance:** furniture fits the blockout and supports the required patient posture without intersecting the learner's workspace.

#### 3.5. Create the Patient and Required Pose Variants

**Depends on:** 3.4.

- [ ] Create a fictional, consistently styled patient with both measurement arms accessible and clear elbow/wrist anatomy.
- [ ] Prepare a rig or explicit pose variants for the hand at waist height with elbow flexed, the arm extended alongside the body, and the supported measurement pose with palm upward and elbow slightly flexed.
- [ ] Provide anchors for the acromion, olecranon, upper-arm midpoint, brachial/cubital region, and radial pulse location on each arm. These support later targeting; permanent visible anatomy markers are not required.
- [ ] Check uncrossed legs, feet on the floor, back support, and room for the cuff and stethoscope in the measurement pose.

**Deliverable / acceptance:** each required pose can be previewed manually, fits the furniture, and leaves measurement landmarks accessible. Runtime posture selection belongs to stage 5.

#### 3.6. Create the Hygiene and Preparation Assets

**Depends on:** 3.2 and 3.4.

- [ ] Build the hand-hygiene station/dispenser, tray, 70% alcohol container, and cotton/container.
- [ ] Add legible Portuguese labels where needed, including “Álcool 70%”. Distinguish instrument disinfectant from the hand-hygiene station.
- [ ] Give movable objects separate roots, sensible grasp pivots, and initial tray/storage positions; identify the dispenser's action surface.

**Deliverable / acceptance:** each preparation item is visually recognizable, correctly scaled, and available as an independent asset. Hygiene and disinfection completion logic remains in later stages.

#### 3.7. Create the Sphygmomanometer and Cuff Set

**Depends on:** 3.4 and 3.5.

- [ ] Build the aneroid gauge, separate needle, inflation bulb, valve, and connecting tubes. Give the needle and valve usable pivots for later animation.
- [ ] Create an accurate, readable gauge face with units and controlled numeric markings; verify it at the intended viewing distance.
- [ ] Create all seven cuff size variants from the 2026 Table 1 below (including “Coxa”), matching `clinicalParameters.ts`, with readable size labels and alignment markings. Do not reuse dimensions from the superseded PDF.
- [ ] Prepare loose and fitted cuff representations, attachment anchors, and a tube arrangement that fits the patient without obvious clipping.

**Deliverable / acceptance:** the gauge is legible, each cuff variant is distinguishable, and fitted cuffs can be previewed on the patient. Pressure behavior and inflation/deflation remain in stage 6.

#### 3.8. Create the Stethoscope and Measuring Tape

**Depends on:** 3.5 and 3.6.

- [ ] Build the stethoscope with identifiable earpieces, tubing, bell, and diaphragm; keep parts needed for disinfection and placement individually addressable.
- [ ] Prepare tray and auscultation arrangements, with anchors for bell or diaphragm placement at either cubital region and provision for later earpiece placement.
- [ ] Build the measuring tape with legible centimeter markings and loose/wrapped representations that fit the upper arm at its midpoint.

**Deliverable / acceptance:** both instruments can be previewed in their storage and clinical positions without obscuring important anatomy. Grabbing, circumference validation, and audio belong to later stages.

#### 3.9. Integrate Assets and Map Interaction Targets

**Depends on:** 3.3–3.8.

- [ ] Assemble the completed assets in the Editor scene and replace the corresponding placeholders.
- [ ] Map stable scene roots/anchors to the existing scenario targets: `hygiene-station`, `patient`, `patient-arm`, `patient-wrist`, `tray`, `stethoscope`, `measuring-tape`, `cuffs`, `cuff`, and `gauge`. Distinguish the cuff collection from the selected cuff instance. Keep arm/wrist anchors separately addressable by side and resolve the logical targets to the active arm.
- [ ] Record initial transforms, pose defaults, grasp pivots, placement anchors, and simple collision/picking proxies for stage 4. Keep decorative meshes out of the target mapping.
- [ ] Document that `record` is a later documentation interface target, not a required physical room prop in this stage.
- [ ] Keep editable sources under `assets/`; run `npm run generate`, review generated changes, and synchronize the runtime scene under `public/scene/`.

**Deliverable / acceptance:** the exported scene loads through the existing application, all physical scenario targets resolve through the documented mapping, and initial placements are reproducible.

#### 3.10. Review Visual Quality and XR Readiness

**Depends on:** 3.9.

- [ ] Check scene loading, resizing, console errors, scale, clipping, lighting, patient poses, labels, and gauge readability in the application.
- [ ] Verify reach and sight lines on compatible XR hardware when available; record browser/device, observed performance, and untested behavior against the budgets from 3.1.
- [ ] Capture an overall room view, patient posture views, and close-ups of the preparation tray and measurement instruments.
- [ ] Run `npx tsc --noEmit` and `npm run build` for accompanying code changes; record export/build results and outstanding visual issues.

**Deliverable / acceptance:** a reviewable scene and validation record ready for stage 4, with any hardware-dependent checks explicitly identified.

**Suggested work order:** 3.1 → 3.2 → room shell (3.3) and furniture (3.4) → patient (3.5) and preparation props (3.6) → measurement instruments (3.7–3.8) → integration (3.9) → review (3.10). Produce and inspect one asset package at a time to keep visual revisions manageable; 3.3 can proceed independently of the furniture/patient work after the blockout is settled.

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

The active source is `references/checklist PA 2026.pdf`, revised **04/03/2026**. The 26 numbered entries remain; the bilateral first-assessment instruction is an observation after item 26, not a replacement for the persistent-sounds branch.

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
