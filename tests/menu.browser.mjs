// Optional integration check against a running Vite server and an isolated Chrome
// launched with --remote-debugging-port=9223. Uses Node 22's built-in WebSocket.
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";

const browserUrl = process.env.MENU_BROWSER_URL ?? "http://127.0.0.1:9223";
const appUrl = process.env.MENU_APP_URL ?? "http://127.0.0.1:3000";
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

try {
	await send("Runtime.enable");
	await send("Page.enable");
	await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
	await send("Page.navigate", { url: appUrl });
	await waitFor("!!document.querySelector('#start-button')");
	await evaluate("import('/src/main.ts').then(module => { window.testApp = module.app; })");
	assert.equal(await evaluate("testApp.getSimulationSnapshot()"), null);
	assert.equal(await evaluate("document.documentElement.lang"), "pt-BR");
	assert.equal(await evaluate("document.querySelector('#patient-select').options.length"), 5);
	await screenshot("/tmp/projeto-xr-menu-desktop.png");
	await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
	assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
	await screenshot("/tmp/projeto-xr-menu-mobile.png");
	await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
	await evaluate("document.querySelector('#patient-select').value = 'bruno-large-cuff'; document.querySelector('#start-button').click(); document.querySelector('#start-button').click()");
	await waitFor("!document.querySelector('.session-bar').hidden && !document.querySelector('#restart-button').disabled");
	assert.equal(await evaluate("testApp.getSimulationSnapshot().config.patient.name"), "Bruno Exemplo");
	assert.equal(await evaluate("document.activeElement.id"), "session-title");
	assert.equal(await evaluate("testApp._scene.metadata.clinicalRoom.units"), "meters");
	assert.equal(await evaluate("!!testApp._scene.getMeshByName('patient-forearm-esquerdo') && !!testApp._scene.getMeshByName('patient-forearm-direito')"), true);
	assert.equal(await evaluate("!!testApp._scene.getTransformNodeByName('patient-root')"), true);
	assert.ok(await evaluate("testApp._scene.getMeshByName('patient_Object_2')?.getTotalVertices() > 0"));
	assert.equal(await evaluate("testApp._scene.getMeshByName('patient_Object_2')?.metadata.logicalTarget"), "patient");
	assert.ok(await evaluate("testApp._scene.getMeshByName('ground').getTotalVertices() > 0"));
	assert.equal(await evaluate("testApp._scene.meshes.some(mesh => mesh.name === 'box')"), false);
	assert.equal(await evaluate("testApp._scene.meshes.filter(mesh => mesh.getTotalVertices() === 0).length"), 0);
	// Every storage cuff must fit its supporting tray and retain its clinical ID.
	assert.deepEqual(await evaluate("testApp._scene.transformNodes.filter(n => n.parent?.name === 'cuff-set').map(n => n.metadata.cuffId)"),
		["newborn", "child", "infant", "small-adult", "adult", "large-adult", "thigh"]);
	assert.equal(await evaluate(`(() => {
		const scene = testApp._scene;
		const tray = scene.getMeshByName('chair_Object_8');
		tray.computeWorldMatrix(true);
		const surface = tray.getBoundingInfo().boundingBox;
		const roots = scene.transformNodes.filter(n => n.parent?.name === 'cuff-set');
		const footprints = roots.map(root => root.getHierarchyBoundingVectors(true));
		return roots.every((root, index) => {
			const b = footprints[index];
			const fabric = scene.getMeshByName(root.name + '-fabric');
			return fabric.getTotalVertices() === 466 && fabric.isPickable &&
				fabric.metadata.cuffId === root.metadata.cuffId &&
				b.min.x >= surface.minimumWorld.x && b.max.x <= surface.maximumWorld.x &&
				b.min.z >= surface.minimumWorld.z && b.max.z <= surface.maximumWorld.z &&
				Math.abs(fabric.getBoundingInfo().boundingBox.minimumWorld.y - surface.maximumWorld.y - 0.002) < 0.0001 &&
				footprints.every((other, j) => j === index || b.max.x <= other.min.x || b.min.x >= other.max.x || b.max.z <= other.min.z || b.min.z >= other.max.z);
		});
	})()`), true, "Cuff geometry/tags must rest on the tray without overlapping or losing selection metadata");
	// Exercise real keyboard navigation, then restore the learner's initial view.
	await evaluate("window.startCameraPosition = testApp._scene.activeCamera.position.clone(); document.querySelector('#canvas').focus()");
	await send("Input.dispatchKeyEvent", { type: "keyDown", key: "w", code: "KeyW", windowsVirtualKeyCode: 87 });
	await waitFor("testApp._scene.activeCamera.position.subtract(startCameraPosition).length() > 0.02");
	await send("Input.dispatchKeyEvent", { type: "keyUp", key: "w", code: "KeyW", windowsVirtualKeyCode: 87 });
	assert.equal(await evaluate("testApp._scene.activeCamera.position.y"), 1.6, "Looking down must not make walking change eye height");
	await evaluate("testApp._scene.activeCamera.cameraDirection.setAll(0); testApp._scene.activeCamera.position.copyFrom(startCameraPosition)");
	await evaluate("testApp._scene.activeCamera._collideWithWorld(new startCameraPosition.constructor(5, 0, 0))");
	assert.ok(await evaluate("testApp._scene.activeCamera.position.x > 2 && testApp._scene.activeCamera.position.x < 2.13"), "Camera must stop inside the right wall");
	await evaluate("testApp._scene.activeCamera.position.copyFrom(startCameraPosition)");
	// Walking towards the treatment chair must stop before penetrating the chair volume.
	await evaluate("testApp._scene.activeCamera.position.set(-1.19, 1.6, 0.0)");
	await evaluate("testApp._scene.activeCamera._collideWithWorld(new startCameraPosition.constructor(0, 0, -1.5))");
	assert.ok(await evaluate("testApp._scene.activeCamera.position.z > -0.85"), "Camera must collide with the chair and not walk through it");
	await evaluate("testApp._scene.activeCamera.position.copyFrom(startCameraPosition)");
	await evaluate("window.originalScene = testApp._scene; window.originalPosition = originalScene.getMeshByName('tray').position.clone(); testApp.dispatchSimulationEvent({type:'hand-hygiene-performed', target:'hygiene-station', value:true}); originalScene.getMeshByName('tray').position.x += 5");
	assert.equal(await evaluate("testApp.getSimulationSnapshot().attempts.length"), 1);
	await evaluate("document.querySelector('#restart-button').click()");
	await waitFor("!document.querySelector('#restart-button').disabled");
	assert.equal(await evaluate("testApp.getSimulationSnapshot().config.patient.name"), "Bruno Exemplo");
	assert.equal(await evaluate("testApp.getSimulationSnapshot().attempts.length"), 0);
	assert.equal(await evaluate("testApp.getSimulationSnapshot().currentStepId"), "initial-hand-hygiene");
	assert.equal(await evaluate("originalScene.isDisposed && testApp._scene !== originalScene"), true);
	assert.equal(await evaluate("testApp._scene.getMeshByName('tray').position.equalsWithEpsilon(originalPosition)"), true);
	assert.deepEqual(await evaluate("testApp.getSimulationSnapshot().instruments"), { cuffPressure: 0, cuffAttached: false, selectedCuff: null });
	await screenshot("/tmp/projeto-xr-session.png");
	await evaluate("window.restartedScene = testApp._scene; document.querySelector('#back-button').click()");
	assert.equal(await evaluate("testApp.getSimulationSnapshot()"), null);
	assert.equal(await evaluate("restartedScene.isDisposed"), true);
	assert.equal(await evaluate("document.activeElement.id"), "start-button");
	await evaluate("document.querySelector('#patient-select').value = 'diego-persistent'; document.querySelector('#start-button').click()");
	await waitFor("!document.querySelector('.session-bar').hidden && !document.querySelector('#restart-button').disabled");
	assert.equal(await evaluate("testApp.getSimulationSnapshot().config.persistentSounds"), true);
	assert.equal(await evaluate("testApp.getSimulationSnapshot().config.patient.name"), "Diego Exemplo");
	await send("Emulation.setDeviceMetricsOverride", { width: 800, height: 600, deviceScaleFactor: 1, mobile: false });
	await waitFor("Math.abs(testApp._engine.getRenderWidth() - 800) < 2");
	await evaluate("document.querySelector('#back-button').click()");
	// Exercise actual scene-load failure and retry without changing application code.
	await send("Network.enable");
	await send("Network.setBlockedURLs", { urls: ["*doctors_office.glb*"] });
	await evaluate("document.querySelector('#start-button').click()");
	await waitFor("document.querySelector('#menu-status').textContent.includes('Não foi possível') && !document.querySelector('#start-button').disabled");
	assert.equal(await evaluate("testApp.getSimulationSnapshot()"), null);
	assert.equal(await evaluate("testApp._scene"), null);
	assert.equal(await evaluate("document.querySelector('.start-menu').hidden"), false);
	await send("Network.setBlockedURLs", { urls: [] });
	await evaluate("document.querySelector('#start-button').click()");
	await waitFor("!document.querySelector('.session-bar').hidden && !document.querySelector('#restart-button').disabled");
	assert.equal(await evaluate("testApp.getSimulationSnapshot().attempts.length"), 0);
	await evaluate("document.querySelector('#back-button').click()");
	assert.deepEqual(errors, [], "Uncaught browser exceptions");
	console.log("PASS: desktop/mobile layout, room geometry, walking, wall collision, start, duplicate-click guard, scene/progress reset, patient change, resize, failed loading and retry. Screenshots: /tmp/projeto-xr-menu-{desktop,mobile}.png and /tmp/projeto-xr-session.png");
} finally {
	socket.close();
}
