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

### B3. Show progress within repeated multi-action steps

**Observed:** Some steps require several successful actions (for example, repeated stethoscope cleaning or pressure measurement), but the guidance does not clearly show how many remain. Learners may repeat an action because they cannot tell whether it registered.

**Expected:** Guidance shows within-step progress, such as “Ação 2 de 3”, and confirms accepted actions while keeping the current step and next action clear. Failed attempts should explain what is still needed without incrementing progress.

**Acceptance:** Exercise each multi-action step, including repeated hygiene and pressure measurement; confirm progress increments exactly once per accepted action, remains stable on rejected/duplicate attempts, and reaches completion at the correct point in both desktop HUD and XR slate.

### B4. Clarify when to perform patient communication

**Clarification:** The numbered physical guidance already communicates the sequence: for example, when it shows step 8, the learner can infer that steps 5, 6, and 7 are patient communication. No additional communication timing cue is requested at this time. Keep this note as context if the step sequence or guidance presentation changes.

**Expected:** Preserve the current progress percentage and non-blocking communication model. Do not add redundant timing cues or turn dialogue into a hard prerequisite for physical actions.

**Acceptance:** Physical progress percentage and debrief timing/omission scoring remain intact. No communication timing change is currently required unless walkthroughs identify ambiguity.

### B5. Make instrument interactions and movement visible

**Observed:** Interactions advance the scenario, but objects appear stationary: the cuff is not visibly removed, the stethoscope is not picked up/placed, and the sphygmomanometer does not visibly respond during measurement.

**Expected:** Accepted actions produce clear, coherent visual feedback. The learner wears the stethoscope, so its model should leave view after earpiece placement and remain hidden; chestpiece placement is represented by interacting with the cubital area. The sphygmomanometer should be visible beside the patient, with pressure observation/recording steps available through explicit confirmation controls. Cuff visual changes are deferred.

**Asset note:** The current fitted cuff is a simple blue cylinder sketch positioned on the selected arm. The existing cuff GLB depicts folded storage cuffs, so the final fitted cuff should be modeled together with the patient rather than repurposing that folded mesh.

**Implementation:** In WebXR, pinch and carry the stethoscope near the learner's head to place the earpieces; the model then hides to represent wearing it. The model stays hidden for the rest of the session. The learner records chestpiece placement by interacting with the cubital area. Listening checks and pressure observations use explicit confirmation buttons on the desktop guidance card and XR slate. When the manometer first becomes an active target, it and the pressure readout move beside the patient's measurement arm. Cuff movement is out of scope. Emulator/headset visual confirmation is pending.

**Acceptance:** Follow the stethoscope sequence and verify it hides after earpiece placement, remains hidden through chestpiece placement, and listening checks advance through the confirmation button on desktop and XR. Confirm the sphygmomanometer and readout appear beside the patient and pressure observations advance through confirmation controls. Restart restores scene items to their initial positions. Track audio mechanics and cuff appearance separately as later work.

**Visual follow-up:** The learner-facing pressure readout and moving needle are now working. The manometer's exact position still needs tuning under B6.

### B6. Refine the sphygmomanometer's exact position — deferred

**Observed:** The manometer is now closer to the patient's arm, but its exact placement still needs visual tuning from the learner's viewpoint.

**Expected:** The manometer sits in a believable, reachable position beside the supported arm, with its face and pressure readout visible and unobstructed. Keep the current single-arm workflow; cuff visuals remain deferred.

**Acceptance:** Review the gauge from the patient station and normal approach positions in desktop and immersive views. Adjust placement/orientation until the instrument and moving pressure needle are clearly visible without intersecting the patient, furniture, or guidance panel. Capture a screenshot as evidence.

### B7. Model continuous pressure and Korotkoff sounds — in progress

**Before this change:** Pressure changed through discrete accepted actions. Inflation added 10 mmHg per action; the deflation action only validated the 2 mmHg/s rate and did not run a pressure timeline. Systolic/diastolic confirmation actions used the configured patient values directly. There were UI success/error chimes, but no Korotkoff audio.

**Implemented so far:** Added click-based +10 mmHg inflation and a learner-controlled “Iniciar deflação” choice within the 20–30 mmHg target range. Deflation advances cuff pressure at 2 mmHg/s; learners can pause it to hold a reading while recording and resume afterward. Fixed the live manometer needle/readout not updating on its first render. Systolic, diastolic, muffling, and confirmation actions capture the current gauge reading; audio and an auscultation cue are still pending. TypeScript checking and production build pass. The 2026-10-19 desktop screenshot exposed the frozen needle and unpausable timeline; both have been corrected, with another walkthrough still needed.

**Expected:** Use explicit click/tap buttons, not a hold gesture: each “Inflar +10 mmHg” press adds one increment, and the learner chooses when to press “Iniciar deflação” based on their palpated estimate. After controlled deflation starts, cuff pressure falls at 2 mmHg/s and continuously updates the visible needle. Beat-like Korotkoff sounds are synchronized with the patient's heart rate and current cuff pressure, and are audible only after the learner places the earpieces and chestpiece. “Registrar sistólica” and “Registrar diastólica” capture the pressure currently shown when the learner presses them; case values drive the simulated sound thresholds but are not filled into learner observations automatically. Provide an explicit “Liberar ar” control after the listening/confirmation range.

**Stopping points:** Recording the first sound does not stop deflation. In the usual branch, record phase V at sound disappearance, continue listening for 20–30 mmHg below it to confirm disappearance, then release the remaining air to zero. In the persistent-sounds branch, continue to zero, record the muffling pressure and zero, then release the cuff.

**Acceptance:** Verify button-controlled 10 mmHg inflation with learner-chosen stopping point, then silence above systolic, first sound at phase I, regular beats during auscultation, disappearance at phase V for ordinary cases, and the persistent-sounds branch through zero. Confirm deflation stays at 2 mmHg/s, the readout follows it, audio stops when auscultation ends or the session resets, and pressure observations come from the displayed reading. Use synthesized Web Audio transients or authored sound assets; keep them distinct from the existing UI chimes.

### B8. Enlarge the dialogue close button

**Observed:** The first physical-headset lab test found that the close button on the patient dialogue panel is difficult to target from farther away.

**Expected:** Make the close control large and easy to acquire at the normal dialogue viewing distance, while keeping its purpose visually clear and avoiding accidental activation of nearby choices.

**Acceptance:** Open and close the dialogue panel from the usual learner positions on the physical headset; confirm the target is comfortably selectable from farther away and does not overlap other controls.

### B9. Revisit hand interaction gestures

**Observed:** Pinching was difficult during the first physical-headset lab test.

**Expected:** Evaluate gesture choices per action. Consider grabbing for picking up/carrying objects and pointing or ray selection for UI and confirmation controls. Keep each interaction discoverable and consistent with its purpose; retain pinch only where it remains the clearest, reliable choice.

**Acceptance:** Try the candidate gestures on the physical headset for dialogue, panel controls, and object manipulation. Select and document the supported gesture for each action, including any accessibility or tracking limitations, then verify acquisition, release, and accidental activation behavior.

### B10. Review placement of scene equipment and panels

**Observed:** The first physical-headset lab test identified a need to review the positioning of scene elements, including the sphygmomanometer and pressure panel.

**Expected:** Place equipment and panels where they are visible, reachable, and unobstructed from the learner's normal approach and working position around the patient. Include the sphygmomanometer, pressure panel, and other frequently used controls in the review.

**Acceptance:** Walk through the complete measurement flow on the physical headset and adjust placements that are hard to see, reach, or operate. Check for occlusion, awkward reach, and collisions with the patient or furniture. Record headset and viewpoint evidence. B6's sphygmomanometer-specific positioning criteria remain applicable.

### B11. Add pressure measurement sounds

**Observed:** The first physical-headset lab test prompted a check for audible feedback during pressure measurement. The current pressure work item B7 specifies synchronized Korotkoff sounds, which are still pending.

**Expected:** Implement and verify the pressure-measurement audio described in B7, including Korotkoff beats synchronized with pressure and gated on correct stethoscope placement. Keep these clinical measurement sounds distinct from interface chimes.

**Acceptance:** Validate audible onset and disappearance at the configured pressure thresholds, synchronization during deflation, audibility through the headset, and stopping on auscultation end or session reset. Update B7 with evidence when complete.

## Suggested implementation order

1. **B1 — Dialogue panel visibility:** enlarge and validate the panel based on the first physical-headset test.
2. **B2 — Patient access and occlusion:** establish clear, repeatable positions for reaching the supported measurement arm before tuning interaction feedback and object placement.
3. **B3 — In-step progress:** make the existing multi-action progression legible on desktop and XR.
4. **B5 — Object animation:** connect accepted semantic actions to visible object state and reset behavior; build on the now-verified access and input paths.

For each actionable item, reproduce the issue, implement only that item, validate its acceptance points, and update this backlog with status and a concise evidence note before moving on. B4 is clarification-only unless future walkthroughs reveal ambiguity. Revisit dependencies if investigation shows a different order is necessary.

## Relationship to the implementation plan

These are follow-up usability and integration defects in already-integrated stages 3–5, plus visual mechanics overlapping stage 6. The simulator remains a single-arm workflow by project decision; bilateral assessment is out of scope. Synchronized Korotkoff audio, remaining asset work, and full hardware validation (stage 8) remain tracked in `IMPLEMENTATION_PLAN.md`.

## Next work session: step-by-step plan

1. **Implement the pressure timeline (B7).** Replace discrete pressure jumps during auscultation with a timed 2 mmHg/s deflation and synchronized Korotkoff events.
2. **Connect learner observations.** Record the live gauge value at first sound and disappearance; preserve the 20–30 mmHg confirmation and zero-release steps.
3. **Validate both sound branches.** Check ordinary phase V disappearance and persistent sounds through zero, including headset audio gating and reset.
4. **Refine manometer placement (B6).** Tune the exact position from the learner's view and capture evidence.
5. **Record coverage.** Note desktop browser, emulator, and headset validation separately. Cuff visuals remain deferred.

**Next task:** Add Korotkoff cues driven by the pressure timeline under B7, then validate the flow in the running scene. The pressure display and button-controlled pressure timeline are implemented; exact instrument positioning remains deferred under B6. Keep the auscultatory workflow single-arm and defer cuff visuals.
