// Spoken tutorial conversation regression against a running Vite server and isolated Chrome
// launched with --remote-debugging-port=9225. Uses Node 22's built-in WebSocket.
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";

const browserUrl = process.env.INSTRUMENT_BROWSER_URL ?? "http://127.0.0.1:9225";
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
	const start = await evaluate("(() => { const r = document.querySelector('#start-button').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()");
	await send("Input.dispatchMouseEvent", { type: "mousePressed", ...start, button: "left", clickCount: 1 });
	await send("Input.dispatchMouseEvent", { type: "mouseReleased", ...start, button: "left", clickCount: 1 });
	await waitFor("testApp.getSimulationSnapshot() !== null && !testApp._loading");

	assert.deepEqual(await run(async () => {
		const { DialogueAudio } = await import("/src/interaction/DialogueAudio.ts");
		const { default: manifest } = await import("/assets/Audio/dialogue/manifest.json");
		const recordings = new DialogueAudio();
		const context = new AudioContext();
		try {
			for (const clip of manifest.clips) {
				const url = recordings.getClip(clip.text, clip.profile === "female" ? "female" : "male");
				if (!url) throw new Error(`Missing bundled clip: ${clip.id}`);
				const response = await fetch(url);
				if (!response.ok) throw new Error(`Audio HTTP ${response.status}`);
				const decoded = await context.decodeAudioData(await response.arrayBuffer());
				if (decoded.duration < 0.08 || decoded.duration > 30 || decoded.numberOfChannels !== 1) throw new Error(`Invalid audio: ${clip.id}`);
			}
		} finally { await context.close(); }
		// Real decoded-buffer playback; gain is zero for device-free automation.
		const real = new DialogueAudio(() => {
			const context = new AudioContext();
			const gain = context.createGain(); gain.gain.value = 0; gain.connect(context.destination);
			const create = context.createBufferSource.bind(context);
			context.createBufferSource = () => {
				const source = create();
				const connect = source.connect.bind(source);
				source.connect = () => connect(gain);
				return source;
			};
			return context;
		});
		if (!await real.play(real.getClip("Paciente: Obrigado por me informar o resultado."))) throw new Error("Real bundled playback failed");
		real.dispose();
		const { patientCases } = await import("/src/simulation/patientCases.ts");
		for (const { id, config: { patient } } of patientCases) {
			const expectedVoice = ["Ana", "Clara", "Elisa"].includes(patient.name) ? "pf_dora" : "pt_BR-faber-medium";
			const clip = manifest.clips.find(clip => clip.id === `identity-${id}`);
			if (clip.voice !== expectedVoice || clip.profile !== patient.voiceProfile) throw new Error(`Incorrect patient voice: ${patient.name}`);
			for (const text of ["Paciente: Minha bexiga está vazia. Não fiz essas atividades nos últimos 90 minutos e não consumi essas substâncias nos últimos 30 minutos.", patient.voiceProfile === "female" ? "Paciente: Obrigada por me informar o resultado." : "Paciente: Obrigado por me informar o resultado."]) {
				const match = manifest.clips.find(clip => clip.text === text && clip.profile === patient.voiceProfile);
				if (match?.voice !== expectedVoice) throw new Error(`Inconsistent patient reply: ${patient.name}`);
			}
		}
		const sources = [];
		const fakeContext = { state: "running", destination: {},
			resume: async () => {}, close: async () => {},
			decodeAudioData: async () => ({ duration: 2 }),
			createBufferSource: () => {
				const source = { buffer: null, onended: null, connect() {}, disconnect() {}, start() {}, stop() {} };
				sources.push(source); return source;
			},
		};
		const fakeFetch = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) });
		const player = new DialogueAudio(() => fakeContext, fakeFetch);
		let completed = false;
		const first = player.play("first.wav").then(value => { completed = true; return value; });
		while (!sources[0]?.onended) await new Promise(resolve => setTimeout(resolve, 0));
		const oldEnd = sources[0].onended;
		if (completed) throw new Error("Recording advanced before ended");
		oldEnd();
		if (!await first) throw new Error("Ended not accepted");
		const second = player.play("second.wav");
		while (!sources[1]?.onended) await new Promise(resolve => setTimeout(resolve, 0));
		const currentEnd = sources[1].onended;
		oldEnd();
		if (sources[1].onended !== currentEnd) throw new Error("Stale audio callback affected next clip");
		player.dispose();
		if (await second || sources[1].onended !== null) throw new Error("Disposal did not cancel audio");
		const failed = new DialogueAudio(() => fakeContext, async () => { throw new Error("Missing file"); });
		if (await failed.play("missing.wav")) throw new Error("Rejected playback must fall back");
		return { clips: manifest.clips.length, realPlayback: true, lifecycle: true };
	}), { clips: 320, realPlayback: true, lifecycle: true });

	await run(() => {
		testApp.getInteractionManager()._dialogueAudio.getClip = () => undefined;
		window.spokenLines = [];
		window.pendingSpeech = [];
		window.cancelCount = 0;
		window.speechSynthesis.speak = utterance => { spokenLines.push(utterance.text); pendingSpeech.push(utterance); };
		window.speechSynthesis.cancel = () => { cancelCount++; pendingSpeech = []; };
		const camera = testApp._scene.activeCamera;
		camera.position.set(3, 1.6, 3);
		for (let i = 0; i < 15 && testApp.getSimulationSnapshot().currentStepId !== "identify-patient"; i++) {
			if (!testApp.getInteractionManager().executeActiveActionFromScene()) throw new Error("Preparation failed");
		}
	});
	assert.equal(await evaluate('testApp.getSimulationSnapshot().currentStepId'), 'identify-patient');
	assert.equal(await evaluate('spokenLines.length'), 0);
	assert.equal(await evaluate('!!testApp._scene.getMeshByName("patient-dialogue-trigger")'), false);
	assert.equal(await evaluate('!!document.querySelector("#hud-open-dialogue-btn")'), false);
	await run(() => {
		const camera = testApp._scene.activeCamera;
		const patient = testApp._scene.getTransformNodeByName("patient-root");
		const bounds = patient.getHierarchyBoundingVectors(true);
		const center = bounds.min.add(bounds.max).scale(0.5);
		// A natural front approach more than 65 cm from the old station waypoint.
		camera.position.set(center.x, 1.6, center.z + 0.85);
		camera.setTarget(camera.position.add(camera.getForwardRay().direction.scale(-1)));
	});
	await new Promise(resolve => setTimeout(resolve, 250));
	await run(() => {
		const camera = testApp._scene.activeCamera;
		camera.rotation.set(0, 0, 0);
	});
	await new Promise(resolve => setTimeout(resolve, 250));
	assert.equal(await evaluate('spokenLines.length'), 0, "Looking away must not start dialogue");
	await run(() => {
		const patient = testApp._scene.getTransformNodeByName("patient-root");
		const bounds = patient.getHierarchyBoundingVectors(true);
		testApp._scene.activeCamera.setTarget(bounds.min.add(bounds.max).scale(0.5));
	});
	await waitFor('pendingSpeech.length === 1');
	await new Promise(resolve => setTimeout(resolve, 500));
	await screenshot('/tmp/tutorial-dialogue.png');
	assert.equal(await evaluate('testApp.getSimulationSnapshot().steps["identify-patient"].status'), 'active');
	for (let i = 0; i < 7; i++) {
		await waitFor('pendingSpeech.length === 1');
		await run(() => pendingSpeech.shift().onend());
	}
	await waitFor('testApp.getSimulationSnapshot().currentStepId === "hand-hygiene-before-measurement"');
	assert.equal(await evaluate('spokenLines.length'), 7);
	assert.equal(await evaluate('testApp.getSimulationSnapshot().communicationRecords["identify-patient"].timing'), 'ideal');
	await run(() => {
		testApp.resetSession("tutorial");
		testApp.getInteractionManager()._dialogueAudio.getClip = () => undefined;
		testApp.moveToStation("cadeira");
		for (let i = 0; i < 15 && testApp.getSimulationSnapshot().currentStepId !== "identify-patient"; i++) testApp.getInteractionManager().executeActiveActionFromScene();
	});
	await waitFor('pendingSpeech.length === 1');
	await run(() => testApp.resetSession("evaluation"));
	assert.equal(await evaluate('cancelCount > 0 && pendingSpeech.length === 0'), true);
	assert.equal(await evaluate('!!testApp._scene.getMeshByName("patient-dialogue-trigger")'), true);
	assert.equal(await evaluate('testApp.getSimulationSnapshot().currentStepId'), 'initial-hand-hygiene');
	assert.deepEqual(await run(async () => {
		// Reproduce an error followed by a delayed watchdog from the same phrase.
		const manager = testApp.getInteractionManager();
		const originalSetTimeout = window.setTimeout;
		const callbacks = [];
		window.setTimeout = (callback, delay, ...args) => {
			if (delay >= 3500) callbacks.push(callback);
			return originalSetTimeout(callback, delay, ...args);
		};
		try {
			const first = manager._speak("Primeira fala.");
			const firstUtterance = pendingSpeech.shift();
			const lateError = firstUtterance.onerror;
			lateError();
			// An error must retire the watchdog and create exactly one reading timer.
			const fallbackText = manager._spokenSubtitle;
			callbacks[0]();
			lateError();
			if (callbacks.length !== 2) throw new Error("Repeated error/watchdog scheduled duplicate fallback");
			callbacks[1]();
			await first;
			const second = manager._speak("Segunda fala.");
			const secondUtterance = pendingSpeech.shift();
			const cancelsBefore = cancelCount;
			callbacks[0]();
			lateError();
			const current = manager._spokenSubtitle;
			const unchanged = cancelCount === cancelsBefore;
			secondUtterance.onend();
			await second;
			return { fallbackText, current, unchanged, retired: firstUtterance.onend === null && firstUtterance.onerror === null };
		} finally { window.setTimeout = originalSetTimeout; }
	}), {
		fallbackText: "Primeira fala. (Áudio indisponível; acompanhe a legenda.)",
		current: "Segunda fala.", unchanged: true, retired: true,
	});
	await run(() => {
		testApp.resetSession("tutorial");
		const manager = testApp.getInteractionManager();
		window.recordedLines = [];
		window.fixedFallbackCalls = 0;
		window.speechSynthesis.speak = () => { fixedFallbackCalls++; throw new Error("Unexpected fixed-phrase fallback"); };
		manager._dialogueAudio._createContext = () => {
			const context = new AudioContext();
			const gain = context.createGain(); gain.gain.value = 0; gain.connect(context.destination);
			const create = context.createBufferSource.bind(context);
			context.createBufferSource = () => {
				const source = create(); source.playbackRate.value = 8;
				const connect = source.connect.bind(source);
				source.connect = () => connect(gain);
				return source;
			};
			return context;
		};
		const render = manager._renderSpokenDialogue.bind(manager);
		manager._renderSpokenDialogue = () => {
			if (manager._spokenSubtitle && recordedLines.at(-1) !== manager._spokenSubtitle) recordedLines.push(manager._spokenSubtitle);
			render();
		};
		testApp.moveToStation("cadeira");
		for (let i = 0; i < 15 && testApp.getSimulationSnapshot().currentStepId !== "identify-patient"; i++) manager.executeActiveActionFromScene();
	});
	await waitFor('testApp.getSimulationSnapshot().currentStepId === "hand-hygiene-before-measurement"');
	assert.equal(await evaluate('fixedFallbackCalls'), 0, "All seven initial phrases must use bundled recordings");
	const sequence = await run(async () => {
		const { default: phrases } = await import("/src/interaction/dialoguePhrases.json");
		return { actual: recordedLines, expected: [phrases["identification-professional"], "Paciente: Meu nome é Ana e nasci em 1980-05-12.", phrases["readiness-professional"], phrases["readiness-patient"], phrases["explanation-professional"], phrases["explanation-patient"], phrases["rest-narrator"]] };
	});
	assert.deepEqual(sequence.actual, sequence.expected);

	for (const id of ["ana-standard", "diego-persistent"]) {
		await run(async () => {
			const { patientCases } = await import("/src/simulation/patientCases.ts");
			const { nextMockEvent } = await import("/src/simulation/mockRunner.ts");
			window.prepareResultsCase = (id) => {
				const config = patientCases.find(patient => patient.id === id).config;
				testApp._simulation._initialConfig = structuredClone(config);
				testApp._simulation.restart();
				const clock = { now: () => testApp.getSimulatedTime(), advance: ms => testApp.advanceSimulatedTime(ms) };
				for (let count = 0; testApp.getSimulationSnapshot().currentStepId !== "inform-patient"; count++) {
					if (count > 200) throw new Error("Could not reach results dialogue");
					const step = testApp.getSimulationSnapshot().currentStepId;
					if (["identify-patient", "check-readiness", "explain-and-rest"].includes(step)) testApp.completeSpokenDialogue(step);
					else if (!testApp._simulation.dispatch(nextMockEvent(testApp._simulation, clock)).accepted) throw new Error("Results fixture failed");
				}
				// Verify spoken results use observations rather than the case reference.
				testApp._simulation._state.observations["identify-systolic:first-sound-recorded"] = config.pressure.systolic - 2;
				recordedLines = [];
			};
		});
		await evaluate(`prepareResultsCase(${JSON.stringify(id)})`);
		await waitFor('testApp.getSimulationSnapshot().currentStepId === "remove-cuff"');
		const result = await run(() => ({ lines: recordedLines, fallback: fixedFallbackCalls, systolic: testApp.getSimulationSnapshot().observations["identify-systolic:first-sound-recorded"] }));
		assert.equal(result.fallback, 0, "Results must not depend on browser speech");
		assert.equal(result.lines.length, 2);
		assert.ok(result.lines[0].startsWith(`Profissional: Sua pressão medida foi ${result.systolic} por `));
		assert.equal(result.lines[1], id === "ana-standard" ? "Paciente: Obrigada por me informar o resultado." : "Paciente: Obrigado por me informar o resultado.");
		assert.equal(result.lines[0].includes("sons persistiram"), id === "diego-persistent");
	}
	assert.deepEqual(errors, []);
	console.log('Dialogue browser check passed: approach, ordered audio, completion, reset, evaluation mode.');
} finally { socket.close(); }
