// Tracked-hand instrument regression against a running Vite server and isolated Chrome
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
try {
	await send("Runtime.enable");await send("Page.enable");
	await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
	await send("Page.navigate", { url: appUrl });
	await waitFor("!!document.querySelector('#start-button')");
	await run(async () => { window.testApp = (await import(document.querySelector('script[src*="/src/main.ts"]').src)).app; });
	await evaluate("document.querySelector('#start-button').click()");
	await waitFor("testApp.getSimulationSnapshot() !== null && !testApp._loading");
	await run(() => testApp.resetSession("evaluation"));
	assert.equal(await run(() => {
		const scene = testApp._scene;scene.render();
		const patient = scene.getTransformNodeByName("patient-root");
		const icon = scene.getMeshByName("patient-dialogue-trigger");
		icon.computeWorldMatrix(true);
		const gap = icon.getBoundingInfo().boundingBox.minimumWorld.y - patient.getHierarchyBoundingVectors(true).max.y;
		const manager = testApp.getInteractionManager();
		manager.handleMeshInteraction(patient.getChildMeshes()[0]);
		if (manager._dialogueOpen) throw new Error("Body click opened conversation");
		if (!manager.handleMeshInteraction(icon) || !manager._dialogueOpen) throw new Error("Overhead dialogue trigger failed");
		manager.closeDialogueModal();
		return gap > 0.10;
	}), true, "Conversation trigger must remain above the head after animation updates");
	await run(() => {
		for (let index = 0; index < 80 && testApp.getSimulationSnapshot().currentStepId !== "inflate-for-auscultation"; index++) {
			if (!testApp.getInteractionManager().executeActiveActionFromScene()) throw new Error("Preparation failed");
		}
		testApp.moveToStation("direito");
	});
	assert.deepEqual(await run(async () => {
		const { TransformNode } = await import("/node_modules/@babylonjs/core/Meshes/transformNode.js");
		const { Quaternion, Vector3 } = await import("/node_modules/@babylonjs/core/Maths/math.vector.js");
		const { classifyGrip } = await import("/src/interaction/gripGesture.ts");
		const scene = testApp._scene, manager = testApp.getInteractionManager();
		const bulb = scene.getMeshByName("instrument-bulb");
		const center = mesh => { mesh.computeWorldMatrix(true);return mesh.getBoundingInfo().boundingBox.centerWorld.clone(); };
		const dock = center(bulb);
		const left = new TransformNode("test-left-wrist", scene);
		const right = new TransformNode("test-right-wrist", scene);
		left.position.copyFrom(dock);right.position.copyFrom(dock);
		const tight = classifyGrip(Array(4).fill(0.03), 0.08);
		const relaxed = classifyGrip(Array(4).fill(0.07), 0.08);
		const open = classifyGrip(Array(4).fill(0.11), 0.08);
		let now = performance.now();
		const frame = (handId, wrist, gesture, indexTip = null, indexExtended = false) => {
			now += 40;
			return manager.handleInstrumentHandFrame({ handId, wrist, palm: wrist ? (wrist.computeWorldMatrix(true), wrist.getAbsolutePosition().clone()) : center(bulb), gesture, indexTip, indexExtended, now });
		};
		frame("left", left, classifyGrip(Array(4).fill(0.06), 0.08), null, true);
		if (scene.getTransformNodeByName("held-bulb-root")) throw new Error("Pointing hand acquired bulb");
		frame("left", left, tight);
		if (!scene.getTransformNodeByName("held-bulb-root") || testApp.getSimulationSnapshot().instruments.cuffPressure !== 0) throw new Error("Pickup must hold without pumping");
		const cap = scene.getMeshByName("instrument-bulb-cap");
		if (cap.parent.name !== "held-bulb-root" || scene.getMeshByName("instrument-valve-body").parent.name !== "held-bulb-root") throw new Error("Bulb assembly did not travel together");
		const hose = scene.getMeshByName("fitted-cuff-hose-1");
		const hoseBefore = Array.from(hose.getVerticesData("position"));
		left.position.addInPlace(new Vector3(0.10, 0.12, 0.04));
		frame("left", left, tight);
		scene.render();scene.render();
		const moved = center(bulb).subtract(dock);
		if (Vector3.Distance(moved, new Vector3(0.10, 0.12, 0.04)) > 0.001) throw new Error("Bulb does not follow wrist: " + JSON.stringify({ moved: moved.asArray(), dock: dock.asArray(), center: center(bulb).asArray() }));
		if (!Array.from(hose.getVerticesData("position")).some((value, index) => Math.abs(value - hoseBefore[index]) > 0.001)) throw new Error("Held hose endpoint stayed at stand");
		const scale = bulb.absoluteScaling.clone();
		left.scaling.setAll(0.012);
		frame("left", left, tight);bulb.computeWorldMatrix(true);
		if (!bulb.absoluteScaling.equalsWithEpsilon(scale, 0.0001)) throw new Error("Joint radius resized the held bulb");
		left.rotationQuaternion = Quaternion.RotationAxis(Vector3.Up(), 0.4);
		frame("left", left, tight);
		if (!center(bulb).equalsWithEpsilon(left.getAbsolutePosition(), 0.0001)) throw new Error("Wrist rotation moved bulb out of palm");
		frame("right", right, tight);
		if (scene.getTransformNodeByName("held-bulb-root").metadata.ownerHandId !== "left") throw new Error("Second hand stole bulb");
		frame("left", left, relaxed);frame("left", left, tight);frame("left", left, tight);
		if (testApp.getSimulationSnapshot().instruments.cuffPressure !== 10) throw new Error("Squeeze cycle was missed or duplicated");
		window.handFixture = { scene, manager, bulb, left, right, dock, tight, relaxed, open, center, frame, getNow: () => now, setNow: value => now = value };
		return { acquired: true, carried: true, hose: true, exclusive: true, squeeze: 10 };
	}), { acquired: true, carried: true, hose: true, exclusive: true, squeeze: 10 });
	// A pumping fist can also form a tracked pinch. Its ray must not count twice.
	const target = await run(async () => {
		const { Vector3, Matrix } = await import("/node_modules/@babylonjs/core/Maths/math.vector.js");
		const scene = testApp._scene;scene.render();
		const p = Vector3.Project(handFixture.center(handFixture.bulb), Matrix.Identity(), scene.getTransformMatrix(), scene.activeCamera.viewport.toGlobal(innerWidth, innerHeight));
		return { x: p.x, y: p.y };
	});
	for (const type of ["mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x: target.x, y: target.y, button: "left", clickCount: 1 });
	assert.equal(await evaluate("testApp.getSimulationSnapshot().instruments.cuffPressure"), 10, "Ray pick on held bulb must not add another pump");
	assert.deepEqual(await run(() => {
		const f = handFixture;
		const { scene, manager, bulb, left, right, dock, tight, relaxed, open, center, frame } = f;
		for (let index = 0; index < 13; index++) { frame("left", left, relaxed);frame("left", left, tight); }
		if (testApp.getSimulationSnapshot().instruments.cuffPressure !== 140) throw new Error("Held pumping did not reach target");
		const valve = scene.getMeshByName("instrument-valve");
		const near = () => center(valve);
		const away = () => near().addInPlace(near().set(0.15, 0, 0));
		frame("right", right, open, near(), true);
		if (!testApp.isPressureDeflationActive() || testApp.isPressureDeflationPaused()) throw new Error("Free-hand valve touch did not start deflation");
		for (let index = 0; index < 4; index++) frame("right", right, open, near(), true);
		if (testApp.isPressureDeflationPaused()) throw new Error("Sustained contact toggled valve repeatedly");
		frame("right", right, open, away(), true);frame("right", right, open, near(), true);
		if (!testApp.isPressureDeflationPaused()) throw new Error("Withdraw/re-touch did not pause");
		frame("left", left, tight, near(), true);
		if (!testApp.isPressureDeflationPaused()) throw new Error("Holding hand accidentally operated valve");
		frame("left", left, open);f.setNow(f.getNow() + 360);frame("left", left, open);
		if (scene.getTransformNodeByName("held-bulb-root") || !center(bulb).equalsWithEpsilon(dock, 0.0001)) throw new Error("Open-hand release did not restore dock");
		frame("right", right, open);frame("right", right, tight);
		if (scene.getTransformNodeByName("held-bulb-root")?.metadata.ownerHandId !== "right") throw new Error("Right hand could not pick up after release");
		manager.handleInstrumentHandLost("right");
		if (scene.getTransformNodeByName("held-bulb-root") || !center(bulb).equalsWithEpsilon(dock, 0.0001)) throw new Error("Lost-hand release failed");
		left.position.copyFrom(dock);
		frame("left", left, open);frame("left", left, tight);
		if (!scene.getTransformNodeByName("held-bulb-root")) throw new Error("Reacquisition before tracking test failed");
		f.setNow(f.getNow() + 100);frame("left", null, { tracked: false, grab: false, tight: false, relaxed: false, open: false });
		if (!scene.getTransformNodeByName("held-bulb-root")) throw new Error("Brief tracking gap dropped bulb");
		f.setNow(f.getNow() + 260);frame("left", null, { tracked: false, grab: false, tight: false, relaxed: false, open: false });
		if (scene.getTransformNodeByName("held-bulb-root")) throw new Error("Sustained tracking loss left bulb attached");
		frame("left", left, open);frame("left", left, tight);
		testApp.resetSession("evaluation");
		if (testApp._scene !== scene || scene.getTransformNodeByName("held-bulb-root") || bulb.isDisposed()) throw new Error("In-place reset while holding lost instrument");
		if (testApp.getSimulationSnapshot().instruments.cuffPressure !== 0 || scene.meshes.filter(mesh => mesh.name === "instrument-bulb").length !== 1) throw new Error("Reset duplicated bulb/progress");
		const restored = center(bulb);
		if (!restored.equalsWithEpsilon(dock, 0.0001)) throw new Error("Reset changed dock position");
		left.dispose();right.dispose();
		return { pumping: 140, valveTouch: true, release: true, bothHands: true, trackingLoss: true, heldReset: true };
	}), { pumping: 140, valveTouch: true, release: true, bothHands: true, trackingLoss: true, heldReset: true });
	assert.equal(errors.length, 0, JSON.stringify(errors));
	console.log("Hand instrument checks passed: overhead dialogue, exclusive pickup, carried assembly/hoses, grip cycles, ray suppression, free-hand valve contact, both hands, release/tracking loss, held reset.");
} finally {socket.close();}
