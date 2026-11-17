// Instrument click regression against a running Vite server and isolated Chrome
// launched with --remote-debugging-port=9224. Uses Node 22's built-in WebSocket.
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";

const browserUrl = process.env.INSTRUMENT_BROWSER_URL ?? "http://127.0.0.1:9224";
const appUrl = process.env.INSTRUMENT_APP_URL ?? "http://127.0.0.1:3000";
const pages = await (await fetch(`${browserUrl}/json/list`)).json();
const page = pages.find(page => page.type === "page");
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener("open", resolve, { once: true }));
let sequence = 0;
const pending = new Map();
const errors = [];
socket.addEventListener("message", event => {
	const message = JSON.parse(event.data);
	if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails);
	const request = pending.get(message.id);
	if (!request) return;
	pending.delete(message.id);
	if (message.error) request.reject(new Error(JSON.stringify(message.error)));
	else request.resolve(message.result);
});
function send(method, params = {}) {
	return new Promise((resolve, reject) => {
		const id = ++sequence;
		pending.set(id, { resolve, reject });
		socket.send(JSON.stringify({ id, method, params }));
	});
}
async function evaluate(expression) {
	const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
	if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
	return result.result.value;
}
async function waitFor(expression) {
	const deadline = Date.now() + 60000;
	while (Date.now() < deadline) {
		if (await evaluate(expression)) return;
		await new Promise(resolve => setTimeout(resolve, 200));
	}
	throw new Error(`Timed out: ${expression}`);
}
async function screenshot(path) {
	await waitFor("!document.querySelector('[id^=babylonjsLoadingDiv]')");
	const { data } = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
	writeFileSync(path, Buffer.from(data, "base64"));
}

const run = fn => evaluate(`(${fn.toString()})()`);
async function click(x, y) {
	await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
	await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
	await new Promise(resolve => setTimeout(resolve, 200));
}
async function partPositions() {
	return run(async () => {
		const { Vector3, Matrix } = await import("/node_modules/@babylonjs/core/Maths/math.vector.js");
		const scene = testApp._scene;
		scene.render();
		const viewport = scene.activeCamera.viewport.toGlobal(innerWidth, innerHeight);
		return ["instrument-bulb", "instrument-valve"].map(name => {
			const part = scene.getMeshByName(name);
			part.computeWorldMatrix(true);
			const point = Vector3.Project(part.getBoundingInfo().boundingBox.centerWorld, Matrix.Identity(), scene.getTransformMatrix(), viewport);
			return { x: point.x, y: point.y };
		});
	});
}
try {
	await send("Runtime.enable");
	await send("Page.enable");
	await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
	await send("Page.navigate", { url: appUrl });
	await waitFor("!!document.querySelector('#start-button')");
	await run(async () => { window.testApp = (await import(document.querySelector('script[src*="/src/main.ts"]').src)).app; });
	await evaluate("document.querySelector('#start-button').click()");
	await waitFor("testApp.getSimulationSnapshot() !== null && !testApp._loading");
	await run(() => {
		for (let index = 0; index < 80 && testApp.getSimulationSnapshot().currentStepId !== "inflate-for-auscultation"; index++) {
			// Privileged fixture: dialogue playback is covered by dialogue.browser.mjs.
			if (["identify-patient", "check-readiness", "explain-and-rest", "inform-patient"].includes(testApp.getSimulationSnapshot().currentStepId)) {
				testApp.completeSpokenDialogue(testApp.getSimulationSnapshot().currentStepId);
				continue;
			}
			if (!testApp.getInteractionManager().executeActiveActionFromScene()) throw new Error("Preparation failed");
		}
		testApp.moveToStation("direito");
	});
	// These source-space locations were identified visually, independently of
	// control names: positive X is the dial; the rubber bulb is at positive Z.
	assert.equal(await run(() => {
		const box = testApp._scene.getMeshByName("instrument-bulb").getBoundingInfo().boundingBox;
		return box.minimum.z > 0.64 && box.maximum.x < -0.40;
	}), true, "Inflation must use the rubber bulb rather than the dial");
	const dial = await run(async () => {
		const { Vector3, Matrix } = await import("/node_modules/@babylonjs/core/Maths/math.vector.js");
		const scene = testApp._scene;
		const source = scene.getTransformNodeByName("sphygmo-root").getChildMeshes().find(mesh => mesh.metadata?.logicalTarget === "gauge");
		const point = Vector3.TransformCoordinates(new Vector3(0.89, 0.19, 0), source.getWorldMatrix());
		const screen = Vector3.Project(point, Matrix.Identity(), scene.getTransformMatrix(), scene.activeCamera.viewport.toGlobal(innerWidth, innerHeight));
		return { x: screen.x, y: screen.y };
	});
	await click(dial.x, dial.y);
	assert.equal(await evaluate("testApp.getSimulationSnapshot().instruments.cuffPressure"), 0, "Reading the dial must not inflate");
	// Repeated real mouse presses must each count, including the second press
	// Babylon classifies as a double tap. Exercise two learner viewpoints.
	for (let index = 0; index < 14; index++) {
		if (index === 7) await evaluate("testApp.moveToStation('cadeira')");
		const [bulb] = await partPositions();
		await click(bulb.x, bulb.y);
		assert.equal(await evaluate("testApp.getSimulationSnapshot().instruments.cuffPressure"), (index + 1) * 10);
	}
	const margin = await run(async () => {
		const { Vector3, Matrix } = await import("/node_modules/@babylonjs/core/Maths/math.vector.js");
		const scene = testApp._scene;
		const box = scene.getMeshByName("instrument-valve").getBoundingInfo().boundingBox;
		const p = Vector3.Project(box.centerWorld, Matrix.Identity(), scene.getTransformMatrix(), scene.activeCamera.viewport.toGlobal(innerWidth, innerHeight));
		for (let x = -16; x <= 16; x += 2) for (let y = -16; y <= 16; y += 2) {
			const hit = scene.pick(p.x + x, p.y + y);
			if (hit?.pickedMesh?.metadata?.logicalTarget !== "gauge" || !hit.pickedPoint) continue;
			if (Vector3.Distance(hit.pickedPoint, Vector3.Clamp(hit.pickedPoint, box.minimumWorld, box.maximumWorld)) < 0.012) return { x: p.x + x, y: p.y + y };
		}
		return null;
	});
	assert.ok(margin, "The valve's adjoining tube should have a testable click margin");
	await click(margin.x, margin.y);
	let [, valve] = await partPositions();
	await waitFor("testApp.isPressureDeflationActive() && testApp.getSimulationSnapshot().instruments.cuffPressure < 140");
	[, valve] = await partPositions();
	await click(valve.x, valve.y);
	assert.equal(await evaluate("testApp.isPressureDeflationPaused()"), true);
	assert.equal(await evaluate("testApp._scene.getMeshByName('instrument-bulb-label')"), null);
	assert.deepEqual(await run(async () => {
		const { clinicalLayout } = await import("/src/scene/clinicalLayout.ts");
		return ["hygiene", "mesa", "prontuario"].map(name => clinicalLayout.stations[name].position);
	}), Array(3).fill([-1.05, 1.6, -1.5]));
	assert.deepEqual(await run(async () => {
		const { nextMockEvent } = await import("/src/simulation/mockRunner.ts");
		const scene = testApp._scene;
		const source = scene.getTransformNodeByName("sphygmo-root").getChildMeshes().find(mesh => mesh.metadata?.logicalTarget === "gauge");
		const positions = source.getVerticesData("position");
		if (Math.min(...Array.from(source.getIndices(), index => positions[index * 3 + 2])) < -0.3) throw new Error("Storage cuff/hoses remain on the stand");
		const original = scene.getMeshByName("fitted-cuff-sleeve");
		const center = original.getAbsolutePosition().asArray();
		if (original.metadata.arm !== "direito" || scene.getTransformNodeByName("fitted-cuff-hoses").getChildMeshes().length !== 2) throw new Error("Fitted right-arm cuff is not connected");
		testApp.togglePressureDeflation();
		const clock = { now: () => testApp.getSimulatedTime(), advance: ms => testApp.advanceSimulatedTime(ms) };
		const manager = testApp.getInteractionManager();
		for (let index = 0; index < 150 && testApp.getCurrentSimulationAction()?.type !== "cuff-removed"; index++) {
			if (testApp.getSimulationSnapshot().currentStepId === "inform-patient") {
				testApp.completeSpokenDialogue("inform-patient");
				continue;
			}
			if (!manager.dispatchAction(nextMockEvent(testApp._simulation, clock))) throw new Error("Measurement fixture failed");
		}
		if (testApp.getCurrentSimulationAction()?.type !== "cuff-removed" || !manager.handleMeshInteraction(original)) throw new Error("Cuff removal rejected");
		if (original.isEnabled() || scene.getTransformNodeByName("fitted-cuff-hoses").isEnabled()) throw new Error("Removed cuff/hoses still visible");
		// The incoming wall panel restarts in place instead of reloading GLBs.
		// Physical parts must survive manager disposal and remain usable in both modes.
		const bulb = scene.getMeshByName("instrument-bulb");
		for (const mode of ["evaluation", "tutorial"]) {
			testApp.resetSession(mode);
			if (testApp._scene !== scene || testApp.getGuidanceMode() !== mode) throw new Error("In-place mode reset failed");
			if (!original.isEnabled() || scene.getMeshByName("instrument-bulb") !== bulb || bulb.isDisposed()) throw new Error("In-place reset destroyed the physical instrument");
			if (scene.meshes.filter(mesh => mesh.name === "instrument-valve").length !== 1) throw new Error("Duplicate instrument controls");
			for (let index = 0; index < 80 && testApp.getSimulationSnapshot().currentStepId !== "inflate-for-auscultation"; index++) {
				// Privileged fixture: dialogue playback is covered by dialogue.browser.mjs.
				if (["identify-patient", "check-readiness", "explain-and-rest", "inform-patient"].includes(testApp.getSimulationSnapshot().currentStepId)) {
					testApp.completeSpokenDialogue(testApp.getSimulationSnapshot().currentStepId);
					continue;
				}
				if (!testApp.getInteractionManager().executeActiveActionFromScene()) throw new Error("Reset preparation failed");
			}
			if (!testApp.getInteractionManager().handleMeshInteraction(bulb) || testApp.getSimulationSnapshot().instruments.cuffPressure !== 10) throw new Error("Reset bulb does not inflate");
		}
		await testApp.restartSimulation();
		const restored = testApp._scene.getMeshByName("fitted-cuff-sleeve");
		restored.computeWorldMatrix(true);
		if (!restored.isEnabled() || !testApp._scene.getTransformNodeByName("fitted-cuff-hoses").isEnabled()) throw new Error("Fitted cuff reset failed");
		if (center.some((value, index) => Math.abs(value - restored.getAbsolutePosition().asArray()[index]) > 0.0001)) throw new Error("Cuff position changed after restart");
		return { fitted: true, connected: true, removed: true, reset: true };
	}), { fitted: true, connected: true, removed: true, reset: true });
	const restartButton = await run(async () => {
		const { Vector3, Matrix } = await import("/node_modules/@babylonjs/core/Maths/math.vector.js");
		const scene = testApp._scene;
		window.panelResetScene = scene;
		const button = scene.getMeshByName("restart-panel-evaluation");
		button.computeWorldMatrix(true);
		const center = button.getBoundingInfo().boundingBox.centerWorld;
		scene.activeCamera.position.set(center.x, center.y + 0.10, center.z - 1);
		scene.activeCamera.setTarget(center);
		scene.render();
		const point = Vector3.Project(center, Matrix.Identity(), scene.getTransformMatrix(), scene.activeCamera.viewport.toGlobal(innerWidth, innerHeight));
		return { x: point.x, y: point.y };
	});
	await click(restartButton.x, restartButton.y);
	assert.equal(await evaluate("testApp.getGuidanceMode()"), "tutorial", "First panel selection only arms the restart");
	await click(restartButton.x, restartButton.y);
	await waitFor("testApp.getGuidanceMode() === 'evaluation'");
	assert.equal(await evaluate("testApp._scene === panelResetScene && !testApp._scene.getMeshByName('instrument-bulb').isDisposed()"), true);
	assert.equal(errors.length, 0, JSON.stringify(errors));
	console.log("Instrument browser checks passed: rubber bulb vs dial, 14 real clicks, single valve opening, pause, fitted cuff/hoses, removal, both in-place modes, two-click restart panel, reload, no page exceptions.");
} finally {
	socket.close();
}
