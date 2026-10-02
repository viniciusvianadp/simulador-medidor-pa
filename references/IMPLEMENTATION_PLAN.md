# Blood Pressure Simulator Implementation Plan

## Objective and Scope

Create **“Simulador de medição de pressão arterial”**, a Portuguese-language WebXR simulator. The initial scenario is blood pressure measurement using the **auscultatory method**, with a seated patient and multiple guided steps. Menus, instructions, dialogue, feedback, and results must be in Portuguese; development documentation may remain in English.

This document is a proposed implementation roadmap, not a description of completed functionality. The current repository provides a Babylon.js scene, Havok physics, hand tracking, and a pinch-controlled box as the interaction prototype.

## Reference Files and Visual Direction

| Local reference | Intended use | Adaptation for this project |
| --- | --- | --- |
| [Start_menu.png](Start_menu.png) | Menu hierarchy, grouped settings, translucent panels, and prominent start button. The source is another university's simulator for a different procedure. | Use our title, the scenario “Método auscultatório”, and an “Iniciar simulação” button. Introduce guidance settings only when implemented. Replace the source institution's branding and unrelated procedure text. |
| [example_hands_and_step.png](example_hands_and_step.png) | Visible, simplified hands in first person; an arrow identifies the next interaction target, shown here at a hand hygiene dispenser. | Display tracked hands and a target arrow alongside a Portuguese instruction such as “Higienize as mãos”. Move the cue as each step is completed. |
| [example_room.png](example_room.png) | General clinical-room appearance: neutral surfaces, lighting, windows, equipment, and spatial arrangement. | Place the patient in a **chair instead of a bed**, with back support and an arm support. Provide a hygiene station and instrument tray within reach. Adapt equipment and feedback to blood pressure measurement. |
| [check list medida da PA.pdf](<check list medida da PA.pdf>) | Procedural source: steps 1–26, explanatory notes, and cuff-sizing table. | Preserve numbered steps and conditional behavior in scenario data so implementation can be checked against the PDF. |

Images guide composition and interaction presentation; they are not finished application assets. Reference images and the PDF are local, Git-ignored files; Markdown plans are trackable. Contributors need local copies to inspect the linked source files.

## Implementation Sequence

### 1. Define Scenario Data and Progression ✓

Create a scenario definition with stable step IDs, source checklist numbers, Portuguese prompts, prerequisites, interaction targets, completion conditions, and corrective feedback. Keep scenario rules separate from hand-tracking code in `src/scripts/xr.ts`; a proposed location is `src/simulation/`.

Use an explicit progression controller: an action completes a step only when its conditions are met. Record attempts and completion, support restart, and handle conditional steps. Preserve each hand-hygiene occurrence as its own step. Use fictional patient identity and configurable pressure values. Keep clinical timings and thresholds traceable to the supplied PDF; the transcription below does not independently validate its clinical content.

**Acceptance:** the full sequence and its conditional branch can be exercised with mock interaction events before adding detailed models.

### 2. Build the Portuguese Start Menu ✓

Implement the reference-inspired menu with the title, initial scenario, brief instructions, and start action. Start should initialize a fresh session. Provide a way to restart or return to the menu. Keep labels and prompts centrally organized for consistent Portuguese terminology.

**Acceptance:** starting and restarting reliably reset patient, instruments, and progress.

### 3. Assemble the Clinical Room

Create the room in Babylon.js Editor using the room reference. Include the seated patient, chair, arm support, hygiene station, tray, 70% alcohol, cotton, sphygmomanometer, multiple cuffs, stethoscope, and measuring tape. Establish stable mesh identifiers for interaction targets. Update exported assets in `public/scene/` with the editable assets in `assets/`.

**Acceptance:** instruments are reachable, the patient can assume the required posture, and the gauge is legible at the intended viewing position.

### 4. Implement Hands and Step Guidance

Adapt the existing hand-tracking and pinch prototype for selecting, picking up, placing, and releasing instruments. Use simplified visible hands inspired by the reference. Define valid placement zones, prevent simultaneous ownership of an instrument, and recover cleanly from tracking loss. Add a current-step panel and a target arrow; completion should follow validated interactions. Use dialogue choices for verbal actions and explicit representations for actions without a practical tracked gesture.

**Acceptance:** the first hygiene step can be completed with hands, the cue advances correctly, and an unrelated action does not advance progress.

### 5. Implement Preparation and Patient Setup

Implement checklist steps 1–13 from the mapping below: hygiene, equipment preparation, identity checks, readiness dialogue, rest, arm measurement, cuff selection, patient positioning, and gauge alignment. Make waiting periods explicit; any accelerated development mode must label simulated time. Use the PDF's cuff table as scenario data and define a selection policy for overlapping ranges rather than silently choosing one.

**Acceptance:** prerequisites and cuff selection affect progression, and repeated hygiene actions remain independently required.

### 6. Implement Measurement Mechanics and Audio

Implement steps 14–22 with a shared simulation state for cuff pressure, inflation, valve-controlled deflation, pulse cues, and Korotkoff sounds. Synchronize gauge readings and audio with scenario pressure values. Let learners identify and record systolic and diastolic readings. Include the branch for sounds persisting to zero and the required confirmation after sounds disappear.

**Acceptance:** learners can complete both the ordinary path and the persistent-sound branch; audio and gauge readings remain synchronized at different frame rates.

### 7. Implement Completion and Debrief

Implement steps 23–26: communicate results, remove the cuff, repeat hygiene, and document the measurement. Provide Portuguese feedback on completed steps, incorrect attempts, and recorded readings. The documentation form should capture the PDF example's date/time, arm, patient position, exact pressure values, and professional identification using fictional data.

**Acceptance:** completion requires the final documentation step, and restarting clears the previous session.

### 8. Validate the Full Scenario

Run `npx tsc --noEmit` and `npm run build`. Manually test menu navigation, scene loading, both hands, object ownership, tracking recovery, cues, timers, cuff placement, pressure/audio synchronization, the conditional branch, and restart on compatible XR hardware. Record browser/device and untested behavior. When implementing the progression controller, add focused automated tests for prerequisites, timers, branching, and reset; the repository currently has no test framework.

Compare each implemented step with the supplied PDF and review clinical content with the project’s subject-matter reviewer before treating the scenario as validated teaching material.

## Checklist-to-Simulation Mapping

The following summarizes the supplied PDF in English for implementation. Numeric values and ordering are retained from that source; consult the PDF for its full wording and illustrations/table.

| PDF step | Required simulation action or condition |
| --- | --- |
| 1 | Perform hand hygiene. |
| 2 | Disinfect stethoscope bell/diaphragm and earpieces with cotton and 70% alcohol. |
| 3 | Gather the required materials on the tray. |
| 4 | Perform hand hygiene again. |
| 5 | Introduce oneself and confirm two patient identifiers, such as name and date of birth. |
| 6 | Check bladder status, absence of exercise/walking/physiotherapy in the preceding 60 minutes, and absence of alcohol, coffee, food, or smoking in the preceding 30 minutes. |
| 7 | Explain the procedure, provide at least 5 minutes of quiet rest, and instruct the patient not to talk during measurement. Handle questions before or after measurement. |
| 8 | Perform hand hygiene. |
| 9 | Locate the midpoint between acromion and olecranon with the bare arm flexed and hand at waist height; then extend the arm alongside the body, measure circumference at that midpoint, and select a cuff using PDF Table 1. |
| 10 | Seat the patient with uncrossed legs, feet on the floor, supported and relaxed back, and bare supported arm at heart level (PDF: between third and fifth intercostal spaces), palm upward and elbow slightly flexed. |
| 11 | Palpate the brachial artery and align the middle of the cuff bladder over it. |
| 12 | Fit the cuff without gaps, 2–3 cm above the cubital fossa. |
| 13 | Align eye level with the aneroid gauge. |
| 14 | Palpate the radial pulse; inflate until it disappears, slowly deflate, record the pressure at reappearance as the systolic estimate, fully deflate, and wait 15–30 seconds. |
| 15 | Place stethoscope earpieces facing forward. |
| 16 | Palpate the brachial artery in the cubital fossa and place the bell without excessive compression. |
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
