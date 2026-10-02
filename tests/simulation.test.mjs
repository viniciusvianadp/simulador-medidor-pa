import assert from "node:assert/strict";
import { after, test } from "node:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

// Compile only the framework-free engine; no browser, XR runtime, or new dependencies.
const output = mkdtempSync(join(tmpdir(), "bp-simulation-"));
after(() => rmSync(output, { recursive: true, force: true }));
execFileSync(process.execPath, ["node_modules/typescript/bin/tsc", "--ignoreConfig", "--target", "ES2022", "--module", "ESNext", "--moduleResolution", "bundler", "--strict", "--skipLibCheck", "--outDir", output, "src/simulation/mockRunner.ts"], { stdio: "inherit" });
writeFileSync(join(output, "package.json"), '{"type":"module"}');
const load = (file) => import(pathToFileURL(join(output, file)).href);
const { SimulationController } = await load("SimulationController.js");
const { defaultConfig, auscultatoryScenario } = await load("auscultatoryScenario.js");
const { eligibleCuffs } = await load("clinicalParameters.js");
const { MockClock, nextMockEvent, runMockScenario } = await load("mockRunner.js");
const { patientCases } = await load("patientCases.js");

test("condition types reject missing expectations, unused expectations and unknown rules", () => {
	execFileSync(process.execPath, ["node_modules/typescript/bin/tsc", "--ignoreConfig", "--target", "ES2022", "--module", "ESNext", "--moduleResolution", "bundler", "--strict", "--skipLibCheck", "--noEmit", "tests/actionConditions.typecheck.ts"], { stdio: "inherit" });
});

function setup(config = defaultConfig) {
	const clock = new MockClock();
	return { clock, controller: new SimulationController(config, clock.now) };
}
function until(context, type) {
	for (let count = 0; context.controller.getCurrentAction()?.type !== type; count++) {
		assert.ok(count < 200, `Could not reach ${type}`);
		assert.equal(context.controller.dispatch(nextMockEvent(context.controller, context.clock)).accepted, true);
	}
}

test("all 26 source entries have stable unique IDs, prompts, targets and conditions", () => {
	assert.deepEqual(auscultatoryScenario.map(step => step.checklistNumber), Array.from({ length: 26 }, (_, i) => i + 1));
	assert.equal(new Set(auscultatoryScenario.map(step => step.id)).size, 26);
	for (const step of auscultatoryScenario) {
		assert.ok(step.prompt && step.targets.length && step.completionConditions.length && step.source);
		assert.ok(step.prerequisites.every(id => auscultatoryScenario.some(candidate => candidate.id === id)));
	}
});
test("ordinary path completes only applicable objectives and leaves cuff removed and empty", () => {
	const { session, elapsedMs, timeLabel } = runMockScenario();
	assert.equal(session.completed, true);
	assert.equal(session.steps["persistent-sounds"].status, "skipped");
	assert.ok(session.steps["persistent-sounds"].reason);
	assert.equal(Object.values(session.steps).filter(step => step.status === "completed").length, 25);
	assert.equal(session.instruments.cuffPressure, 0);
	assert.equal(session.instruments.cuffAttached, false);
	assert.equal(elapsedMs, 315000);
	assert.equal(timeLabel, "Tempo simulado");
});
test("persistent sounds branch occurs during deflation and records three values", () => {
	const config = patientCases.find(patient => patient.id === "diego-persistent").config;
	const { session } = runMockScenario(config);
	assert.equal(session.steps["identify-diastolic"].status, "skipped");
	assert.equal(session.steps["confirm-disappearance"].status, "skipped");
	assert.equal(session.steps["persistent-sounds"].status, "completed");
	assert.equal(session.observations["document-measurement:measurement-documented"].zero, 0);
	assert.equal(session.attempts.some(attempt => attempt.event.type === "sound-disappearance-recorded"), false);
});

const caseExpectations = {
	"ana-standard": { cuff: "adult", systolic: 118, diastolic: 66, arm: "esquerdo", zero: undefined },
	"bruno-large-cuff": { cuff: "large-adult", systolic: 158, diastolic: 94, arm: "direito", zero: undefined },
	"clara-small-cuff": { cuff: "small-adult", systolic: 96, diastolic: 58, arm: "esquerdo", zero: undefined },
	"diego-persistent": { cuff: "adult", systolic: 126, diastolic: 72, arm: "direito", zero: 0 },
	"elisa-overlap": { cuff: "infant", systolic: 110, diastolic: 70, arm: "esquerdo", zero: undefined },
};
for (const patientCase of patientCases) {
	test(`${patientCase.id}: completes with its own identity, cuff, pressure, arm and branch`, () => {
		const { session } = runMockScenario(patientCase.config);
		const expected = caseExpectations[patientCase.id];
		assert.equal(session.completed, true);
		assert.equal(session.observations["identify-patient:name-confirmed"], patientCase.config.patient.name);
		assert.equal(session.observations["identify-patient:birth-date-confirmed"], patientCase.config.patient.dateOfBirth);
		assert.equal(session.instruments.selectedCuff, expected.cuff);
		const record = session.observations["document-measurement:measurement-documented"];
		for (const field of ["systolic", "diastolic", "arm", "zero"]) assert.equal(record[field], expected[field]);
		assert.equal(session.steps["persistent-sounds"].status, expected.zero === 0 ? "completed" : "skipped");
		assert.equal(session.instruments.cuffPressure, 0);
		assert.equal(session.instruments.cuffAttached, false);
	});
	if (patientCase.id !== "ana-standard") {
		test(`${patientCase.id}: rejects Ana's identity and pressure instead of accepting default answers`, () => {
			const context = setup(patientCase.config);
			until(context, "name-confirmed");
			assert.equal(context.controller.dispatch({ type: "name-confirmed", target: "patient", value: "Ana Exemplo" }).accepted, false);
			until(context, "birth-date-confirmed");
			assert.equal(context.controller.dispatch({ type: "birth-date-confirmed", target: "patient", value: "1980-05-12" }).accepted, false);
			until(context, "first-sound-recorded");
			assert.equal(context.controller.dispatch({ type: "first-sound-recorded", target: "gauge", value: 118 }).accepted, false);
			until(context, "measurement-documented");
			const event = nextMockEvent(context.controller, context.clock);
			assert.equal(context.controller.dispatch({ ...event, value: { ...event.value, systolic: 118, diastolic: 66 } }).accepted, false);
		});
	}
}
test("overlap patient accepts either table-listed cuff through the controller", () => {
	for (const cuff of ["infant", "small-adult"]) {
		const context = setup(patientCases.find(patient => patient.id === "elisa-overlap").config);
		until(context, "cuff-selected");
		assert.equal(context.controller.dispatch({ type: "cuff-selected", target: "cuffs", value: cuff }).accepted, true);
		assert.equal(context.controller.getSnapshot().instruments.selectedCuff, cuff);
	}
});
test("restarting a non-default patient preserves its case configuration", () => {
	const config = patientCases.find(patient => patient.id === "bruno-large-cuff").config;
	const context = setup(config);
	until(context, "measurement-documented");
	context.controller.restart();
	assert.deepEqual(context.controller.getSnapshot().config, config);
	assert.deepEqual(context.controller.getSnapshot().attempts, []);
});
test("unrelated, wrong-target and repeated events cannot bypass prerequisites", () => {
	const { controller } = setup();
	assert.equal(controller.dispatch({ type: "cuff-removed", target: "cuff", value: true }).accepted, false);
	assert.equal(controller.dispatch({ type: "hand-hygiene-performed", target: "cuff", value: true }).accepted, false);
	const hygiene = { type: "hand-hygiene-performed", target: "hygiene-station", value: true };
	assert.equal(controller.dispatch(hygiene).accepted, true);
	assert.equal(controller.dispatch(hygiene).accepted, false);
	assert.equal(controller.getSnapshot().currentStepId, "disinfect-stethoscope");
	assert.equal(controller.getSnapshot().attempts.length, 4);
});
test("all four hygiene occurrences require a new action", () => {
	const { session } = runMockScenario();
	const hygiene = session.attempts.filter(attempt => attempt.event.type === "hand-hygiene-performed");
	assert.equal(hygiene.length, 4);
	assert.equal(new Set(hygiene.map(attempt => attempt.stepId)).size, 4);
});
test("identity and readiness reject incorrect values without losing partial completion", () => {
	const context = setup();
	until(context, "birth-date-confirmed");
	assert.equal(context.controller.dispatch({ type: "birth-date-confirmed", target: "patient", value: "1900-01-01" }).accepted, false);
	assert.equal(context.controller.getSnapshot().steps["identify-patient"].status, "active");
	until(context, "exercise-history-checked");
	assert.equal(context.controller.dispatch({ type: "exercise-history-checked", target: "patient", value: 59 }).accepted, false);
});
test("quiet rest cannot finish before five minutes", () => {
	const context = setup();
	until(context, "quiet-rest-finished");
	const event = { type: "quiet-rest-finished", target: "patient", value: true };
	context.clock.advance(299999);
	assert.equal(context.controller.dispatch(event).accepted, false);
	context.clock.advance(1);
	assert.equal(context.controller.dispatch(event).accepted, true);
});
test("post-estimation wait enforces both endpoints", () => {
	for (const [elapsed, expected] of [[14999, false], [15000, true], [30000, true], [30001, false]]) {
		const context = setup();
		until(context, "estimation-wait-finished");
		context.clock.advance(elapsed);
		assert.equal(context.controller.dispatch({ type: "estimation-wait-finished", target: "cuff", value: true }).accepted, expected);
	}
});
test("cuff policy preserves overlap and does not extrapolate table gaps", () => {
	assert.deepEqual(eligibleCuffs(21), ["infant", "small-adult"]);
	assert.deepEqual(eligibleCuffs(26.5), []);
	assert.deepEqual(eligibleCuffs(NaN), []);
	const context = setup();
	until(context, "cuff-selected");
	const result = context.controller.dispatch({ type: "cuff-selected", target: "cuffs", value: "child" });
	assert.equal(result.accepted, false);
	assert.match(result.feedback, /Tabela 1/);
	assert.equal(context.controller.getSnapshot().instruments.selectedCuff, null);
});
test("inflation validates increments and deflation rate", () => {
	const context = setup();
	until(context, "rapid-inflation-increment");
	assert.equal(context.controller.dispatch({ type: "rapid-inflation-increment", target: "cuff", value: 140 }).accepted, false);
	assert.equal(context.controller.getSnapshot().instruments.cuffPressure, 0);
	until(context, "deflation-started");
	assert.equal(context.controller.getSnapshot().instruments.cuffPressure, 140);
	assert.equal(context.controller.dispatch({ type: "deflation-started", target: "cuff", value: 3 }).accepted, false);
});
test("confirmation must precede releasing air", () => {
	const context = setup();
	until(context, "disappearance-confirmed");
	assert.equal(context.controller.dispatch({ type: "remaining-air-released", target: "cuff", value: 0 }).accepted, false);
	assert.equal(context.controller.dispatch({ type: "disappearance-confirmed", target: "stethoscope", value: 47 }).accepted, false);
	assert.equal(context.controller.dispatch({ type: "disappearance-confirmed", target: "stethoscope", value: 46 }).accepted, true);
});
test("final documentation is mandatory and exact readings and metadata are validated", () => {
	const context = setup();
	until(context, "measurement-documented");
	assert.equal(context.controller.getSnapshot().completed, false);
	const event = nextMockEvent(context.controller, context.clock);
	for (const change of [{ systolic: 120 }, { professional: "" }, { performed: false }, { arm: "direito" }, { dateTime: "invalid" }, { position: "deitado" }]) {
		assert.equal(context.controller.dispatch({ ...event, value: { ...event.value, ...change } }).accepted, false);
	}
	assert.equal(context.controller.dispatch(event).accepted, true);
	assert.equal(context.controller.getSnapshot().completed, true);
	assert.equal(context.controller.dispatch(event).accepted, false);
});
test("persistent branch rejects missing zero", () => {
	const context = setup({ ...defaultConfig, persistentSounds: true });
	until(context, "three-values-recorded");
	const event = nextMockEvent(context.controller, context.clock);
	delete event.value.zero;
	assert.equal(context.controller.dispatch(event).accepted, false);
});
test("restart resets timers, observations, instruments, attempts and branch decisions", () => {
	const context = setup({ ...defaultConfig, persistentSounds: true });
	const initial = context.controller.getSnapshot();
	until(context, "measurement-documented");
	context.controller.restart();
	assert.deepEqual(context.controller.getSnapshot(), initial);
	until(context, "quiet-rest-finished");
	context.controller.restart();
	assert.deepEqual(context.controller.getSnapshot(), initial);
});
test("snapshot and input mutation cannot alter session state", () => {
	const config = structuredClone(defaultConfig);
	const { controller } = setup(config);
	config.patient.name = "Changed";
	const snapshot = controller.getSnapshot();
	snapshot.steps["initial-hand-hygiene"].status = "completed";
	assert.equal(controller.getSnapshot().steps["initial-hand-hygiene"].status, "active");
	assert.equal(controller.getSnapshot().config.patient.name, defaultConfig.patient.name);
});
