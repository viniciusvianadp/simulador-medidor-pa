# Scenario engine (implementation plan, step 1)

This framework-free TypeScript module represents all 26 checklist entries from `references/checklist PA 2026.pdf` (revision 04/03/2026) for a single-arm measurement. It does not yet orchestrate the new bilateral first-assessment requirement. It does not yet connect to the scene or change the existing XR prototype.

## Run

```sh
npm test
npm run simulation:mock
```

Both commands use the installed TypeScript compiler and Node's built-in facilities, with no additional dependencies. Compiled files go into a temporary directory and are removed after execution. Tests compile the engine in strict mode and verify invalid condition definitions fail type checking. The mock command runs all five patient cases and prints their results, explicitly labeled **Tempo simulado**.

## Parameter sources and patient cases

| Source | Responsibility |
| --- | --- |
| `clinicalParameters.ts` | PDF-derived timings, thresholds, materials, cuff table and source references. |
| `patientCases.ts` | Fictional patient identities, arm circumferences, pressures, measured arms and sound-persistence flags. Also supplies `defaultConfig` (Ana). |
| `auscultatoryScenario.ts` | Ordered actions, Portuguese prompts, targets and typed validation conditions. |
| `mockRunner.ts` | Sample submitted values, simulated elapsed time, fixed documentation timestamp and fictional professional identity. |
| `SimulationController.ts` | Checks submissions against the selected case, clinical requirements and session state. |

The cases are engineering fixtures that exercise different inputs; they are not diagnoses or validated clinical histories. Ana's 118/66 values match the PDF's example; the other pressures are deliberately chosen fixture values.

| Case ID | Fictional patient | Arm circumference | Pressure (mmHg) | Arm | Purpose |
| --- | --- | --- | --- | --- | --- |
| `ana-standard` | Ana Exemplo | 30 cm | 118/66 | Left | Adult cuff, ordinary path |
| `bruno-large-cuff` | Bruno Exemplo | 40 cm | 158/94 | Right | Large adult cuff, higher pressure values |
| `clara-small-cuff` | Clara Exemplo | 24 cm | 96/58 | Left | Small adult cuff, lower pressure values |
| `diego-persistent` | Diego Exemplo | 33 cm | 126/72/0 | Right | Persistent sounds; 72 is the muffling observation |
| `elisa-infant-cuff` | Elisa Exemplo | 21 cm | 110/70 | Left | Infant cuff only; former small-adult overlap removed in 2026 |

Select a case explicitly, or supply a complete custom `ScenarioConfig`:

```ts
import { patientCases } from "./patientCases.js";
import { SimulationController } from "./SimulationController.js";

const selected = patientCases.find(patient => patient.id === "bruno-large-cuff");
if (!selected) throw new Error("Caso não encontrado.");
const controller = new SimulationController(selected.config);
```

Each case has full-path tests. Non-default cases also reject Ana's identity and pressure values. Restart preserves the selected case while clearing session progress. These fixtures vary the fields currently supported by the engine; additional medical histories or readiness complications need additional scenario modeling.

## Typed conditions

`ValidationRule` is a closed string-literal union. `ActionCondition` is a discriminated union, so `rule` determines whether an `expected` field is permitted. An enum alone would restrict rule names but would not enforce this relationship.

```ts
{ rule: "equals", expected: 0 } // Literal comparison; expected is required.
{ rule: "systolic" }            // Read the pressure from the selected case.
{ rule: "offset" }              // Read the range from clinicalParameters.
```

The action helper now takes a single condition object as its fourth argument. Omission still means `{ rule: "equals", expected: true }`. Supplying `expected` to a derived rule, omitting it from equality, or misspelling a rule is a type error. Equality only accepts primitive values; arrays and records have dedicated validators.

The controller and mock runner exhaustively handle the union: adding a rule requires implementing both validation and mock input generation. Mock values are generated explicitly per rule. Equality fixtures use their required literal comparison value; other rules carry no sample values in scenario definitions. For example, the materials mock supplies `requiredMaterials` directly, while the materials validator checks that the submitted list contains all required items.

## Integration contract

```ts
import { SimulationController } from "./SimulationController.js";

const controller = new SimulationController();
const action = controller.getCurrentAction(); // prompt, target, corrective feedback
const result = controller.dispatch({
	type: "hand-hygiene-performed",
	target: "hygiene-station",
	value: true,
});
const session = controller.getSnapshot();
controller.restart();
```

The controller uses a monotonic clock (`performance.now`) by default. Pass a clock function to control time in tests. Each accepted action satisfies one ordered condition; an entire checklist step may require several conditions. Inflation accepts successive 10 mmHg increments until the target range is reached. Wrong targets, incorrect values, duplicate actions, and out-of-order actions are logged without advancing progress. Snapshots, initial configuration, and stored event payloads are copied to prevent external mutation.

`chestpiece-placed` accepts `"bell"` or `"diaphragm"` after palpation; it replaces the old boolean `bell-placed` event. The stable step ID `place-bell` is retained. Placement adapters must verify absence of excessive compression before submitting either value.

Logical target IDs refer to future mesh/zone adapters, not current mesh names. Future adapters should dispatch completed, observed interactions: for example, `chestpiece-disinfected` means that the cotton/alcohol interaction actually occurred. Boolean conditions represent validated gestures or explicit dialogue selections, not a generic “next” button. Readiness events report elapsed minutes since **any** of the listed activities/substances. The `arm-supported` condition includes a bare arm supported at heart level.

The mock fixtures are privileged: they read the expected patient/pressure configuration to supply correct answers. Keep them out of the learner interface. Learner observations and final documentation are stored separately from the expected pressure values. `getSnapshot()` is an internal integration/debug API and includes answer data.

## Branches and timing

After checklist item 19, the configured ordinary path follows items 20–21 and skips 22 with a reason. The persistent-sounds path instead observes muffling and persistence to zero in item 22, skipping the disappearance-specific items 20–21. Both rejoin at item 23. This is one measurement, not a second measurement appended after full deflation.

Rest starts only after explanation, silence instructions, and questions are addressed. Its minimum is five minutes. The post-estimation timer starts only after full air release and requires at least 60 seconds. The revised source supplies no maximum, so a longer wait does not invalidate the session. Restart clears all attempts, observations, instrument state, timers, and branch decisions while retaining the original scenario configuration.

Pressure changes here are discrete mock observations. Continuous valve dynamics, deflation-rate monitoring, interruption of quiet rest, pulse/audio synchronization, and XR placement geometry are later implementation steps. The future measurement adapter must validate ongoing conditions before emitting these semantic events. No clinical tolerance for inaccurate readings has been invented: configured exact values are required in this foundational runner.

## Source and policy decisions

`clinicalParameters.ts` transcribes timings, ranges, cuff dimensions, and supporting hygiene content from the local PDF. `auscultatoryScenario.ts` retains source checklist numbers alongside stable IDs and Portuguese prompts. No clinical validation beyond source transcription is claimed.

Cuff selection accepts either table-listed size in the shared 6 cm boundary (newborn/child). It does not interpolate across gaps (for example, 26.5 cm) or silently apply the supporting 40% width / 80% length guidance to override table ranges. The PDF's table and proportional guidance may not agree for every circumference; this policy requires subject-matter review before teaching use. Default circumference is 30 cm. Unsupported circumference values are rejected at configuration time.

The mock pressure configuration requires finite systolic > diastolic values and diastolic >= 20 mmHg so the ordinary confirmation interval is representable. This is an implementation constraint, not an additional clinical threshold. Patient and professional identities in the fixtures are fictional.

## Verification

Tests cover both complete paths, all checklist entries, prerequisites and ordering, wrong targets, repeated hygiene, identity/readiness, timer boundaries, cuff overlap/gaps, inflation increments, deflation rate, disappearance confirmation, mandatory exact documentation, reset, and snapshot isolation. Browser rendering and XR hardware are outside this engine-only verification.


## 2026 migration scope

Readiness now requires 90 minutes without exercise/walking/physiotherapy; the intake/smoking interval remains 30 minutes. The post-estimation wait is one minute, bringing the ordinary mock's simulated waiting time to 360,000 ms (five-minute rest plus one-minute post-estimation wait). This is not the total real procedure duration. All seven updated cuff ranges and bladder dimensions are in `clinicalParameters.ts`, including Coxa (45–52 cm). Elisa's renamed `elisa-infant-cuff` case verifies the removed 21 cm overlap.

`supportingContent.firstAssessment` and `clinicalParameters.betweenMeasurements` preserve the new requirement to measure both arms at the first assessment, wait at least one minute between measurements, compare results, and retain the higher-pressure reference arm. **The current controller still represents one arm only.** Bilateral orchestration, per-arm fixtures/records, interval enforcement across measurements, and reference-arm selection are pending tasks in implementation-plan stages 1 and 5–7. Existing menu cases and mocks must not be treated as complete first assessments. Tie/discordant-arm comparison policy is not supplied by the PDF and must be resolved before automatic scoring.

`supportingContent.officeClassification` stores a literal transcription of Table 2 for office measurements from age 18. The stage-3 diastolic cell prints `110` without a comparison sign (verified visually in the PDF). No classifier or classification scoring has been added; the adjacent clarification note must accompany any future display until the source is clarified.
