# Implementation Backlog: Usability and Interaction Follow-ups

This backlog captures issues reported during a walkthrough of the current single-arm auscultatory flow. Implement and review each item independently, updating status and evidence as work progresses. The implementation plan remains the source for the overall scope and clinical workflow.

## Reported issues

### B1. Improve patient dialogue panel visibility — in progress

**Observed:** In the first physical-headset lab test, the learner could interact with the dialogue panel. The panel could be larger to make it easier to read from farther away. Earlier emulator reports described difficulty selecting topics; the latest lab result confirms that panel interaction works on the tested headset.

**Expected:** Enlarge the dialogue panel so its topics and controls are easy to see and use from farther away, while keeping the panel positioned comfortably in view. Preserve the working interaction behavior.

**Acceptance:** On the physical headset, read and select all available dialogue topics from the normal learner positions; verify patient responses and completion updates. Confirm the larger panel remains comfortably placed and does not obstruct the patient or task targets. Record headset/browser coverage separately.

**Implementation:** Added pickable XR targets aligned with all four topic rows and a close target. Selection uses the scene's existing pointer-pick path and dispatches through the existing lateral dialogue flow. The first physical-headset lab test confirmed panel interaction; panel size/readability improvement and validation remain pending.

### B2. Reach and interact with the supported measurement arm

**Observed:** The learner cannot comfortably reach the patient's right arm because the chair and adjacent table obstruct movement. During arm interactions, the instruction slate/card can cover the target.

**Expected:** The right arm selected for measurement is posed on the support at heart level; its required interaction zones are reachable from a clear approach position, and guidance does not occlude the target or the learner's hand/ray at the point of action. Other-arm interaction is outside the current single-arm workflow.

**Acceptance:** From the normal spawn and the patient station, approach and interact with the supported measurement arm without passing through furniture or fighting collisions. Check desktop and immersive views. Adjust furniture/collision footprint, station/teleport positions, and guidance placement as needed.

**Implementation:** Removed oversized invisible chair/tray collision boxes while retaining collision on the actual chair meshes; moved the left/right approach and teleport points into clear floor areas; made arm, wrist, cuff, and the pre-fitted sleeve consistently use the configured measurement arm, rejecting interaction with the other arm; anchored the general XR slate to the wall behind the alcohol dispenser and added a compact pressure board beside the patient for measurement controls; made non-control areas of the browser guidance HUD pass pointer input through to the scene. Emulator, browser walkthrough, and headset validation remain pending.

**Follow-up correction:** The mannequin pose and raised armrest currently support only the right arm at heart level. All offered single-arm patient cases now measure that same arm, keeping the pose, cuff, and interaction targets aligned. A left-arm or bilateral case must wait until the scene supports matching poses and armrests.

### B3. Show progress within repeated multi-action steps — implemented; headset validation pending

**Observed:** Some steps require several successful actions (for example, repeated stethoscope cleaning or pressure measurement), but the guidance does not clearly show how many remain. Learners may repeat an action because they cannot tell whether it registered.

**Expected:** Guidance shows within-step progress, such as “Ação 2 de 3”, and confirms accepted actions while keeping the current step and next action clear. Failed attempts should explain what is still needed without incrementing progress.

**Acceptance:** Exercise each multi-action step, including repeated hygiene and pressure measurement; confirm progress increments exactly once per accepted action, remains stable on rejected/duplicate attempts, and reaches completion at the correct point in both desktop HUD and XR slate.

**Implementation (2026-11-16):** Steps with more than one completion condition show “Ação N de M” under the step headline on the desktop HUD and before the instruction on the XR slate; it follows the controller's action index, so rejected attempts do not advance it. Repeated +10 mmHg inflation stays within one action. Verified in headless Chrome for step 2 (“Ação 1 de 2” → “Ação 2 de 2”); headset readability is untested. The final debrief now also scores the physical procedure from rejected attempts (see `src/simulation/debrief.ts`): each completed physical step is worth one point and loses half a point per rejected attempt, the debrief lists the steps with errors and the recorded versus case reference readings, and communication keeps its omission/timing deductions; both halves weigh 50%. This scoring policy is a formative engineering choice pending review by the group's subject-matter reviewer.

### B4. Clarify when to perform patient communication

**Clarification:** The numbered physical guidance already communicates the sequence: for example, when it shows step 8, the learner can infer that steps 5, 6, and 7 are patient communication. No additional communication timing cue is requested at this time. Keep this note as context if the step sequence or guidance presentation changes.

**Expected:** Preserve the current progress percentage and non-blocking communication model. Do not add redundant timing cues or turn dialogue into a hard prerequisite for physical actions.

**Acceptance:** Physical progress percentage and debrief timing/omission scoring remain intact. No communication timing change is currently required unless walkthroughs identify ambiguity.

### B5. Make instrument interactions and movement visible

**Observed:** Interactions advance the scenario, but objects appear stationary: the cuff is not visibly removed, the stethoscope is not picked up/placed, and the sphygmomanometer does not visibly respond during measurement.

**Expected:** Accepted actions produce clear, coherent visual feedback. The learner wears the stethoscope, so its model should leave view after earpiece placement and remain hidden; chestpiece placement is represented by interacting with the cubital area. The sphygmomanometer should be visible beside the patient, with pressure observation/recording steps available through explicit confirmation controls. Cuff visual changes are deferred.

**Scope change explicitly requested by the user (2026-11-16):** Replace the blue cylinder with a fitted visual cuff on the existing measured arm and connect it to the instrument. Fitted cuff appearance and connecting hoses are now in scope; preserve the single right arm and established fit/clinical sequence. Replacing the patient, bilateral workflows, and free cuff fitting remain outside this change. Earlier blanket cuff-visual deferrals below are historical for this requested replacement.

**Asset note:** The current fitted cuff is a simple blue cylinder sketch positioned on the selected arm. The existing cuff GLB depicts folded storage cuffs, so the final fitted cuff should be modeled together with the patient rather than repurposing that folded mesh.

**Implementation:** In WebXR, pinch and carry the stethoscope near the learner's head to place the earpieces; the model then hides to represent wearing it. The model stays hidden for the rest of the session. The learner records chestpiece placement by interacting with the cubital area. Listening checks and pressure observations use explicit confirmation buttons on the desktop guidance card and XR slate. When the manometer first becomes an active target, it and the pressure readout move beside the patient's measurement arm. Cuff movement is out of scope. Emulator/headset visual confirmation is pending.

**Acceptance:** Follow the stethoscope sequence and verify it hides after earpiece placement, remains hidden through chestpiece placement, and listening checks advance through the confirmation button on desktop and XR. Confirm the sphygmomanometer and readout appear beside the patient and pressure observations advance through confirmation controls. Restart restores scene items to their initial positions. Track audio mechanics and cuff appearance separately as later work.

**Visual follow-up:** The learner-facing pressure readout and moving needle are now working. The manometer's exact position still needs tuning under B6.

### B6. Refine the sphygmomanometer's exact position — in progress

**Observed:** The manometer is now closer to the patient's arm, but its exact placement still needs visual tuning from the learner's viewpoint.

**Expected:** The manometer sits in a believable, reachable position beside the supported arm, with its face and pressure readout visible and unobstructed. Keep the current single-arm workflow; cuff visuals remain deferred.

**Acceptance:** Review the gauge from the patient station and normal approach positions in desktop and immersive views. Adjust placement/orientation until the instrument and moving pressure needle are clearly visible without intersecting the patient, furniture, or guidance panel. Capture a screenshot as evidence.

**2026-11-16 placement pass:** Headset feedback and `/tmp/Screenshot_20261116_151226.png` show the instrument over the forearm and the board crowding the opposite side. Moved the instrument outward/lower with a deterministic orientation; reduced the board to 65%, anchored it beside the instrument, and show it only during auscultatory measurement. This is provisional against the current patient/room; final B14 layout and desktop/XR visual validation remain pending. Initial type checking exposed existing mesh/nullability errors in hand interaction; corrected those guards as part of validation.

**Correction after screenshots `Screenshot_20261116_152514.png` and `Screenshot_20261116_152616.png`:** The first offset pass was visually rejected: controls floated separately, labels faced backward, and the board's solid back obstructed the patient view. Supersedes the placement above: align the instrument's hierarchy bounds on a small stand forward of the arm (surface center `[-0.50, 0.955, -1.40]`), mount the readout above its back edge, reduce it to 45% of the original size, and turn it toward the active camera using its actual -Z front. Labels use horizontal billboarding and smaller dimensions. The gauge guidance arrow now uses visible bounds too. The right-arm desktop station and XR snap point move to `[0.05, 1.60, -2.00]` (XR floor Y = 0), with the desktop view aimed between the arm and equipment. The stand footprint stays outside the direct wrist approach; all added geometry is disposed on restart. Physical-headset acceptance remains pending. Desktop validation: Chromium 159 (headless, SwiftShader) rendered the working station and an opposite-side approach; inspected `/tmp/pressure-layout-working.png` and `/tmp/pressure-layout-approach.png`. The panel front is visible from both sides, its support stops below the display, and the instrument sits on the surface. Browser checks accepted 14 bulb uses to reach 140 mmHg, valve use, and identical stand placement after restart, with no page exceptions. Forced the arm world-matrix update to keep placement correct when advancing immediately after loading. Type checking, all 31 simulation tests, and the production build pass. These checks do not establish physical reach on XR hardware.

**Latest user-requested position correction:** The stand remained too far to the patient's side. Shifted it 23 cm toward the supported arm: surface center `[-0.73, 0.955, -1.36]`, footprint reduced from 48 × 42 cm to 34 × 30 cm. Moved the readout support to the measured-arm side of the stand so the dialogue trigger does not cover it in the reviewed approach view. This supersedes the previous stand coordinates. Chromium desktop screenshots: `/tmp/pressure-parts-working.png`, `/tmp/pressure-parts-approach.png`; physical-headset clearance/reach remain pending.

### B7. Model continuous pressure and Korotkoff sounds — in progress

**Before this change:** Pressure changed through discrete accepted actions. Inflation added 10 mmHg per action; the deflation action only validated the 2 mmHg/s rate and did not run a pressure timeline. Systolic/diastolic confirmation actions used the configured patient values directly. There were UI success/error chimes, but no Korotkoff audio.

**Implemented so far:** Added click-based +10 mmHg inflation and a learner-controlled “Iniciar deflação” choice within the 20–30 mmHg target range. Deflation advances cuff pressure at 2 mmHg/s; learners can pause it to hold a reading while recording and resume afterward. Fixed the live manometer needle/readout not updating on its first render. Systolic, diastolic, muffling, and confirmation actions capture the current gauge reading. The first-sound recording allows a 4 mmHg response window (two seconds at the specified deflation rate) while retaining the learner's displayed pressure observation; other systolic checks retain their existing tolerance. Added synthesized Korotkoff transients to the live pressure update: silence above systolic; beats at about 72 bpm through the ordinary sound range; a muffled persistent-sounds branch through zero; audio is gated on earpiece and chestpiece placement and auscultation steps. UI chimes remain separate. `npx tsc --noEmit` and `npm run build` pass; desktop/XR audio walkthroughs remain to be verified. The 2026-10-19 desktop screenshot exposed the frozen needle and unpausable timeline; both have been corrected, with another walkthrough still needed.

**Expected (updated after headset follow-up):** Desktop keeps explicit click/tap controls; in XR the learner can hold the actual bulb and loosen/squeeze it to pump. Each accepted press or squeeze adds one 10 mmHg increment, and the learner chooses when to press “Iniciar deflação” based on their palpated estimate. After controlled deflation starts, cuff pressure falls at 2 mmHg/s and continuously updates the visible needle. Beat-like Korotkoff sounds are synchronized with the patient's heart rate and current cuff pressure, and are audible only after the learner places the earpieces and chestpiece. “Registrar sistólica” and “Registrar diastólica” capture the pressure currently shown when the learner presses them; case values drive the simulated sound thresholds but are not filled into learner observations automatically. Provide an explicit “Liberar ar” control after the listening/confirmation range.

**Stopping points:** Recording the first sound does not stop deflation. In the usual branch, record phase V at sound disappearance, continue listening for 20–30 mmHg below it to confirm disappearance, then release the remaining air to zero. In the persistent-sounds branch, continue to zero, record the muffling pressure and zero, then release the cuff.

**Palpatory estimate note:** The virtual flow presents the radial palpation sequence, but it does not provide tactile pulse feedback or accept an independent learner estimate. The current interaction adapter derives pulse disappearance/reappearance from the configured case systolic value. For example, the default case records 118 mmHg as the estimate, making the target inflation range 138–148 mmHg; 140 mmHg is the first available +10 mmHg reading in that range, and 150 mmHg is correctly blocked as above the maximum. The HUD now shows the recorded estimate, target range, and why the next increment is unavailable. A learner-entered palpatory estimate would require a separately scoped interaction decision.

**Acceptance:** Verify button-controlled 10 mmHg inflation with learner-chosen stopping point, then silence above systolic, first sound at phase I, regular beats during auscultation, disappearance at phase V for ordinary cases, and the persistent-sounds branch through zero. Confirm deflation stays at 2 mmHg/s, the readout follows it, audio stops when auscultation ends or the session resets, and pressure observations come from the displayed reading. Use synthesized Web Audio transients or authored sound assets; keep them distinct from the existing UI chimes.

### B8. Enlarge the dialogue close button

**Observed:** The first physical-headset lab test found that the close button on the patient dialogue panel is difficult to target from farther away.

**Expected:** Make the close control large and easy to acquire at the normal dialogue viewing distance, while keeping its purpose visually clear and avoiding accidental activation of nearby choices.

**Acceptance:** Open and close the dialogue panel from the usual learner positions on the physical headset; confirm the target is comfortably selectable from farther away and does not overlap other controls.

### B9. Revisit hand interaction gestures — in progress

**Observed:** Pinching was difficult during the first physical-headset lab test.

**Expected:** Evaluate gesture choices per action. Consider grabbing for picking up/carrying objects and pointing or ray selection for UI and confirmation controls. Keep each interaction discoverable and consistent with its purpose; retain pinch only where it remains the clearest, reliable choice.

**Acceptance:** Try the candidate gestures on the physical headset for dialogue, panel controls, and object manipulation. Select and document the supported gesture for each action, including any accessibility or tracking limitations, then verify acquisition, release, and accidental activation behavior.

**Implementation (2026-11-09):** Fixed a hand-tracking early return that disabled all clinical hand interactions when the prototype `box` mesh was absent. The stethoscope uses a whole-hand grab: closing three tracked fingers near it picks it up, and opening the hand releases it. Closing the hand near the currently required scene target now activates that physical action without requiring the ray dot to land precisely on the mesh. XR slate/panel controls still use ray selection; inflation and deflation controls remain explicit buttons. The prototype box and its pinch handling were removed on 2026-11-16; hand teleportation uses a 3-second pinch held toward the floor. Physical-headset retest is pending, including false grabs, proximity activation accuracy, release reliability, and controls that still require ray selection.

### B10. Review placement of scene equipment and panels

**Observed:** The first physical-headset lab test identified a need to review the positioning of scene elements, including the sphygmomanometer and pressure panel.

**Expected:** Place equipment and panels where they are visible, reachable, and unobstructed from the learner's normal approach and working position around the patient. Include the sphygmomanometer, pressure panel, and other frequently used controls in the review.

**Acceptance:** Walk through the complete measurement flow on the physical headset and adjust placements that are hard to see, reach, or operate. Check for occlusion, awkward reach, and collisions with the patient or furniture. Record headset and viewpoint evidence. B6's sphygmomanometer-specific positioning criteria remain applicable.

### B11. Add pressure measurement sounds — implementation complete; device validation pending

**Observed:** The first physical-headset lab test prompted a check for audible feedback during pressure measurement. The current pressure work item B7 specifies synchronized Korotkoff sounds.

**Expected:** Implement and verify the pressure-measurement audio described in B7, including Korotkoff beats synchronized with pressure and gated on correct stethoscope placement. Keep these clinical measurement sounds distinct from interface chimes.

**Acceptance:** Validate audible onset and disappearance at the configured pressure thresholds, synchronization during deflation, audibility through the headset, and stopping on auscultation end or session reset. Update B7 with evidence when complete.

**Implementation evidence:** Added a Web Audio noise transient synthesizer in `InteractionManager`, updated from the live cuff-pressure display and using each case's configured systolic/diastolic thresholds. Beats are gated by accepted earpiece and chestpiece placement, use a 72 bpm interval, stop outside the auscultation listening window, disappear at phase V for ordinary cases, and remain muffled to zero in the persistent-sounds branch. Phase II uses a softer, longer swish; phase III uses a louder, sharper beat. Variation policy: randomize the noise waveform for each beat while keeping beat interval, phase thresholds, and phase transitions deterministic. This is separate from success/error UI chimes. The session's existing `dispose()` closes the context on restart/end. The user confirmed browser playback, successful first-sound registration, and that phases II and III are distinguishable. Full threshold walk-through (including the persistent-sounds branch) and XR/headset audibility remain pending.

### B12. Replace the patient character model

**Observed:** The current mannequin is a provisional patient character; the team wants a different character model.

**Expected:** Select and integrate a replacement that fits the clinical scenario, available licensing/source constraints, and the existing seated pose. Preserve the single-arm workflow: the measured right arm, cuff, and target zones must align with the replacement model. Keep the current character available until the replacement is integrated and reviewed.

**Acceptance:** Confirm the replacement loads in desktop and XR, sits naturally in the chair, presents the supported arm at heart level, and keeps the cuff and interaction zones aligned. Record source/license and capture a learner-view screenshot. Recheck B2 reach and collision behavior.

### B13. Expand the clinical room

**Observed:** The current room footprint constrains movement and the arrangement of the clinical stations; the team wants a larger room.

**Expected:** Increase usable floor space while preserving a coherent clinical environment, clear paths between stations, and the room's visual style. Revisit wall/floor geometry, collision boundaries, lighting, and station/teleport viewpoints together.

**Acceptance:** Confirm the expanded room has no gaps or unintended collision barriers, supports clear circulation between hygiene, record, instrument, and patient stations, and works with desktop movement and XR teleportation. Capture an overview screenshot and update the station coordinates.

### B14. Reposition scene items — in progress

**Observed:** Equipment and panels need a broader placement pass. This extends B6 (manometer position) and B10 (equipment and panels) to cover the room layout and learner approach positions.

**Expected:** Arrange frequently used items and panels so they are visible, reachable, and unobstructed from the relevant work positions, without intersecting the patient, furniture, or each other. Use the expanded room and final character pose as layout constraints.

**Acceptance:** Review the complete flow from normal approach and patient-station viewpoints in desktop and XR. Check reach, visibility, occlusion, collision, and guidance-panel placement; capture representative screenshots. Update B6/B10 evidence rather than treating their existing criteria as superseded.

### B15. Add meaningful object interactions — in progress

**Observed:** The existing flow has limited object manipulation and visual response. This extends B5's implemented stethoscope feedback and stationary cuff scope into a defined interaction pass for clinical objects.

**Expected:** Identify which instruments and supplies the learner should pick up, move, use, or return, and connect each accepted action to a visible, resettable object state and the existing simulation event. Use gestures appropriate to each action as assessed in B9. Keep cuff appearance/movement explicitly deferred unless the team adds it to scope.

**Acceptance:** For each selected object, verify acquisition, movement/use, release, correct simulation progression, rejected/duplicate actions, and restoration on restart in desktop and XR. Document the interaction and gesture per object; no object should advance a step solely because it was generically touched.

**Latest B15 implementation — replaces oval proxies:** The user explicitly rejected separate oval controls. Removed both proxy meshes and their labels. Split the original sphygmomanometer GLB's disconnected bulb and valve geometry into separately pickable meshes, preserving their textures, transforms, and the remaining instrument geometry. Source-local shell bounds identify these two parts; their picking bounds contain only their own geometry. Click or close the hand on the instrument's actual bulb to inflate; use its actual valve for the existing deflation/release/pause actions. Accepted bulb use compresses and restores the original bulb; valve use gives a brief turn. Hand contact uses the palm between wrist and middle knuckle, retains the working fist thresholds/open-to-close trigger, and selects the nearest part within 7.5 cm. Panel controls remain available. Desktop Chromium checks verified downward rays hit each actual part, no proxy labels remain, bulb use reaches 140 mmHg, valve use works, and restart restores placement. No page exceptions. TypeScript, production build, and 31 simulation tests pass. Both-hand accuracy, part discrimination, false activation, and tracking recovery require headset validation; scripted palpatory mechanics and deferred cuff visuals remain unchanged.

## Latest workstation and clicking correction (2026-11-16)

**B15 — click regression:** The latest user screenshot (`/tmp/Screenshot_20261116_154855.png`) shows the inflation warning after clicking the instrument. Center clicks worked in isolation, but a real repeated-mouse test reproduced ignored second presses: Babylon emits `POINTERDOUBLETAP` for rapid repetition, while the adapter listened only for `POINTERPICK`. The pressure controls now count both presses; unrelated confirmations keep single-click behavior. Clicks on the surrounding instrument/stand within 12 mm of the bulb or valve bounds resolve to that actual part, covering the adjoining tube without adding visible controls. `tests/instrument.browser.mjs` verifies 14 real clicks across two viewpoints, 140 mmHg, the valve's tube margin, deflation, pause, no oval labels, and no page exceptions. Run it against Vite and isolated headless Chrome on port 9224 (with `--no-sandbox` and a dedicated temporary user-data directory); override `INSTRUMENT_BROWSER_URL`/`INSTRUMENT_APP_URL` if needed.

**B14/B2/B6/B10 — user-directed consolidated layout:** At the user's request, moved the complete patient/chair/arm/cuff assembly 0.80 m toward the former instrument-table area after posing, preserving all internal alignments. The table is rotated and placed beside the measured arm at `[-0.95, -1.90]` in X/Z; alcohol, stethoscope, tray, and record are grouped there. The manometer remains beside the arm from session start. Preparation, hygiene, documentation, and right-arm measurement share learner position `[-1.05, 1.60, -1.50]`, changing viewing direction only. Desktop and XR start at this work position; XR snap points use the same source and deduplicate shared points. Coordinates live in `src/scene/workstationLayout.ts`. The pressure readout is smaller/lower for the closer work distance, and the dialogue trigger follows the relocated patient on the opposite side from measurement. Runtime assets are relocated; no source GLB or cuff appearance change.

**Validation:** Chromium 159 headless with SwiftShader: inspected `/tmp/workstation-working.png`, `/tmp/workstation-approach.png`, and `/tmp/workstation-supplies.png`; confirmed supply surfaces, supported arm, instrument placement, original-part picking, inflation/valve behavior, and identical placement after reset. `tests/instrument.browser.mjs`, TypeScript, production build, and all 31 simulation tests pass. The supply-table footprint is outside the shared learner point and the wrist approach. Physical-headset reach, collisions during free movement, hand discrimination, and comfort remain pending; no hardware/browser identity was provided for the reported headset test. This current-room layout follows the explicit user request rather than waiting for the final character/expanded room.

## Rubber bulb, release valve, and fitted cuff (2026-11-16)

**B15 correction:** The user correctly reported that inflation was mapped to the clock. Previous named-target tests verified dispatch but not the geometry's identity. A coloured-shell rendering (`/tmp/instrument-shells.png`) identified the actual rubber bulb at source positive Z and the hose-side collar beside it; the formerly selected positive-X shell is the dial. Corrected the split and added a small physical metal release screw on the collar, since this low-poly asset has no distinct knob. Inflation now compresses the rubber bulb; the gauge never inflates. One use of the release valve after reaching the inflation target accepts the stopping point and starts 2 mmHg/s deflation; later uses pause/resume it, or release air at the prescribed step. This is the simulator's explicit click/grab adapter, not continuous manual valve-angle control. Updated Portuguese help identifies the rubber bulb, metal valve, and reading-only dial. Device reference: [Welch Allyn gauge instructions](https://www.hillrom.com/content/dam/hillrom-aem/us/en/sap-documents/LIT/80025/80025959LITPDF.pdf), pressure generation by bulb and reduction by air-release valve.

**B5 fitted appearance — newly authorized:** Replaced the blue solid cylinder with an open-ended fabric cuff fitted to inspected upper-arm cross sections of the current posed mannequin, with edge seams, a fastening flap, and an artery label. Preserved the single measured right arm. Removed the imported folded cuff and storage-position hoses from the instrument stand; retained its gauge, rubber bulb, and connectors, and routed two new hoses to the fitted cuff. Accepted cuff removal hides the cuff/hoses; restart rebuilds the fitted assembly. No free cuff fitting, bilateral measurement, or patient-model replacement was added.

**Evidence:** Chromium 159/SwiftShader checks now independently distinguish bulb source geometry from the dial and prove dial clicks leave pressure unchanged. Real mouse tests cover 14 squeezes, valve opening, pause, cuff connections/removal/reset, and page exceptions. Fitted cuff image: `/tmp/fitted-cuff-final.png`. TypeScript, build, and 31 simulation tests pass. Physical headset reach, hand discrimination on the small screw, and close-up cuff/skin fit remain to be validated; previous blanket visual deferrals do not apply to this explicitly requested cuff replacement.

## Suggested implementation order

1. **B7/B11 — Korotkoff audio:** implement cues against the existing pressure timeline, then verify both sound branches.
2. **B12/B13 — Character and room:** choose the replacement model and expand the room; coordinate pose and footprint before final layout work.
3. **B2/B6/B10/B14 — Access and placement:** recheck arm reach, manometer, equipment, and panels after the room and character changes.
4. **B5/B9/B15 — Object interactions:** define per-object actions and gestures, then connect them to visible state and reset behavior.
5. **B1/B8 — Dialogue controls:** improve panel readability and close-button targeting.
6. **B3 — In-step progress:** make multi-action progress legible on desktop and XR.

For each actionable item, reproduce the issue, implement only that item, validate its acceptance points, and update this backlog with status and a concise evidence note before moving on. B4 is clarification-only unless future walkthroughs reveal ambiguity. Revisit dependencies if investigation shows a different order is necessary.

## Relationship to the implementation plan

These are follow-up usability and integration defects in already-integrated stages 3–5, plus visual mechanics overlapping stage 6. B12–B15 add character, room, layout, and object-interaction work. The simulator remains a single-arm workflow by project decision; bilateral assessment is out of scope. Synchronized Korotkoff audio, remaining asset work, and full hardware validation (stage 8) remain tracked in `IMPLEMENTATION_PLAN.md`.

## Four parallel work divisions

The group chose these divisions to balance workload: Division 1 has a smaller initial scope, with the expectation that its owner will pick up an additional pending task or help another division after finishing. Each owner should report assumptions and evidence and coordinate shared scene or interaction changes before editing them.

1. **Division 1 — Two experience flows:** define and implement the tutorial and no-tutorial flows, including what guidance changes between them. **First version (2026-11-16):** the start menu offers “Com orientação (tutorial)” and “Sem orientação (avaliação)”. Without guidance the target arrow, step/action prompts, target badge and station shortcut are hidden on the HUD and XR slate; instrument controls and pressure readouts remain, and clicking the wrong object is recorded as a rejected attempt that the debrief scores. Labels of the explicit pressure/confirmation buttons still reveal those actions. The group should review this split and decide on the additional feature. A restart panel on the front wall (`clinicalLayout.restartPanel`, `src/interaction/RestartPanel.ts`) restarts the session in either mode from inside the scene, including immersive XR: a button must be selected twice within 5 s. It resets the controller, guidance and the moved/hidden instruments in place without reloading the scene, so the XR session continues; the DOM “Reiniciar” button still reloads the scene. Verified in headless Chrome (progress to step 16, restart into evaluation mode, same scene, instruments restored); headset ray selection is untested. The group mentioned an additional feature, but its scope is still to be decided. The initial assignment is intentionally lighter; when it is complete, its owner can take one of the pending tasks below or help another division. Candidate follow-up tasks are patient dialogue (B1/B8, plus conversational content in the scenario) and patient model selection/integration (B12), depending on priority and coordination needs.
2. **Division 2 — Room, layout, and object interaction (B2/B5/B6/B9/B10/B13/B14/B15):** expand and dimension the room, place scene items and panels, improve visibility, reach, and access, and add meaningful object interactions. Coordinate the final layout with whoever takes B12 and defines the patient pose. Final equipment placement depends on the room footprint and patient pose.
3. **Division 3.1 — Auscultation and Korotkoff audio (B7/B11):** complete the auscultation training flow and integrate synthesized Korotkoff sounds across phases I–V, including a decision on sound variation/randomization that preserves the clinical pressure relationship. Coordinate audio events with the pressure timeline and accepted learner observations.
4. **Division 3.2 — Training feedback (B3/B4):** complete the feedback flow, including clear progress through multi-action steps and preservation of non-blocking communication timing and debrief evaluation. Coordinate feedback wording and behavior with the two experience modes in Division 1.

Patient dialogue and patient models remain pending tasks rather than prerequisites for starting all divisions. Division 1 can absorb either as follow-up work if available, or assist another division; the group can reassign them based on progress. Room expansion can begin in parallel with model selection, while final B14 placement follows the room and patient-pose decisions. Keep cuff visuals deferred unless the group changes that scope.

## Next work session: step-by-step plan

1. **Start the four group divisions:** define tutorial/no-tutorial behavior, agree on the expanded room footprint, progress auscultation/audio work, and scope the feedback flow.
2. **Use Division 1's follow-up capacity** for patient dialogue, patient model work, an agreed additional feature, or support for another division.
3. **After room and patient-pose decisions,** finalize equipment/panel positions and verify object interactions in desktop and XR.
4. **Validate Korotkoff branches** and record desktop, emulator, and physical-headset coverage separately. Cuff visuals remain deferred.

**Next task:** Begin work across the four group divisions. The first division has intentionally lighter initial scope; once its tutorial/no-tutorial flows are complete, assign its owner a pending dialogue/model task or have them support another division. Keep the auscultatory workflow single-arm and cuff visuals deferred.

## 2026-11-16 headset follow-up evidence

- B9: user reports the whole-hand gesture works well on the headset; exact device/browser were not supplied. Preserve that gesture.
- B6/B10: provisional placement pass based on the supplied screenshot; compact readout follows the equipment and is hidden outside auscultation. Type checking and production build passed for placement. New headset screenshots/reach checks remain required before acceptance.
- B15: added separately labelled bulb and valve interaction proxies beside the instrument (the GLB is a single combined mesh). Closing the hand within 13 cm uses the nearest control once; opening/reclosing is required to repeat. Desktop clicks use the same dispatcher. Bulb adds 10 mmHg during auscultatory inflation with existing limits; valve advances the existing deflation/release actions or pauses/resumes the running timeline. Accepted use briefly depresses the control; disposal/restart removes controls, labels, textures, and materials. Panel controls remain available. Wrist palpation stays on the wrist; palpatory estimation remains scripted, with no tactile feedback or independent learner reading added. Full pressure-driven palpatory mechanics remain future work. Both-hand reach, accidental activation, reset, and visual alignment need headset validation.
- Regression suite contained stale left-arm fixture expectations and treated the now-correct right arm as invalid documentation. Updated those assertions to match the established single-right-arm scope; no clinical rules changed.

## Merge integration: shared layout and in-place restart

Integrated the workstation/cuff controls with incoming guidance modes, scored debrief, extracted audio, and the wall restart panel. Current coordinates now live in `src/scene/clinicalLayout.ts`; `workstationLayout.ts` was consolidated into it. Retained the relocated patient/supply table, shared learner station, actual bulb/valve controls, and fitted cuff. In-place restarts reuse scene-owned instrument parts, restore animation transforms and cuff visibility, and rebuild guidance/hoses without splitting already-cut geometry. The instrument browser check covers both guided and evaluation mode resets as well as full scene reloads. Earlier evidence and coordinate-file names above describe historical iterations.

Merge validation: all 34 simulation/debrief tests and TypeScript pass. The Chromium 159 browser regression passed actual bulb/valve clicks, fitted cuff removal/reset, in-place resets in both tutorial/evaluation modes, and two rapid selections on the restart wall panel without page exceptions. Production build passed. Physical XR hardware was not retested for this merge.

## Headset follow-up: overhead conversation trigger and held bulb

The user confirmed headset interaction but reported that the bulb/valve still require pinch rays and that nearby conversation targets cause accidental opening. B10 placement pass: moved the conversation trigger above the patient's head using `clinicalLayout.dialogueTrigger`, including its bobbing baseline, and removed direct patient-body clicks as a dialogue shortcut. The explicit overhead icon and HUD dialogue button preserve non-blocking communication. Type checking passes; final browser/headset evidence follows below.

B9/B15 scope revision explicitly requested by the user: grab and carry the real bulb, then loosen/squeeze it while held instead of repeatedly pinching a stationary object. Retain desktop/panel controls as alternatives. Use free-hand index contact for the physical valve. Preserve one owner, one increment per accepted squeeze, and reliable release, tracking loss, and both reset paths; the cuff/patient scope remains unchanged.

**Held-bulb implementation/evidence:** The actual rubber bulb, inlet cap, valve collar, and metal screw travel together with either hand. Whole-hand acquisition is separate from pumping; loosening and squeezing adds one accepted increment, sustained closure does not repeat, and briefly loosening refills without dropping. Sustained full opening docks the tethered instrument. A direct extended-index touch from the free hand operates the valve once; withdrawing and touching again re-arms it. The holding hand cannot accidentally press the valve. A second hand cannot take ownership, pinch-ray picks on a held assembly are suppressed, and a short tracking gap is tolerated before docking. Hand removal, full restart, and in-place mode reset restore the assembly. The bulb hose follows the moving connector and is updated only when it moves. The carrier follows palm position and wrist rotation without inheriting joint-radius scaling. The existing stethoscope gesture remains intact; its hand-loss cleanup also detaches it before joints disappear. Desktop/panel controls remain available. Finger bend is normalized by the tracked finger-bone chain, with separate acquisition, squeeze/refill, and release thresholds.

Validation: 40 Node tests cover the simulation/debrief and grip/contact hysteresis. `tests/hand-instruments.browser.mjs` uses synthetic hand frames in Chromium to verify overhead dialogue/body-click isolation, gradual acquisition, both-hand ownership, carry/rotation/scale, live hose movement, +10 squeeze cycles, ray suppression, free-hand valve touch/re-touch, release, tracking loss, and reset while holding. `tests/instrument.browser.mjs` preserves real mouse controls, cuff removal/reset, guidance modes, and the restart panel. Type checking and production build pass. This is device-free validation; the new grip/contact thresholds, hand placement, and overhead-icon reach still need the user's physical-headset retest (headset/browser unspecified).

## Ordered spoken tutorial conversations (2026-11-17) — implemented; headset validation deferred

**User-authorized scope revision (B1/B4/B8):** Tutorial communication now belongs to the numbered workflow. Replace its overhead bubble/topic selection with a learner-facing “Modo de diálogo” panel; approaching the patient starts automatic Portuguese professional/patient exchanges with subtitles and no confirmation clicks. The initial conversation covers identification, readiness, and explanation/rest consecutively; results communication occurs after either auscultation branch and before cuff removal. Open/evaluation mode retains optional lateral communication and its timing/omission scoring. This supersedes the tutorial-only non-blocking requirement and panel-enlargement proposal above.

**Implementation:** Browser speech synthesis uses pt-BR, preferring an installed Brazilian Portuguese voice. A timed, explicitly labelled subtitle fallback handles unavailable/rejected/stalled speech. The existing five-minute simulated rest is announced and advanced after explanation. Each topic is recorded only after its exchange finishes. Results use learner-recorded readings. The XR slate follows the active camera during conversation and returns to its previous wall placement afterward; tutorial has no bubble or topic button. Restart cancels pending speech and clears playback state. The front-of-patient station and its 65 cm approach radius live in clinicalLayout.

**Validation:** 57 Node tests pass, including ordered conversation, timing credit, both pressure branches, all five cases, duplicate/out-of-order rejection, setup preservation and restart. Chromium headless/SwiftShader browser regression uses controlled speech callbacks to check distance gating, consecutive exchanges, completion after playback, absence of tutorial topic controls, cancellation on mode reset and preservation of evaluation dialogue. This verifies integration rather than audible Portuguese voice quality. Physical headset validation is deferred until the user has hardware next week; voice quality, XR panel comfort and approach distance remain to review. Run `node tests/dialogue.browser.mjs` with Vite and isolated Chrome on port 9225; optional URL overrides match the instrument checks.

Final desktop review: corrected the slate to match the camera orientation, reduced its size and rendered conversation captions above scene geometry. Inspected `/tmp/tutorial-dialogue.png`. TypeScript and production build pass; the build retains the existing large-chunk warning.

Related browser regressions also pass: `tests/instrument.browser.mjs` verifies real bulb/valve clicks, cuff removal, both restart modes and reload; `tests/hand-instruments.browser.mjs` verifies synthetic both-hand grip/valve/reset behavior and optional evaluation-mode dialogue. Their fixtures now account for ordered tutorial communication. No page exceptions were reported.

## Dialogue panel appearance and approach correction (2026-11-17)

User screenshot `/tmp/Screenshot_20261117_111300.png` showed the learner facing the patient while the dialogue kept waiting. The 65 cm trigger was centered on a preset station instead of the patient. Replaced that hidden waypoint requirement with a 1.6 m horizontal patient-relative range and a broad facing check; standing close and facing the patient starts speech from natural approach positions. Looking away or standing far away does not start it. The radius remains configured in clinicalLayout.

Restyled the dialogue slate to match the restart wall panel: ivory background, rounded green border, green mode badge, dark text and separated caption footer. Rounded corners use texture transparency. Removed the visible duplicate desktop card while preserving its accessible transcript; physical-step HUD returns afterward. Validation: 57 tests and TypeScript pass; updated browser regression checks a natural approach outside the old station circle, looking-away rejection, sequential speech and reset. Screenshot `/tmp/tutorial-dialogue.png` records the new appearance. Physical-headset validation remains deferred.

Validation for this correction: all 57 Node tests, TypeScript, production build and `tests/dialogue.browser.mjs` pass. The browser regression now approaches the patient's geometry directly, outside the former station trigger, checks looking-away suppression, then completes the automatic exchanges and reset checks. Inspected the revised `/tmp/tutorial-dialogue.png` in Chromium headless/SwiftShader. Hardware comfort and actual speech audibility remain pending physical-device review.

## Dialogue sequence regression: old phrases returning (2026-11-17)

User reported already-spoken phrases returning. Speech errors started subtitle fallback without clearing the original watchdog; that stale timer could later redisplay its old phrase and cancel a newer utterance. Phrase playback now owns one timer, retires handlers on fallback/completion, ignores repeated or delayed callbacks, and resolves cancellation on disposal. Added a browser regression injecting speech failure plus repeated/stale watchdog/error callbacks and checking that the next subtitle and speech remain unchanged. Consecutive initial topics now continue directly without flashing the approach prompt; their headers show “1 de 3”, “2 de 3”, and “3 de 3”. Hardware speech review remains pending.

Sequence correction validation: 57 Node tests, TypeScript and the Chromium dialogue regression pass, including injected stale callbacks and completion/reset. Reviewed the updated numbered panel in `/tmp/tutorial-dialogue.png`.

## Dialogue visual refinement and patient naming (2026-11-17)

User requested another visual pass based on the wall restart panel. Added its green header treatment, light rounded frame, inset speaker area, a speaker badge and three progress segments; preserved automatic ordered speech and subtitles. Removed “Exemplo” from all five patient names in the source cases, scenario README and browser menu expectations; case IDs and clinical settings remain unchanged. Audio remains browser speech synthesis; generated recordings were discussed as a future asset option, not generated or integrated in this pass.

Validation: 57 Node tests, TypeScript, production build and the dialogue browser regression pass. Inspected `/tmp/tutorial-dialogue.png`, including the renamed Ana in the session header. The first browser attempt could not reach Vite; restarted the local server and the regression passed. Physical-headset review remains pending.

## Dialogue badge removal (2026-11-17)

At the user's request, removed the circular E/P/i badges from the dialogue card. Preserved the professional/patient/orientation text label, aligned with the phrase below it. Audio generation remains browser speech synthesis; no external speech API or credentials were added.

Badge-removal validation: inspected `/tmp/tutorial-dialogue.png`; the dialogue browser regression, 57 Node tests, TypeScript and production build pass. Physical-headset review remains pending.

## Offline Piper dialogue recordings (2026-11-17) — implemented; voice review pending

User authorized free local generation and integration. Installed Piper 1.8.0 in `/tmp/bp-piper-venv` and downloaded provisional Brazilian Portuguese Cadu/Faber models to `/tmp/bp-piper-models`. Generated 12 WAV files: common professional/patient/rest lines plus all five patient introductions. Dates are expanded into Portuguese in audio, and speaker labels are displayed rather than read aloud. Cadu voices the professional/narrator; Faber voices the patient, pending the user's listening preference. Samples: `assets/Audio/dialogue/identification-professional.wav` and `identity-ana-standard.wav`.

Runtime integration uses Web Audio decoded-buffer playback, advances on `ended`, aborts loading/stops playback on reset, and falls back to existing browser speech for failed or unmatched recordings. Dynamic learner pressure results retain browser speech; no reference value is substituted. Fixed text is shared in `src/interaction/dialoguePhrases.json`; `npm run dialogue:generate` regenerates WAVs and an exact-text manifest from it and current cases. Only recordings ship in the production app; Python, voice models and paid services are not runtime dependencies. Synthetic-voice disclosure remains in the caption footer.

Provenance and training-chain cards, dataset credits and exact model hashes are retained under `assets/Audio/dialogue/`; Cadu/rdh source cards list CC0, Faber uses a CC0 source with the CC BY 4.0 Hi-Fi TTS base (NVIDIA, reader Cori Samuel), whose attribution is preserved. These source licenses are not presented as a separate model/output license grant. See the audio README for regeneration and provenance. Physical-headset audibility and human voice-quality review remain pending.

Piper validation: TypeScript, all 57 Node tests, production build and the extended Chromium 159/SwiftShader dialogue regression pass. The browser decodes all 12 WAVs and plays a real decoded clip; it also runs the entire seven-phrase opening through the production adapter (muted and accelerated for automation) with exact subtitle order and zero speech fallbacks. Controlled-source checks cover completion, stale callbacks, missing-file failure and disposal, while existing speech-error regressions remain intact. The initial HTMLAudio prototype did not complete in headless Chrome; the final implementation uses Web Audio and passes with the ordinary isolated browser after a real start-button click. Reviewed source/license cards and generated audio metadata; no human listening or physical-headset acceptance is implied.

## Patient voice assignment and missing result announcement (2026-11-17)

User's Ana walkthrough identified a male patient voice and a final exchange in which only the patient was audible. All cases had inherited the same male Faber recording, and the professional result line still depended on unavailable/blocked browser speech. Added explicit `voiceProfile` metadata: Ana/Clara/Elisa use a Brazilian Portuguese female voice (Kokoro pf_dora); Bruno/Diego retain male Faber. Regenerated all female identity/common-reply clips, including “Obrigada” in the final reply. Male replies and professional Cadu voice are preserved.

To remove the result announcement's browser-speech dependency, generated Cadu phrase parts and numbers 0–300. The player decodes and concatenates the exact learner-recorded values into one buffer under one subtitle; after that finishes, the gender-appropriate patient reply plays. Persistent-sounds cases include the recorded suffix. No case reference values are substituted. Browser synthesis remains only a failure/unmatched-text fallback. The female voice uses free local Kokoro generation with Apache-2.0 model provenance/voice table retained; Dii was not selected because its voice/model terms are more restrictive. Nothing calls a paid service or ships model weights.

Validation for voice/result correction: all 57 Node tests, TypeScript and production build pass. Chromium 159/SwiftShader decodes all 320 bundled recordings, checks the explicit voice profile and consistent common replies for every case, and plays the complete initial conversation plus professional/patient results in both ordinary and persistent-sounds branches (muted/accelerated automation). Both final exchanges complete without browser-speech fallback, and tests change the observed systolic reading to verify the spoken result uses observations rather than the reference. Stale callback/reset checks remain green. The female voice assignment is supported by the official Kokoro voice table; human listening/physical-device voice-quality acceptance remains pending.

## Alcohol dispenser orientation (2026-11-17)

User requested that the alcohol pump face the professional rather than the table. Added `clinicalLayout.sanitizerRotationY`, aligning the imported +X pump direction with the shared learner station (+0.18 m X, +0.40 m Z from the dispenser), and applied it at model loading before surface placement. Desktop Chromium 159/SwiftShader inspection: `/tmp/sanitizer-facing-professional.png`; measured upper-pump geometry projects toward the station in X/Z, with no page exceptions. TypeScript and all 57 Node tests pass. Physical-headset reach remains untested.

Alcohol orientation: final production build passes and contains the accepted learner-facing rotation.
